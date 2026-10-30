import { expect, test } from "@playwright/test";
import { BLOCKS_AFTER, BLOCKS_BEFORE } from "../diff-samples.ts";
import { useVscodeE2E, type VscodeSession } from "../vscode.ts";
import {
  focusModifiedSide,
  openWorkingTreeDiff,
  prepareDiffRepo,
} from "../vscode-diff.ts";

const e2e = useVscodeE2E();

const DIFF_BLOCK = "div.mdmark-diff-block";
const MODIFIED_LINES = ".monaco-diff-editor .editor.modified .view-lines";
const ORIGINAL_LINES = ".monaco-diff-editor .editor.original .view-lines";
const TITLE_BUTTON =
  '.editor-actions .action-label[aria-label*="プレビューを横に開く"]';
const PREVIEW_TAB = '.tab[aria-label*="プレビュー"]';
const SETTLE_MS = 3000;
const CONTEXT_KEYS = [
  "editorLangId",
  "resourceLangId",
  "isInDiffEditor",
  "editorFocus",
  "editorTextFocus",
];

/** Developer: Inspect Context Keys を実行して `selector` の要素を押し、コンソールに出た context key の値を返す */
const inspectContextKeys = async (
  session: VscodeSession,
  selector: string,
): Promise<string> => {
  const logs: unknown[] = [];
  session.win.on("console", async (message) => {
    for (const arg of message.args()) {
      logs.push(await arg.jsonValue().catch(() => null));
    }
  });
  await session.runCommand("Developer: Inspect Context Keys");
  await session.win.locator(selector).first().click({ force: true });
  await session.win.waitForTimeout(SETTLE_MS);
  const found = logs.find(
    (value): value is Record<string, unknown> =>
      typeof value === "object" && value !== null && "resourceLangId" in value,
  );
  if (!found) {
    return `context key のログが無い（${logs.length} 件）`;
  }
  return JSON.stringify(
    Object.fromEntries(CONTEXT_KEYS.map((key) => [key, found[key]])),
  );
};

// 差分ビューの変更後の側: context key を記録し、ボタンが出て、Shift+Alt+D で差分のパネルが開く
test("poc_modified_side", async () => {
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  console.log(
    "modified keys:",
    await inspectContextKeys(session, MODIFIED_LINES),
  );
  const dispatchLogs: string[] = [];
  session.win.on("console", (message) => {
    if (/keybinding|when clause|shift\+alt\+d/i.test(message.text())) {
      dispatchLogs.push(message.text());
    }
  });
  await session.runCommand("Developer: Toggle Keyboard Shortcuts Troubleshooting");
  await focusModifiedSide(session);
  console.log(
    "modified title button:",
    await session.win.locator(TITLE_BUTTON).count(),
  );
  console.log(
    "modified active element:",
    await session.win.evaluate(() => {
      const active = document.activeElement;
      const editor = active?.closest(".editor.original, .editor.modified");
      return `${active?.tagName}.${active?.className} in ${editor?.className ?? "none"}`;
    }),
  );
  await session.openPreviewWithShortcut();
  await session.win.waitForTimeout(SETTLE_MS);
  console.log("modified dispatch:", dispatchLogs.slice(-12).join("\n"));
  await session.frameWith(DIFF_BLOCK);
});

// 差分ビューの変更前の側: context key を記録し、Shift+Alt+D で同じ差分のパネルが開く
test("poc_original_side", async () => {
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  console.log(
    "original keys:",
    await inspectContextKeys(session, ORIGINAL_LINES),
  );
  await session.win.locator(ORIGINAL_LINES).first().click({ force: true });
  console.log(
    "original title button:",
    await session.win.locator(TITLE_BUTTON).count(),
  );
  await session.openPreviewWithShortcut();
  await session.frameWith(DIFF_BLOCK);
});

// 普通に開いた Markdown: ボタンが出て、Shift+Alt+D でプレビューが開く
test("poc_plain_markdown", async () => {
  const session = await e2e.launch({ files: { "a.md": "# 見出し\n\n本文\n" } });
  await session.openFile("a.md");
  await expect(session.win.locator(TITLE_BUTTON)).toHaveCount(1);
  await session.openPreviewWithShortcut();
  await session.previewFrame();
});

// Markdown でないエディタ: ボタンが出ず、Shift+Alt+D でパネルが開かない
test("poc_not_markdown", async () => {
  const session = await e2e.launch({ files: { "notes.txt": "メモ\n" } });
  await session.openFile("notes.txt");
  await expect(session.win.locator(TITLE_BUTTON)).toHaveCount(0);
  await session.openPreviewWithShortcut();
  await session.win.waitForTimeout(SETTLE_MS);
  await expect(session.win.locator(PREVIEW_TAB)).toHaveCount(0);
});

/** フォーカスのある要素と、それを含む差分ビューの側 */
const describeFocus = (session: VscodeSession): Promise<string> =>
  session.win.evaluate(() => {
    const active = document.activeElement;
    const side = active?.closest(".editor.original, .editor.modified");
    return `${active?.tagName}.${active?.className} in ${side?.className ?? "none"}`;
  });

// E2E と同じ操作だけで、変更後の側を押した後のフォーカスを記録する
test("poc_modified_bare", async () => {
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  console.log("bare before click:", await describeFocus(session));
  await focusModifiedSide(session);
  console.log("bare after click:", await describeFocus(session));
  await session.win
    .locator(".monaco-diff-editor .editor.modified .view-lines")
    .first()
    .click({ force: true });
  console.log("bare after force click:", await describeFocus(session));
  await session.openPreviewWithShortcut();
  await session.frameWith(DIFF_BLOCK);
});

// 変更後の側の、押した位置にある要素と、先頭の行を押したときのフォーカスを記録する
test("poc_modified_click_point", async () => {
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  await session.win.waitForTimeout(SETTLE_MS);
  console.log(
    "point:",
    await session.win.evaluate(() => {
      const lines = document.querySelector(
        ".monaco-diff-editor .editor.modified .view-lines",
      );
      const box = lines?.getBoundingClientRect();
      if (!box) {
        return "view-lines が無い";
      }
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      const chain: string[] = [];
      for (let node: Element | null = hit; node && chain.length < 6; node = node.parentElement) {
        chain.push(`${node.tagName}.${String(node.className).split(" ").slice(0, 2).join(".")}`);
      }
      return `box=${Math.round(box.left)},${Math.round(box.top)},${Math.round(box.width)}x${Math.round(box.height)} hit=${chain.join(" < ")} text=${hit?.textContent?.slice(0, 40)}`;
    }),
  );
  await session.win
    .locator(".monaco-diff-editor .editor.modified .view-line")
    .first()
    .click();
  console.log("first line click:", await describeFocus(session));
  await session.win.waitForTimeout(SETTLE_MS);
  console.log("first line click later:", await describeFocus(session));
  await session.openPreviewWithShortcut();
  await session.frameWith(DIFF_BLOCK);
});

// 差分ビューを開いた後の差分エディターの数・置き場所とタブを記録する
test("poc_diff_dom", async () => {
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  await session.win.waitForTimeout(SETTLE_MS);
  console.log(
    "dom:",
    await session.win.evaluate(() => {
      const editors = [...document.querySelectorAll(".monaco-diff-editor")];
      const describe = (element: Element): string => {
        const chain: string[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
          if (node.className && typeof node.className === "string") {
            chain.push(node.className.split(" ").slice(0, 2).join("."));
          }
        }
        const box = element.getBoundingClientRect();
        return `${Math.round(box.width)}x${Math.round(box.height)} ${chain.slice(0, 8).join(" < ")}`;
      };
      const tabs = [...document.querySelectorAll(".tab")].map((tab) =>
        tab.getAttribute("aria-label"),
      );
      return JSON.stringify({ editors: editors.map(describe), tabs }, null, 1);
    }),
  );
});

const MODIFIED_TEXT_LINES =
  ".monaco-diff-editor .editor.modified .view-lines:not(.line-delete)";

// 変更後の側の本文の行（削除した行の view zone でない）を押すと、今の when のまま Shift+Alt+D で差分のパネルが開く
test("poc_modified_text_line", async () => {
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  console.log(
    "inline view:",
    await session.win.locator(".monaco-diff-editor .editor.original").isVisible(),
    await session.win.locator(".monaco-diff-editor .view-lines.line-delete").count(),
  );
  await session.win.locator(MODIFIED_TEXT_LINES).first().click();
  console.log("text line click:", await describeFocus(session));
  await session.openPreviewWithShortcut();
  await session.frameWith(DIFF_BLOCK);
});
