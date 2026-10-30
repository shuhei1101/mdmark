import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { BLOCKS_AFTER, BLOCKS_BEFORE } from "../diff-samples.ts";
import { diffBlocks, expectBlockDiff } from "../diff-ui.ts";
import { useVscodeE2E } from "../vscode.ts";
import {
  expectOneDiffPreviewTab,
  focusModifiedSide,
  openCommitDiff,
  openDiffPreview,
  openWorkingTreeDiff,
  prepareDiffRepo,
} from "../vscode-diff.ts";

const e2e = useVscodeE2E();

/** 色を当てたブロックが描かれたプレビューのフレーム */
const BLOCK_SELECTOR = "div.mdmark-diff-block";

// Source Control の変更から開いた差分ビューの横に、変更後の文書を描いて変更を色分けする（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  // 実行
  await openDiffPreview(session);
  // 検証
  const frame = await session.frameWith(BLOCK_SELECTOR);
  await expectBlockDiff(frame);
  await expectOneDiffPreviewTab(session);
});

// タイムラインのコミットの差分ビュー（両側とも `git:` の URI）でも、同じブロックを同じ色とマーカーで出す（正常シナリオ（コミットの差分））
test("test_normal_when_commit_diff", async () => {
  // 準備
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({
      before: BLOCKS_BEFORE,
      after: BLOCKS_AFTER,
      commit: true,
    }),
  });
  await openCommitDiff(session);
  // 実行
  await openDiffPreview(session);
  // 検証
  const frame = await session.frameWith(BLOCK_SELECTOR);
  await expectBlockDiff(frame);
});

// 変更後の側を書き換えると、同じパネルで描き直し、書き足した段落が追加の色で出る（正常シナリオ（変更後の側を書き換える））
test("test_normal_when_modified_side_edited", async () => {
  // 準備
  const session = await e2e.launch({
    files: {},
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  await openDiffPreview(session);
  await expectBlockDiff(await session.frameWith(BLOCK_SELECTOR));
  // 実行: 変更後の側の末尾に段落を 1 つ書き足す
  await focusModifiedSide(session);
  await session.win.keyboard.press("Control+End");
  await session.win.keyboard.type("\n新しい段落です。");
  // 検証
  await expect
    .poll(async () => diffBlocks(await session.previewFrame(), "add").count())
    .toBe(3);
  const frame = await session.previewFrame();
  const added = diffBlocks(frame, "add");
  await expect(added.nth(0)).toContainText("よくある質問の変更は");
  await expect(added.nth(1)).toContainText("電話の問い合わせは");
  await expect(added.nth(2)).toContainText("新しい段落です。");
  await expect(diffBlocks(frame, "del")).toHaveCount(1);
  await expectOneDiffPreviewTab(session);
});

// 差分に対応しないバージョンを読むと、描けない理由と「リロード」を出し、Markdown と差分ビューは書き換えない（異常シナリオ（差分に対応しないバージョン））
test("test_error_when_version_without_diff", async () => {
  // 準備
  const session = await e2e.launch({
    files: {},
    settings: { "mdmark.version": "v0.8.0" },
    prepare: prepareDiffRepo({ before: BLOCKS_BEFORE, after: BLOCKS_AFTER }),
  });
  await openWorkingTreeDiff(session);
  // 実行
  await openDiffPreview(session);
  // 検証
  const frame = await session.previewFrame();
  const notice = frame.locator(".mdmark-preview-notice");
  await expect(notice).toContainText("v0.8.0");
  await expect(notice).toContainText("差分の表示に対応していません");
  await expect(frame.getByRole("button", { name: "リロード" })).toBeVisible();
  await expect(frame.locator(".mdmark-content")).toHaveCount(0);
  expect(await readFile(join(session.workspaceDir, "a.md"), "utf8")).toBe(
    BLOCKS_AFTER,
  );
  await expect(session.win.locator(".monaco-diff-editor")).toHaveCount(1);
});
