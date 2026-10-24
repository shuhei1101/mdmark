import { existsSync } from "node:fs";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import {
  _electron,
  type ElectronApplication,
  type Frame,
  type Page,
  test,
} from "@playwright/test";
import { buildExtension } from "../../vscode/scripts/build.ts";
import { createStubServer } from "../../vscode/tests/integration/run.ts";
import { createBuiltRoot } from "../integration/built-root.ts";
import { VSCODE_EXECUTABLE_ENV } from "./vscode-binary.ts";

// リポジトリの直下と、拡張機能の場所
const REPO_ROOT = resolve(import.meta.dirname, "../..");
const EXTENSION_SOURCE = join(REPO_ROOT, "vscode");
// 拡張機能ホストを Test のモードにして配信元を差し替えるため、終わらないテストの入口を渡す
const NEVER_ENDING_RUNNER = "exports.run = () => new Promise(() => {});\n";
// 何かを待つ上限（ミリ秒）
const WAIT_TIMEOUT_MS = 30_000;
// コマンドパレットが開くのを待つ 1 回の長さ（ミリ秒）と、F1 を押す回数の上限
const PALETTE_OPEN_WAIT_MS = 3_000;
const PALETTE_OPEN_ATTEMPTS = 5;
// 起動直後のメインプロセスへの評価を試す回数の上限と、失敗してから待つ長さ（ミリ秒）
const EVALUATE_ATTEMPTS = 5;
const EVALUATE_RETRY_WAIT_MS = 1_000;
// 複製に含めないもの
const NOT_COPIED = ["node_modules", ".vscode-test", "out", "dist", "media"];

/** 代役の配信の状態（`createStubServer` が受ける形） */
type StubState = Parameters<typeof createStubServer>[0];

/** このブランチでビルドした拡張機能と配布物 */
export type BuiltExtension = {
  /** ビルドした拡張機能の場所 */
  extensionDir: string;
  /** 配布物を配る一時フォルダの作業ツリー */
  distRoot: string;
  /** 一時フォルダを消す */
  dispose: () => Promise<void>;
};

/** 拡張機能の変更を 1 度だけビルドした複製と、このブランチの配布物を用意する */
export async function buildExtensionAndDist(): Promise<BuiltExtension> {
  const temp = await mkdtemp(join(tmpdir(), "mdmark-e2e-ext-"));
  const extensionDir = join(temp, "vscode");
  await cp(EXTENSION_SOURCE, extensionDir, {
    recursive: true,
    filter: (source) =>
      !NOT_COPIED.some((name) =>
        source.startsWith(join(EXTENSION_SOURCE, name)),
      ),
  });
  await symlink(
    join(EXTENSION_SOURCE, "node_modules"),
    join(extensionDir, "node_modules"),
    "dir",
  );
  await buildExtension({ root: extensionDir, tests: false });
  await writeFile(join(temp, "runner.cjs"), NEVER_ENDING_RUNNER);
  const built = await createBuiltRoot();
  return {
    extensionDir,
    distRoot: built.root,
    dispose: async () => {
      await built.dispose();
      await rm(temp, { recursive: true, force: true });
    },
  };
}

/** `globalSetup` が取得した VS Code の実行ファイルの場所を返す */
function vscodeExecutable(): string {
  const executable = process.env[VSCODE_EXECUTABLE_ENV];
  if (!executable) {
    throw new Error(
      `${VSCODE_EXECUTABLE_ENV} が未設定です（globalSetup が VS Code を取得していません）`,
    );
  }
  return executable;
}

/** 代役の配信の操作 */
export type Stub = {
  /** 配信の origin */
  origin: string;
  /** タグ一覧を決める */
  setTags: (names: string[]) => void;
  /** 振る舞いを決める */
  setMode: (mode: StubState["mode"]) => void;
  /** 受けた要求の経路 */
  requests: () => string[];
  /** 受けた要求を空にする */
  clear: () => void;
  /** 止める */
  close: () => Promise<void>;
};

/** 配布物とタグ一覧の代役の配信を立てる */
export async function startStub(distRoot: string): Promise<Stub> {
  const state: StubState = {
    tags: ["v0.7.0", "v0.6.0", "vscode-v0.1.0"],
    mode: { tags: "ok", dist: "ok" },
    requests: [],
  };
  const server: Server = createStubServer(state, join(distRoot, "dist"));
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const sockets = new Set<import("node:net").Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    setTags: (names) => {
      state.tags = names;
    },
    setMode: (mode) => {
      state.mode = mode;
    },
    requests: () => [...state.requests],
    clear: () => {
      state.requests.length = 0;
    },
    close: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => done());
      }),
  };
}

/** VS Code の見た目を整える既定のワークスペースの設定 */
const BASE_SETTINGS = {
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "workbench.enableExperiments": false,
  "chat.disableAIFeatures": true,
  "telemetry.telemetryLevel": "off",
  "update.mode": "none",
  "extensions.autoCheckUpdates": false,
  "security.workspace.trust.enabled": false,
  "editor.minimap.enabled": false,
  "files.autoSave": "off",
  "window.restoreWindowSize": false,
  // 文字を打つテストで、補完・自動の閉じ括弧・自動の字下げが入らないようにする
  "editor.autoClosingBrackets": "never",
  "editor.autoClosingQuotes": "never",
  "editor.autoIndent": "none",
  "editor.quickSuggestions": false,
  "editor.suggestOnTriggerCharacters": false,
  "editor.wordBasedSuggestions": "off",
  "editor.acceptSuggestionOnEnter": "off",
  "editor.formatOnType": false,
  // 見出しの文脈を重ねる表示が先頭の行を隠すと、エディタの先頭の行を読み違える
  "editor.stickyScroll.enabled": false,
  // スクロールの途中の位置を読み取らないようにする
  "editor.smoothScrolling": false,
  "workbench.list.smoothScrolling": false,
};

/** 起動した VS Code と、そこを操作する道具 */
export type VscodeSession = {
  app: ElectronApplication;
  win: Page;
  /** ワークスペースのフォルダ */
  workspaceDir: string;
  stub: Stub;
  /** 既定のブラウザで開く操作の代役（`http`・`https` は `xdg-open`、それ以外は `shell.openExternal`）が記録した URL */
  openedUrls: () => Promise<string[]>;
  /** Quick Open でファイルを開き、エディタに文字を打てる状態にする */
  openFile: (relative: string) => Promise<void>;
  /** 開いているテキストエディタの文字を打つ場所にフォーカスを置く */
  focusEditor: () => Promise<void>;
  /** コマンドパレットでコマンドを選ぶ */
  runCommand: (title: string) => Promise<void>;
  /** Shift+Alt+D を押してプレビューを横に開く */
  openPreviewWithShortcut: () => Promise<void>;
  /** プレビューの中身のフレーム（開くまで待つ） */
  previewFrame: () => Promise<Frame>;
  /** `selector` に当たる要素を持つプレビューのフレーム（HTML を入れ直してフレームが替わっても、現れるまで探し直す） */
  frameWith: (selector: string) => Promise<Frame>;
  /** 見出し・表・注意書き・流れ図が描かれたプレビューのフレーム（HTML を入れ直してフレームが替わっても、描かれるまで探し直す） */
  guideFrame: () => Promise<Frame>;
  /** 通知に出ている文 */
  notifications: () => Promise<string[]>;
  /** エディタの見えている先頭の行（1 始まり） */
  editorTopLine: () => Promise<number>;
  /** 終了して一時フォルダを消す */
  close: () => Promise<void>;
};

/** 起動の指定 */
export type LaunchOptions = {
  built: BuiltExtension;
  stub: Stub;
  /** ワークスペースに置くファイル（相対パス → 中身） */
  files: Record<string, string | Buffer>;
  /** ワークスペースの設定に足すもの */
  settings?: Record<string, unknown>;
  /** ユーザーの設定（ワークスペースの設定より弱い。画面から切り替える設定の初めの値） */
  userSettings?: Record<string, unknown>;
  /** 書き込みを許さないフォルダ（ワークスペースからの相対パス） */
  readOnlyDirs?: string[];
  /** 設定を足したユーザーデータを使い回さず、前回のバージョンを空にして始める（既定） */
  freshState?: boolean;
};

/** 拡張機能を入れた VS Code を、手元の代役の配信につないで起動する */
export async function launchVscode(
  options: LaunchOptions,
): Promise<VscodeSession> {
  const temp = await mkdtemp(join(tmpdir(), "mdmark-e2e-vscode-"));
  const dirs: SessionDirs = {
    temp,
    workspaceDir: join(temp, "ws"),
    userDataDir: join(temp, "user-data"),
    binDir: join(temp, "bin"),
    openedLog: join(temp, "opened.log"),
  };
  const { workspaceDir, binDir, openedLog } = dirs;
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(join(workspaceDir, ".vscode"), { recursive: true });
  if (options.userSettings !== undefined) {
    await mkdir(join(dirs.userDataDir, "User"), { recursive: true });
    await writeFile(
      join(dirs.userDataDir, "User", "settings.json"),
      JSON.stringify(options.userSettings, null, 2),
    );
  }
  await writeFile(
    join(workspaceDir, ".vscode", "settings.json"),
    JSON.stringify({ ...BASE_SETTINGS, ...options.settings }, null, 2),
  );
  for (const [relative, content] of Object.entries(options.files)) {
    const path = join(workspaceDir, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
  for (const relative of options.readOnlyDirs ?? []) {
    const path = join(workspaceDir, relative);
    await mkdir(path, { recursive: true });
    await chmod(path, 0o555);
  }
  // `http`・`https` の URL は VS Code が `xdg-open` を起こして開くため、渡された URL を記録するだけの代役を `PATH` の先頭に置く
  await mkdir(binDir, { recursive: true });
  const opener = join(binDir, "xdg-open");
  await writeFile(opener, `#!/bin/sh\necho "$@" >> "${openedLog}"\n`);
  await chmod(opener, 0o755);
  return startVscode(options, dirs);
}

/** `launchVscode` が用意した一時フォルダ */
type SessionDirs = {
  temp: string;
  workspaceDir: string;
  userDataDir: string;
  binDir: string;
  openedLog: string;
};

/** 用意した一時フォルダで VS Code を起動し、操作する道具を返す */
async function startVscode(
  options: LaunchOptions,
  dirs: SessionDirs,
): Promise<VscodeSession> {
  const { built, stub } = options;
  const { temp, workspaceDir, userDataDir, binDir, openedLog } = dirs;
  const app = await _electron.launch({
    executablePath: vscodeExecutable(),
    args: [
      "--no-sandbox",
      "--disable-gpu",
      `--extensions-dir=${join(temp, "extensions")}`,
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      `--user-data-dir=${userDataDir}`,
      `--extensionDevelopmentPath=${built.extensionDir}`,
      `--extensionTestsPath=${join(dirname(built.extensionDir), "runner.cjs")}`,
      workspaceDir,
    ],
    env: {
      ...process.env,
      PATH: `${binDir}${delimiter}${process.env.PATH}`,
      MDMARK_VSCODE_DIST_BASE: `${stub.origin}/mdmark`,
      MDMARK_VSCODE_TAGS_URL: `${stub.origin}/tags`,
    },
    timeout: WAIT_TIMEOUT_MS * 2,
  });
  // `http`・`https` 以外の URL（`file:` など）を開く操作の代役: 渡された URL を記録するだけにする
  // 起動直後は Electron のメインプロセスへの評価が破棄されることがあるため、成功するまで繰り返す
  for (let attempt = 1; ; attempt += 1) {
    try {
      await app.evaluate(({ shell }) => {
        const target = globalThis as unknown as { __opened: string[] };
        target.__opened = [];
        shell.openExternal = async (url: string) => {
          target.__opened.push(url);
        };
      });
      break;
    } catch (error) {
      if (attempt >= EVALUATE_ATTEMPTS) {
        throw error;
      }
      await new Promise((done) => setTimeout(done, EVALUATE_RETRY_WAIT_MS));
    }
  }
  const win = await app.firstWindow();
  await win.waitForSelector(".monaco-workbench", {
    timeout: WAIT_TIMEOUT_MS * 2,
  });

  const frameWith = async (selector: string): Promise<Frame> => {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      for (const frame of win.frames()) {
        if (
          frame.url().startsWith("vscode-webview:") &&
          (await frame
            .locator(selector)
            .count()
            .catch(() => 0)) > 0
        ) {
          return frame;
        }
      }
      await win.waitForTimeout(100);
    }
    throw new Error(`プレビューのフレームに ${selector} が現れない`);
  };

  /** コマンドパレットを開いて文字を打ち、先頭の候補を選ぶ */
  const runCommand = async (title: string): Promise<void> => {
    const input = win.locator(".quick-input-box input");
    // フォーカスが Webview にあると F1 が届かないため、開けなかったらエディタへフォーカスを戻して押し直す
    for (let attempt = 0; attempt < PALETTE_OPEN_ATTEMPTS; attempt += 1) {
      await win.keyboard.press("F1");
      const opened = await input
        .waitFor({ state: "visible", timeout: PALETTE_OPEN_WAIT_MS })
        .then(() => true)
        .catch(() => false);
      if (opened) {
        break;
      }
      if ((await win.locator(".editor-instance .monaco-editor").count()) > 0) {
        await focusEditor();
      }
    }
    await input.waitFor({ timeout: WAIT_TIMEOUT_MS });
    await input.fill(`>${title}`);
    await win
      .locator(`.quick-input-list .monaco-list-row[aria-label*="${title}"]`)
      .first()
      .waitFor({ timeout: WAIT_TIMEOUT_MS });
    await win.keyboard.press("Enter");
  };

  /** 開いているテキストエディタの文字を打つ場所にフォーカスを置く */
  const focusEditor = async (): Promise<void> => {
    await win
      .locator(".editor-instance .monaco-editor .view-lines")
      .first()
      .click();
  };

  /** ファイルは先頭のエディタグループに開く（プレビューの列に開いてプレビューを背面に回さない） */
  const openFile = async (relative: string): Promise<void> => {
    await win.keyboard.press("Control+1");
    await win.keyboard.press("Control+P");
    const input = win.locator(".quick-input-box input");
    await input.waitFor({ timeout: WAIT_TIMEOUT_MS });
    await input.fill(relative);
    const name = relative.split("/").at(-1) ?? relative;
    await win
      .locator(`.quick-input-list .monaco-list-row[aria-label*="${name}"]`)
      .first()
      .waitFor({ timeout: WAIT_TIMEOUT_MS });
    await win.keyboard.press("Enter");
    await win
      .locator(`.tab[aria-label*="${name}"]`)
      .first()
      .waitFor({ timeout: WAIT_TIMEOUT_MS });
    await focusEditor();
  };

  return {
    app,
    win,
    workspaceDir,
    stub,
    openedUrls: async () => [
      ...(await app.evaluate(
        () => (globalThis as unknown as { __opened: string[] }).__opened,
      )),
      ...(existsSync(openedLog)
        ? (await readFile(openedLog, "utf8")).split("\n").filter(Boolean)
        : []),
    ],
    openFile,
    focusEditor,
    runCommand,
    openPreviewWithShortcut: async () => {
      await win.keyboard.press("Shift+Alt+D");
    },
    previewFrame: async () => {
      const deadline = Date.now() + WAIT_TIMEOUT_MS;
      while (Date.now() < deadline) {
        for (const frame of win.frames()) {
          if (
            frame.url().startsWith("vscode-webview:") &&
            (await frame
              .locator("#mdmark-preview")
              .count()
              .catch(() => 0)) > 0
          ) {
            return frame;
          }
        }
        await win.waitForTimeout(100);
      }
      throw new Error("プレビューのフレームが現れない");
    },
    frameWith,
    guideFrame: async () => {
      const deadline = Date.now() + WAIT_TIMEOUT_MS;
      while (Date.now() < deadline) {
        for (const frame of win.frames()) {
          if (!frame.url().startsWith("vscode-webview:")) {
            continue;
          }
          const counts = await Promise.all(
            GUIDE_SELECTORS.map((selector) =>
              frame
                .locator(selector)
                .count()
                .catch(() => 0),
            ),
          );
          if (counts.every((count) => count > 0)) {
            return frame;
          }
        }
        await win.waitForTimeout(100);
      }
      throw new Error("描いたプレビューのフレームが現れない");
    },
    notifications: async () =>
      win
        .locator(
          ".notifications-toasts .notification-list-item .notification-list-item-message",
        )
        .allInnerTexts(),
    editorTopLine: () =>
      win.evaluate(() => {
        const editor = document.querySelector(".monaco-editor");
        if (!editor) {
          throw new Error("エディタが無い");
        }
        const top = editor.getBoundingClientRect().top;
        const lines = [
          ...editor.querySelectorAll(".margin-view-overlays .line-numbers"),
        ]
          .filter((item) => item.getBoundingClientRect().bottom > top + 1)
          .map((item) => Number(item.textContent));
        return Math.min(...lines);
      }),
    close: async () => {
      await app.close().catch(() => undefined);
      for (const relative of options.readOnlyDirs ?? []) {
        await chmod(join(workspaceDir, relative), 0o755).catch(() => undefined);
      }
      if (process.env.MDMARK_E2E_KEEP) {
        await cp(userDataDir, process.env.MDMARK_E2E_KEEP, { recursive: true });
      }
      await rm(temp, { recursive: true, force: true });
    },
  };
}

/** 見出し・表・注意書き・流れ図を持つ見本の Markdown */
export async function guideMarkdown(): Promise<string> {
  const sample = await readFile(
    join(REPO_ROOT, "docs", "使い方", "図を描く", "見本.md"),
    "utf8",
  );
  const flow = /```json\n([\s\S]*?)\n```/.exec(sample)?.[1];
  if (flow === undefined) {
    throw new Error("見本の流れ図の定義が無い");
  }
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
    flow,
    "```",
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
}

/** 見本の Markdown を描いたプレビューにあるもの */
const GUIDE_SELECTORS = [
  "h1",
  ".mdmark-table",
  ".markdown-alert",
  ".mdmark-diagram-frame",
];

/** プレビューに見出し・表・注意書き・流れ図が描かれるまで待つ */
export async function expectGuideRendered(frame: Frame): Promise<void> {
  for (const selector of GUIDE_SELECTORS) {
    await frame.locator(selector).first().waitFor({ timeout: WAIT_TIMEOUT_MS });
  }
}

/** スペックの `beforeAll`・`afterAll`・`beforeEach`・`afterEach` で、拡張機能のビルドと代役の配信と VS Code の起動・終了を受け持つ。スペックの先頭で 1 度だけ呼ぶ */
export function useVscodeE2E(): {
  /** 今のテストの代役の配信 */
  stub: () => Stub;
  /** 拡張機能を入れた VS Code を、今のテストの代役の配信につないで起動する */
  launch: (
    options: Omit<LaunchOptions, "built" | "stub">,
  ) => Promise<VscodeSession>;
  /** ビルドした拡張機能と配布物 */
  built: () => BuiltExtension;
} {
  let built: BuiltExtension | undefined;
  let stub: Stub | undefined;
  let session: VscodeSession | undefined;
  // VS Code の画面を操るため、1 つのブラウザのプロジェクトだけで流し、
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "ブラウザのプロジェクトに依らないシナリオなので chromium のプロジェクトだけで流す",
  );
  test.beforeAll(async () => {
    built = await buildExtensionAndDist();
  });
  test.afterAll(async () => {
    await built?.dispose();
  });
  test.beforeEach(async () => {
    stub = await startStub(
      requireValue(built, "拡張機能をビルドしていない").distRoot,
    );
  });
  test.afterEach(async () => {
    await session?.close();
    session = undefined;
    await stub?.close();
  });
  return {
    stub: () => requireValue(stub, "代役の配信を立てていない"),
    built: () => requireValue(built, "拡張機能をビルドしていない"),
    launch: async (options) => {
      const launched = await launchVscode({
        ...options,
        built: requireValue(built, "拡張機能をビルドしていない"),
        stub: requireValue(stub, "代役の配信を立てていない"),
      });
      session = launched;
      return launched;
    },
  };
}

/** 値が無ければ例外を投げる */
function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

/** 開いているエディタの全文を打ち替える（保存はしない） */
export async function replaceAllText(
  session: VscodeSession,
  text: string,
): Promise<void> {
  await session.focusEditor();
  await session.win.keyboard.press("Control+A");
  await session.win.keyboard.type(text);
}

/** 開いているエディタの 1 行目を、1 文字ずつ `delayMs` 空けて打ち替える（保存はしない） */
export async function replaceFirstLine(
  session: VscodeSession,
  text: string,
  delayMs = 0,
): Promise<void> {
  await session.focusEditor();
  await session.win.keyboard.press("Control+Home");
  await session.win.keyboard.press("Shift+End");
  await session.win.keyboard.type(text, { delay: delayMs });
}

/** 開いているエディタを保存する */
export async function saveEditor(session: VscodeSession): Promise<void> {
  await session.win.keyboard.press("Control+S");
}

// 長い文書の節の数と、1 つの節の行数（見出し 1 行・空行 1 行・40 の段落 × 2 行）
export const SECTIONS = 10;
export const SECTION_LINES = 82;

/** 見出しで区切った 10 の節を持ち、画面の高さの 3 倍を超える Markdown */
export function longDocument(): string {
  return Array.from({ length: SECTIONS }, (_, section) =>
    [
      `## 節 ${section + 1}`,
      "",
      ...Array.from({ length: 40 }, (_, paragraph) => [
        `${section + 1}-${paragraph + 1} 段落の本文です。`,
        "",
      ]).flat(),
    ].join("\n"),
  ).join("\n");
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
  /** 止める */
  close: () => Promise<void>;
};

/** `delayMs` 遅らせてモジュールを返す代役の配信を立てる */
export async function startLibraryServer(options: {
  delayMs: number;
}): Promise<LibraryServer> {
  let count = 0;
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer((_request, response) => {
    count += 1;
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
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/my-lib.js`,
    requests: () => count,
    close: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        server.close(() => done());
      }),
  };
}

/** `window.print` の呼び出しの記録 */
export type PrintCall = {
  /** 呼ばれた時に描き終えていた外部ライブラリの印の場所の数 */
  drawn: number;
  /** 呼ばれた時の `details` の開閉 */
  details: boolean[];
};

/** 書き出した HTML のページで、`window.print` を、前後に `beforeprint`・`afterprint` を送って呼び出しを記録する関数に替える（ページを開く前に呼ぶ） */
export async function recordPrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as { __prints: unknown[] };
    target.__prints = [];
    window.print = () => {
      window.dispatchEvent(new Event("beforeprint"));
      target.__prints.push({
        drawn: document.querySelectorAll(".mdmark-embed[data-mdmark-drawn]")
          .length,
        details: [...document.querySelectorAll("details")].map(
          (item) => item.open,
        ),
      });
      window.dispatchEvent(new Event("afterprint"));
    };
  });
}

/** 記録した `window.print` の呼び出し */
export function printCalls(page: Page): Promise<PrintCall[]> {
  return page.evaluate(
    () => (window as unknown as { __prints: PrintCall[] }).__prints,
  );
}

/** エディタの先頭の行が 300 ms 変わらなくなるまで待ち、その行を返す */
async function settledTop(session: VscodeSession): Promise<number> {
  let last = await session.editorTopLine();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await session.win.waitForTimeout(300);
    const current = await session.editorTopLine();
    if (current === last) {
      return current;
    }
    last = current;
  }
  throw new Error("エディタのスクロールが止まらない");
}

/** エディタの先頭の行が `line` 以降になるまで 1 行ずつ下へ動かし、止まった先頭の行を返す */
export async function scrollEditorTo(
  session: VscodeSession,
  line: number,
): Promise<number> {
  await session.win.keyboard.press("Control+G");
  await session.win.keyboard.type(String(line));
  await session.win.keyboard.press("Enter");
  for (let step = 0; step < 100; step += 1) {
    if ((await session.editorTopLine()) >= line) {
      return settledTop(session);
    }
    await session.win.keyboard.press("Control+ArrowDown");
  }
  throw new Error(`エディタの先頭が ${line} 行目にならない`);
}
