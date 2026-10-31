import * as assert from "node:assert";
import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import type { HostMessage, WebviewMessage } from "../../src/messages.ts";

/** 拡張機能の ID */
export const EXTENSION_ID = "ShuheiNishikawa.mdmark";

/** リポジトリの直下（`vscode/out/test/` の 3 つ上） */
export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");

/** 代役の配信の origin（配布物の配信元と同じ） */
export const STUB_ORIGIN = new URL(
  process.env.MDMARK_VSCODE_DIST_BASE ?? "http://127.0.0.1:0",
).origin;

/** 代役の配信が配布物を返す経路 `/mdmark@{バージョン}/dist/{ファイル}` */
export function distPath(
  version: string,
  file: "index.js" | "index.css",
): string {
  return `/mdmark@${version}/dist/${file}`;
}

/** 拡張機能が `activate` で返す、テストのときだけの口 */
type TestApi = {
  inspectPreview: (selector: string) => Promise<InspectedElement[]>;
};

/** Webview の要素 1 つの様子 */
export type InspectedElement = {
  tagName: string;
  className: string;
  attributes: Record<string, string>;
  text: string;
  naturalWidth?: number;
  top: number;
  height: number;
};

/** 開いたパネルと、拡張機能と Webview の間で行き来したメッセージ */
export type RecordedPanel = {
  panel: vscode.WebviewPanel;
  /** 拡張機能 → Webview */
  sent: HostMessage[];
  /** `sent` の各メッセージを送った時刻（ミリ秒） */
  sentAt: number[];
  /** Webview → 拡張機能 */
  received: WebviewMessage[];
  /** 拡張機能が `onDidReceiveMessage` に登録した関数（Webview から届いたことにして呼ぶ） */
  listeners: Array<(message: unknown) => void>;
  /** 記録せずに Webview へ送る */
  postRaw: (message: unknown) => Thenable<boolean>;
  /** 作ったときの列とタイトル */
  options: { title: string; showOptions: unknown };
};

const recorded: RecordedPanel[] = [];
let recorderInstalled = false;

/** `window.createWebviewPanel` を包み、開いたパネルのメッセージを記録する（1 度だけ） */
export function installRecorder(): void {
  if (recorderInstalled) {
    return;
  }
  recorderInstalled = true;
  const original = vscode.window.createWebviewPanel.bind(vscode.window);
  (vscode.window as { createWebviewPanel: unknown }).createWebviewPanel = (
    ...args: Parameters<typeof vscode.window.createWebviewPanel>
  ) => {
    const panel = original(...args);
    const post = panel.webview.postMessage.bind(panel.webview);
    const record: RecordedPanel = {
      panel,
      sent: [],
      sentAt: [],
      received: [],
      listeners: [],
      postRaw: post,
      options: { title: args[1], showOptions: args[2] },
    };
    injectClickRelay(panel.webview);
    panel.webview.postMessage = (message: unknown) => {
      record.sent.push(message as HostMessage);
      record.sentAt.push(Date.now());
      return post(message);
    };
    const register = panel.webview.onDidReceiveMessage.bind(panel.webview);
    register((message: WebviewMessage) => {
      record.received.push(message);
    });
    // 拡張機能が登録する関数を控え、テストが Webview から届いたことにして呼べるようにする
    (panel.webview as { onDidReceiveMessage: unknown }).onDidReceiveMessage = (
      listener: (message: unknown) => void,
      thisArgs?: unknown,
      disposables?: vscode.Disposable[],
    ) => {
      record.listeners.push(listener.bind(thisArgs));
      return register(listener, thisArgs, disposables);
    };
    recorded.push(record);
    return panel;
  };
}

/** `testClick` のメッセージを受けたら、セレクタに当たる最初の要素を押す（クリックの代わり）スクリプトを、Webview の HTML に足す。HTML を入れるたびに、その HTML の nonce を付けて足す */
function injectClickRelay(webview: vscode.Webview): void {
  let descriptor: PropertyDescriptor | undefined;
  for (
    let proto: object | null = Object.getPrototypeOf(webview);
    proto !== null && descriptor === undefined;
    proto = Object.getPrototypeOf(proto)
  ) {
    descriptor = Object.getOwnPropertyDescriptor(proto, "html");
  }
  assert.ok(
    descriptor?.get && descriptor.set,
    "Webview の html を差し替えられない",
  );
  const { get, set } = descriptor;
  Object.defineProperty(webview, "html", {
    configurable: true,
    get: () => get.call(webview) as string,
    set: (value: string) => {
      const nonce = /<script[^>]*nonce="([^"]*)"/.exec(value)?.[1];
      const relay = nonce
        ? `<script nonce="${nonce}">window.addEventListener("message", (event) => { if (event.data?.type === "testClick") { document.querySelector(event.data.selector)?.click(); } });</script>`
        : "";
      set.call(
        webview,
        value.includes("</body>")
          ? value.replace("</body>", `${relay}</body>`)
          : `${value}${relay}`,
      );
    },
  });
}

/** Webview の要素を押す（`injectClickRelay` が足したスクリプトが受ける） */
export function clickInPreview(record: RecordedPanel, selector: string): void {
  void record.postRaw({ type: "testClick", selector });
}

/** Webview から `message` が届いたことにして、拡張機能の受け取りを呼ぶ */
export function deliver(record: RecordedPanel, message: WebviewMessage): void {
  record.received.push(message);
  for (const listener of record.listeners) {
    listener(message);
  }
}

/** 記録したパネル（開いた順） */
export function recordedPanels(): RecordedPanel[] {
  return recorded;
}

/** 最後に開いたパネル */
export function lastPanel(): RecordedPanel {
  const record = recorded.at(-1);
  assert.ok(record, "パネルが開いていない");
  return record;
}

/** Markdown の文書の 1 行目を書き換える（保存はしない） */
export async function replaceFirstLine(
  editor: vscode.TextEditor,
  text: string,
): Promise<void> {
  const line = editor.document.lineAt(0);
  await editor.edit((builder) => builder.replace(line.range, text));
}

/** エディタの先頭の行が動き終わるまで待ち、その行を返す（スクロールは少しずつ動く） */
export async function settledStart(editor: vscode.TextEditor): Promise<number> {
  let last = -1;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const current = editor.visibleRanges[0]?.start.line ?? 0;
    if (current === last) {
      return current;
    }
    last = current;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("エディタのスクロールが止まらない");
}

/** 条件が成り立つまで待つ。成り立たなければ例外を投げる */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; message?: string } = {},
): Promise<void> {
  const timeout = options.timeout ?? 15000;
  const start = Date.now();
  while (!(await condition())) {
    if (Date.now() - start > timeout) {
      throw new Error(options.message ?? "条件が成り立たなかった");
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
}

/** 指定した時間待つ */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

/** 拡張機能を動かして、テストのときだけの口を返す */
export async function api(): Promise<TestApi> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, "拡張機能が見つからない");
  return (await extension.activate()) as TestApi;
}

/** Webview の要素を調べる */
export async function inspect(selector: string): Promise<InspectedElement[]> {
  return (await api()).inspectPreview(selector);
}

/** `rendered` を `count` 回受けるまで待つ */
export async function waitForRendered(
  record: RecordedPanel,
  count = 1,
): Promise<void> {
  await waitFor(
    () =>
      record.received.filter((message) => message.type === "rendered").length >=
      count,
    { message: `rendered を ${count} 回受けていない` },
  );
}

/** 記録した `render` を送ったメッセージ */
export function renders(record: RecordedPanel) {
  return record.sent.filter(
    (message): message is Extract<HostMessage, { type: "render" }> =>
      message.type === "render",
  );
}

/** ワークスペースのフォルダ */
export function workspaceDir(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "ワークスペースが開いていない");
  return folder.uri.fsPath;
}

/** テストが作ったファイル（後始末で消す） */
const createdFiles = new Set<string>();

/** ワークスペースの下にファイルを書く（フォルダが無ければ作る） */
export async function writeFixture(
  relative: string,
  content: string | Buffer,
): Promise<string> {
  const path = join(workspaceDir(), relative);
  await mkdir(dirname(path), { recursive: true });
  // 書きかけを見張りに読ませないよう、別の名前に書いてから置き換える
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, content);
  await rename(temporary, path);
  createdFiles.add(path);
  return path;
}

/** 拡張機能が作るファイルを、後始末で消すものに加える */
export function trackFile(relative: string): void {
  createdFiles.add(join(workspaceDir(), relative));
}

/** ワークスペースの下のファイルを読む */
export function readFixture(relative: string): Promise<string> {
  return readFile(join(workspaceDir(), relative), "utf8");
}

/** Markdown をエディタで開く */
export async function openMarkdown(
  relative: string,
): Promise<vscode.TextEditor> {
  const uri = vscode.Uri.file(join(workspaceDir(), relative));
  const document = await vscode.workspace.openTextDocument(uri);
  // 同じファイルを前のテストで開いたままだと、ディスクの内容へ追いつくまで古い全文を返す
  const onDisk = await readFile(uri.fsPath, "utf8");
  await waitFor(() => document.getText() === onDisk, {
    message: "文書がディスクの内容に追いつかない",
  });
  return vscode.window.showTextDocument(document, vscode.ViewColumn.One);
}

/** `mdmark.*` の設定をワークスペースの設定に書く（`undefined` で消す） */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await vscode.workspace
    .getConfiguration("mdmark")
    .update(key, value, vscode.ConfigurationTarget.Workspace);
}

/** 代役の配信の状態 */
export const stub = {
  /** タグ一覧を決める */
  async setTags(names: string[]): Promise<void> {
    await fetch(`${STUB_ORIGIN}/tags`, {
      method: "PUT",
      body: JSON.stringify(names),
    });
  },
  /** 振る舞いを決める */
  async setMode(mode: {
    tags: "ok" | "hang" | "forbidden";
    dist: "ok" | "drop" | "slow";
  }): Promise<void> {
    await fetch(`${STUB_ORIGIN}/mode`, {
      method: "PUT",
      body: JSON.stringify(mode),
    });
  },
  /** 受けた要求の経路 */
  async requests(): Promise<string[]> {
    return (await fetch(`${STUB_ORIGIN}/requests`)).json() as Promise<string[]>;
  },
  /** 受けた要求を空にする */
  async clear(): Promise<void> {
    await fetch(`${STUB_ORIGIN}/requests`, { method: "DELETE" });
  },
};

/** 配布物の要求だけ（タグ一覧を除く） */
export async function distRequests(): Promise<string[]> {
  return (await stub.requests()).filter((path) => path !== "/tags");
}

/** タグ一覧の要求の数 */
export async function tagRequestCount(): Promise<number> {
  return (await stub.requests()).filter((path) => path === "/tags").length;
}

/** 見本の流れ図の定義（`docs/使い方/図を描く/見本.md` の最初の `json`） */
export async function sampleFlowJson(): Promise<string> {
  const sample = await readFile(
    join(REPO_ROOT, "docs", "使い方", "図を描く", "見本.md"),
    "utf8",
  );
  const match = /```json\n([\s\S]*?)\n```/.exec(sample);
  assert.ok(match?.[1], "見本の定義が無い");
  return match[1];
}

/** 見出し・表・注意書き・流れ図を持つ Markdown */
export async function guideMarkdown(): Promise<string> {
  return [
    "# 見出し",
    "",
    "| a | b |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "> [!NOTE]",
    "> 注意書き",
    "",
    "<!-- flow -->",
    "",
    "```json",
    await sampleFlowJson(),
    "```",
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
}

/** 全てのパネルとエディタを閉じ、テストが作ったファイルと書いた設定を戻し、代役の配信を元の状態に戻す */
export async function resetEnvironment(): Promise<void> {
  for (const record of recorded.splice(0)) {
    record.panel.dispose();
  }
  // 保存していない書き換えを残すと、同じ名前のファイルを次のテストが書いても古い内容のまま開く
  for (const document of vscode.workspace.textDocuments) {
    if (document.isDirty) {
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }
  }
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  for (const key of [
    "version",
    "configPath",
    "preview.liveUpdate",
    "preview.updateDelayMs",
    "preview.scrollPreviewWithEditor",
    "preview.scrollEditorWithPreview",
    "preview.theme",
    "colorTheme",
    "export.outputDir",
  ]) {
    await setSetting(key, undefined);
  }
  for (const path of createdFiles) {
    await rm(path, { recursive: true, force: true });
  }
  createdFiles.clear();
  await stub.setTags(["v0.10.0"]);
  await stub.setMode({ tags: "ok", dist: "ok" });
  await stub.clear();
  clearMessages();
  opened.length = 0;
}

/** 通知（`showInformationMessage`・`showErrorMessage`）に出た文と、ボタンの答え */
export const messages = {
  /** 情報の通知に出た文 */
  info: [] as string[],
  /** 誤りの通知に出た文 */
  error: [] as string[],
  /** 情報の通知に出たボタン */
  infoItems: [] as string[][],
  /** 情報の通知やダイアログへ返すボタン（`undefined` は閉じた） */
  answer: undefined as string | undefined,
  /** 情報の通知のオプション（ダイアログの `modal`・`detail`） */
  infoOptions: [] as unknown[],
};

let messagesInstalled = false;

/** 通知を出さずに記録する関数に替える（1 度だけ） */
export function installMessages(): void {
  if (messagesInstalled) {
    return;
  }
  messagesInstalled = true;
  const target = vscode.window as unknown as Record<string, unknown>;
  target.showInformationMessage = (...args: unknown[]) => {
    const [message, ...rest] = args as [string, ...unknown[]];
    messages.info.push(message);
    const options = rest.find((item) => typeof item === "object");
    messages.infoOptions.push(options);
    messages.infoItems.push(
      rest.filter((item) => typeof item === "string") as string[],
    );
    return Promise.resolve(messages.answer);
  };
  target.showErrorMessage = (message: string) => {
    messages.error.push(message);
    return Promise.resolve(undefined);
  };
}

/** 通知の記録を空にする */
export function clearMessages(): void {
  messages.info.length = 0;
  messages.error.length = 0;
  messages.infoItems.length = 0;
  messages.infoOptions.length = 0;
  messages.answer = undefined;
}

/** `env.openExternal` に渡された URL */
export const opened: string[] = [];

let openInstalled = false;

/** `env.openExternal` を、渡された URL を記録するだけの関数に替える（1 度だけ） */
export function installOpenExternal(): void {
  if (openInstalled) {
    return;
  }
  openInstalled = true;
  (vscode.env as unknown as Record<string, unknown>).openExternal = (
    target: vscode.Uri,
  ) => {
    opened.push(target.toString());
    return Promise.resolve(true);
  };
}

/** 外部ライブラリの代役のモジュール: `draw(slot)` で `slot` の文字を `drawn` にする */
const LIBRARY_MODULE =
  "export function draw(slot) { slot.textContent = 'drawn'; }\n";

/** 外部ライブラリの代役の配信 */
export type LibraryServer = {
  /** モジュールの URL */
  url: string;
  /** 受けた要求の数 */
  requests: () => number;
  close: () => Promise<void>;
};

/** `delayMs` 遅らせてモジュールを返す（`hang` のときは応えない）代役の配信を立てる */
export async function startLibraryServer(options: {
  delayMs: number | "hang";
}): Promise<LibraryServer> {
  let count = 0;
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((_request, response) => {
    count += 1;
    if (options.delayMs === "hang") {
      return;
    }
    setTimeout(() => {
      response.writeHead(200, {
        "Content-Type": "text/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(LIBRARY_MODULE);
    }, options.delayMs);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/my-lib.js`,
    requests: () => count,
    close: () =>
      new Promise<void>((resolveClose) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => resolveClose());
      }),
  };
}

/** Git のコマンドを `cwd` で実行し、標準出力の前後の空白を除いて返す（コミットの作者と署名はテスト用に固定する） */
export async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await promisify(execFile)(
    "git",
    [
      "-c",
      "user.name=mdmark-test",
      "-c",
      "user.email=mdmark-test@example.com",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd },
  );
  return stdout.trim();
}

/** VS Code の Git 拡張の API のうち、テストが使うもの */
type GitApi = {
  toGitUri: (uri: vscode.Uri, ref: string) => vscode.Uri;
  openRepository: (root: vscode.Uri) => Promise<unknown>;
};

/** VS Code の Git 拡張を動かして、API を返す */
export async function gitApi(): Promise<GitApi> {
  const extension = vscode.extensions.getExtension<{
    getAPI: (version: 1) => GitApi;
  }>("vscode.git");
  assert.ok(extension, "Git 拡張が見つからない");
  const exports = await extension.activate();
  return exports.getAPI(1);
}

/** `createRepo` が作り、VS Code に開かせたリポジトリのフォルダ */
const openedRepos: string[] = [];

/** `createRepo` が開かせたリポジトリを VS Code の Git 拡張に閉じさせる。フォルダを消した後も Git 拡張が `git` を起こし続けないよう、後始末でフォルダを消す前に呼ぶ */
export async function closeRepositories(): Promise<void> {
  for (const dir of openedRepos.splice(0)) {
    await vscode.commands.executeCommand("git.close", vscode.Uri.file(dir));
  }
}

/** ワークスペースの下に Git のリポジトリを作り、`files` を最初のコミットにして VS Code に開かせる。リポジトリのフォルダの絶対パスを返す（後始末で消す） */
export async function createRepo(
  name: string,
  files: Record<string, string>,
): Promise<string> {
  for (const [file, content] of Object.entries(files)) {
    await writeFixture(join(name, file), content);
  }
  trackFile(name);
  const dir = join(workspaceDir(), name);
  await git(dir, ["init", "-q", "-b", "main"]);
  await git(dir, ["add", "-A"]);
  await git(dir, ["commit", "-q", "-m", "最初のコミット"]);
  await (await gitApi()).openRepository(vscode.Uri.file(dir));
  openedRepos.push(dir);
  return dir;
}

/** リポジトリの変更を全てコミットし、コミットの ID を返す */
export async function commitAll(dir: string, message: string): Promise<string> {
  await git(dir, ["add", "-A"]);
  await git(dir, ["commit", "-q", "-m", message]);
  return git(dir, ["rev-parse", "HEAD"]);
}

/** `file` の `ref` の内容を指す Git の URI（`HEAD` やコミットの ID） */
export async function gitUri(
  file: vscode.Uri,
  ref: string,
): Promise<vscode.Uri> {
  return (await gitApi()).toGitUri(file, ref);
}

/** 2 つの URI の差分ビューを開き、アクティブなタブが差分ビューになるまで待つ */
export async function openDiffView(
  original: vscode.Uri,
  modified: vscode.Uri,
): Promise<void> {
  await vscode.commands.executeCommand(
    "vscode.diff",
    original,
    modified,
    "差分",
  );
  await waitFor(
    () =>
      vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof
      vscode.TabInputTextDiff,
    { message: "差分ビューが開かない" },
  );
}

/** 変更後の側のエディタ */
export function modifiedEditor(uri: vscode.Uri): vscode.TextEditor {
  const editor = vscode.window.visibleTextEditors.find(
    (candidate) => candidate.document.uri.toString() === uri.toString(),
  );
  assert.ok(editor, "変更後の側のエディタが見えていない");
  return editor;
}

/** 拡張機能の束ね先。子プロセスを起こした呼び出しの出どころを見分けるのに使う */
const EXTENSION_BUNDLE = join(REPO_ROOT, "vscode", "dist", "extension.cjs");

/** `child_process` の起動の関数を包み、この拡張機能（mdmark）の束ね先から呼ばれた回数を数える。止めると元に戻す */
export function watchChildProcesses(): {
  fromExtension: () => number;
  stop: () => void;
} {
  const childProcess = createRequire(import.meta.url)(
    "node:child_process",
  ) as Record<string, (...args: unknown[]) => unknown>;
  const names = [
    "spawn",
    "exec",
    "execFile",
    "fork",
    "spawnSync",
    "execSync",
    "execFileSync",
  ];
  const originals = new Map<string, (...args: unknown[]) => unknown>();
  let count = 0;
  for (const name of names) {
    const original = childProcess[name];
    if (original === undefined) {
      continue;
    }
    originals.set(name, original);
    childProcess[name] = function (this: unknown, ...args: unknown[]) {
      if ((new Error().stack ?? "").includes(EXTENSION_BUNDLE)) {
        count += 1;
      }
      return original.apply(this, args);
    };
  }
  return {
    fromExtension: () => count,
    stop: () => {
      for (const [name, original] of originals) {
        childProcess[name] = original;
      }
    },
  };
}
