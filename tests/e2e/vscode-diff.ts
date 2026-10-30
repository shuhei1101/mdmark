import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect } from "@playwright/test";
import type { VscodeSession } from "./vscode.ts";

const execFileAsync = promisify(execFile);

// Git のコミットに付ける書いた人
const GIT_IDENTITY = [
  "-c",
  "user.name=佐藤",
  "-c",
  "user.email=sato@example.test",
];

// 変更の一覧とタイムラインのコミットの件名
const COMMIT_MESSAGE = "変更を反映する";

/** `workspaceDir` で Git を流す */
async function git(workspaceDir: string, args: string[]): Promise<void> {
  await execFileAsync("git", [...GIT_IDENTITY, ...args], { cwd: workspaceDir });
}

/** 差分の元になるリポジトリの指定 */
export type DiffRepoOptions = {
  /** コミットする `a.md` の中身 */
  before: string;
  /** 作業ツリーの `a.md` の中身 */
  after: string;
  /** 作業ツリーの変更をコミットする */
  commit?: boolean;
};

/** `before` の `a.md` をコミットし、作業ツリーを `after` にしたリポジトリを `workspaceDir` に作る。`commit` なら作業ツリーの変更もコミットする。`LaunchOptions.prepare` に渡す */
export function prepareDiffRepo(
  options: DiffRepoOptions,
): (workspaceDir: string) => Promise<void> {
  return async (workspaceDir) => {
    await git(workspaceDir, ["init", "-q", "-b", "main"]);
    // 設定のフォルダは変更の一覧に出さない
    await writeFile(join(workspaceDir, ".gitignore"), ".vscode/\n");
    await writeFile(join(workspaceDir, "a.md"), options.before);
    await git(workspaceDir, ["add", "-A"]);
    await git(workspaceDir, ["commit", "-q", "-m", "最初のコミット"]);
    await writeFile(join(workspaceDir, "a.md"), options.after);
    if (options.commit) {
      await git(workspaceDir, ["add", "-A"]);
      await git(workspaceDir, ["commit", "-q", "-m", COMMIT_MESSAGE]);
    }
  };
}

/** 差分ビューの変更後の側の文字を打つ場所 */
const MODIFIED_LINES =
  ".monaco-diff-editor .editor.modified .view-lines:not(.line-delete) .view-line";

/** 差分ビューが開くのを待つ */
async function waitForDiffView(session: VscodeSession): Promise<void> {
  await session.win.locator(".monaco-diff-editor").first().waitFor();
}

/** Source Control のビューの変更から `a.md` を開き、作業ツリーの変更の差分ビューにする */
export async function openWorkingTreeDiff(
  session: VscodeSession,
): Promise<void> {
  await session.win.keyboard.press("Control+Shift+G");
  await session.win
    .locator('.scm-view .monaco-list-row[aria-label*="a.md"]')
    .first()
    .click();
  await waitForDiffView(session);
}

/** `a.md` を開き、タイムラインの最後のコミットから、そのコミットと 1 つ前の差分ビューにする */
export async function openCommitDiff(session: VscodeSession): Promise<void> {
  await session.openFile("a.md");
  await session.runCommand("Timeline: Focus on Timeline View");
  await session.win
    .locator(`.monaco-list-row[aria-label*="${COMMIT_MESSAGE}"]`)
    .first()
    .click();
  await waitForDiffView(session);
}

/** 差分ビューの変更後の側にフォーカスを置く */
export async function focusModifiedSide(session: VscodeSession): Promise<void> {
  await session.win.locator(MODIFIED_LINES).first().click();
}

/** 変更後の側にフォーカスを置いて、プレビューを横に開く */
export async function openDiffPreview(session: VscodeSession): Promise<void> {
  await focusModifiedSide(session);
  await session.openPreviewWithShortcut();
}

/** 差分ビューの変更後の側の、見えている先頭の行（1 始まり） */
export function modifiedTopLine(session: VscodeSession): Promise<number> {
  return session.win.evaluate(() => {
    const editor = document.querySelector(
      ".monaco-diff-editor .editor.modified .monaco-editor",
    );
    if (!editor) {
      throw new Error("変更後の側のエディタが無い");
    }
    const top = editor.getBoundingClientRect().top;
    const lines = [
      ...editor.querySelectorAll(".margin-view-overlays .line-numbers"),
    ]
      .filter((item) => item.getBoundingClientRect().bottom > top + 1)
      .map((item) => Number(item.textContent));
    return Math.min(...lines);
  });
}

/** 変更後の側の先頭の行が `line` 以降になるまで 1 行ずつ下へ動かし、止まった先頭の行を返す */
export async function scrollModifiedTo(
  session: VscodeSession,
  line: number,
): Promise<number> {
  await focusModifiedSide(session);
  await session.win.keyboard.press("Control+G");
  await session.win.keyboard.type(String(line));
  await session.win.keyboard.press("Enter");
  for (let step = 0; step < 100; step += 1) {
    if ((await modifiedTopLine(session)) >= line) {
      break;
    }
    await session.win.keyboard.press("Control+ArrowDown");
  }
  // 先頭の行が 300 ms 変わらなくなるまで待つ
  let last = await modifiedTopLine(session);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await session.win.waitForTimeout(300);
    const current = await modifiedTopLine(session);
    if (current === last) {
      return current;
    }
    last = current;
  }
  throw new Error("エディタのスクロールが止まらない");
}

/** 差分のプレビューのタブ */
export function diffPreviewTab(session: VscodeSession) {
  return session.win.locator('.tab[aria-label*="差分プレビュー a.md"]');
}

/** 差分のプレビューのタブが 1 つだけあることを確かめる */
export async function expectOneDiffPreviewTab(
  session: VscodeSession,
): Promise<void> {
  await expect(diffPreviewTab(session)).toHaveCount(1);
}
