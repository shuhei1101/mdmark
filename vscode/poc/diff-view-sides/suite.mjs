import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as vscode from "vscode";

/** タブが切り替わるまで待つ上限（ミリ秒） */
const WAIT_LIMIT_MS = 10000;
/** 待つ間の確かめの間隔（ミリ秒） */
const POLL_MS = 100;
/** 作業ツリーの変更で書き換える a.md の中身 */
const WORKING_TREE_BODY = "# 3\n\n三つ目を書き換えた\n";

const repository = process.env.POC_REPOSITORY;
const fileUri = vscode.Uri.file(join(repository, "a.md"));
const results = { version: vscode.version, checks: [] };

/** 一時のリポジトリの中で git を実行し、標準出力を返す */
function git(...args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" });
}

/** ミリ秒だけ待つ */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 条件が値を返すまで待ち、上限を過ぎたら undefined を返す */
async function waitFor(condition) {
  const start = Date.now();
  while (Date.now() - start < WAIT_LIMIT_MS) {
    const value = await condition();
    if (value) {
      return value;
    }
    await sleep(POLL_MS);
  }
  return undefined;
}

/** アクティブなタブが a.md の 1 ファイルの差分ビューになるまで待って入力を返す */
function waitDiffTab() {
  return waitFor(() => {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    return input instanceof vscode.TabInputTextDiff &&
      input.modified.fsPath === fileUri.fsPath
      ? input
      : undefined;
  });
}

/** URI の文書を読み、文字列・言語・待ちの時間を返す */
async function readSide(uri) {
  const start = performance.now();
  const document = await vscode.workspace.openTextDocument(uri);
  return {
    uri: uri.toString(),
    text: document.getText(),
    languageId: document.languageId,
    waitMs: Math.round(performance.now() - start),
  };
}

/** 差分ビューの 2 つの側を読み、期待する文字列と突き合わせて記録する */
async function check(name, operation, open, expected) {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  const command = await open();
  const input = await waitDiffTab();
  if (!input) {
    const actual = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    results.checks.push({ name, operation, command, ok: false, reason: `差分ビューのタブにならない: ${actual?.constructor?.name}` });
    return undefined;
  }
  const original = await readSide(input.original);
  const modified = await readSide(input.modified);
  const ok =
    original.text === expected.original &&
    modified.text === expected.modified &&
    original.languageId === "markdown" &&
    modified.languageId === "markdown";
  results.checks.push({
    name,
    operation,
    command,
    ok,
    original: { uri: original.uri, languageId: original.languageId, waitMs: original.waitMs, matches: original.text === expected.original },
    modified: { uri: modified.uri, languageId: modified.languageId, waitMs: modified.waitMs, matches: modified.text === expected.modified },
  });
  return input;
}

/** 拡張機能ホストの中で差分ビューの 2 つの側を読み、結果を POC_RESULT に書く */
export async function run() {
  try {
    await record();
  } finally {
    await writeFile(process.env.POC_RESULT, JSON.stringify(results, null, 2));
  }
}

/** 開き方ごとに差分ビューを開いて記録する */
async function record() {
    const api = (await vscode.extensions.getExtension("vscode.git").activate()).getAPI(1);
    await waitFor(() => api.repositories.length > 0);
    const repo = api.repositories[0];
    const rootUri = repo.rootUri;
    const sha2 = git("rev-parse", "HEAD~2").trim();
    const sha1 = git("rev-parse", "HEAD~1").trim();

    // コミットの差分（タイムライン）: タイムラインの項目が解決する vscode.diff と toGitUri の URI
    await check(
      "コミットの差分（タイムライン）",
      "vscode.diff(toGitUri(a.md, HEAD~2), toGitUri(a.md, HEAD~1))",
      async () => {
        await vscode.commands.executeCommand("vscode.diff", api.toGitUri(fileUri, sha2), api.toGitUri(fileUri, sha1), "a.md");
        return "vscode.diff";
      },
      { original: git("show", `${sha2}:a.md`), modified: git("show", `${sha1}:a.md`) },
    );

    // 作業ツリーの変更: ステージせずに書き換える
    await writeFile(fileUri.fsPath, WORKING_TREE_BODY);
    await repo.status();
    await waitFor(() => repo.state.workingTreeChanges.length > 0);
    await check(
      "作業ツリーの変更",
      "a.md をステージせずに書き換え、git.openChange(Uri)",
      async () => {
        await vscode.commands.executeCommand("git.openChange", fileUri);
        return "git.openChange";
      },
      { original: git("show", ":a.md"), modified: WORKING_TREE_BODY },
    );

    // ステージした変更: git add した後に書き換えない
    git("add", "a.md");
    await repo.status();
    await waitFor(() => repo.state.workingTreeChanges.length === 0 && repo.state.indexChanges.length > 0);
    const staged = await check(
      "ステージした変更",
      "git add した後に書き換えず、git.openChange(Uri)",
      async () => {
        await vscode.commands.executeCommand("git.openChange", fileUri);
        return "git.openChange";
      },
      { original: git("show", "HEAD:a.md"), modified: git("show", ":a.md") },
    );

    // フォーカスが移ったとき: 横の列に Webview のパネルを開いて表に出す
    if (staged) {
      const panel = vscode.window.createWebviewPanel("poc", "PoC", vscode.ViewColumn.Beside, {});
      panel.reveal(vscode.ViewColumn.Beside, false);
      await sleep(POLL_MS * 5);
      const found = vscode.window.tabGroups.all
        .flatMap((group) => group.tabs)
        .map((tab) => tab.input)
        .find((input) => input instanceof vscode.TabInputTextDiff && input.modified.fsPath === fileUri.fsPath);
      const activeIsWebview = vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputWebview;
      results.checks.push({
        name: "フォーカスが移ったとき",
        operation: "差分ビューの横の列に Webview のパネルを開いて表に出す",
        ok: activeIsWebview && found !== undefined && found.original.toString() === staged.original.toString() && found.modified.toString() === staged.modified.toString(),
        activeIsWebview,
        found: found ? { original: found.original.toString(), modified: found.modified.toString() } : null,
      });
      panel.dispose();
    }

    // コミットの差分（Source Control のグラフ）: 複数ファイルの差分エディター
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.commands.executeCommand("git.viewCommit", rootUri, sha1);
    const multiInput = await waitFor(() => vscode.window.tabGroups.activeTabGroup.activeTab?.input);
    await sleep(POLL_MS * 10);
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const input = tab?.input;
    const graph = {
      name: "コミットの差分（Source Control のグラフ）",
      operation: "git.viewCommit(rootUri, HEAD~1)",
      tabLabel: tab?.label,
      inputType: input?.constructor?.name,
      inputKeys: input ? Object.keys(input) : [],
      input: input ? JSON.parse(JSON.stringify(input)) : null,
      opened: multiInput !== undefined,
      activeTextEditor: vscode.window.activeTextEditor?.document.uri.toString() ?? null,
      visibleTextEditors: vscode.window.visibleTextEditors.map((editor) => editor.document.uri.toString()),
    };
    // 中の a.md にフォーカスを移す（エディタの中のフォーカスを次へ送る）
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    await sleep(POLL_MS * 5);
    graph.activeTextEditorAfterFocus = vscode.window.activeTextEditor?.document.uri.toString() ?? null;
    graph.visibleTextEditorsAfterFocus = vscode.window.visibleTextEditors.map((editor) => editor.document.uri.toString());
    results.checks.push(graph);
}
