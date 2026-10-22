import { join } from "node:path";
import type { Page } from "@playwright/test";
import {
  expect,
  openStandalone,
  runCli,
  THEME_SOURCE,
  test,
  writeFiles,
} from "../cli.ts";
import {
  destroyHandles,
  installCommentStore,
  mountDocument,
  mountViewInPage,
  openPage,
  readCommentCalls,
  selectText,
} from "../dist-page.ts";
import { VIEW_COLUMNS, VIEW_ITEMS, viewMarkdown } from "../view-samples.ts";

// 本文の段落の文字
const PARAGRAPH = "描いた文書の見た目はテーマの変数で変える。";

// 読む人が入力欄に書く本文
const COMMENT_BODY = "ここは <b>太字</b> にしたい";

/** 描いた文書の中のビューの、ボードの列の見出しの値を、並びの順に返す */
function columnNames(page: Page): Promise<string[]> {
  return page.locator(".mdmark-view-column-name").allTextContents();
}

/** 表形式のビューの隠れていない本文の行の、指定した列（1 から）の文字を上から並べて返す */
function tableColumn(page: Page, column: number): Promise<string[]> {
  return page
    .locator(
      `.mdmark-view-table tbody tr:not([hidden]):not(.mdmark-table-empty) td:nth-child(${column})`,
    )
    .allTextContents();
}

/** 表形式のビューの担当の列の絞り込みで、名前を 1 つ選ぶ */
async function filterByAssignee(page: Page, name: string): Promise<void> {
  await page
    .locator(".mdmark-view-table th", { hasText: "担当" })
    .locator("button.mdmark-filter")
    .click();
  await page
    .locator(".mdmark-filter-drawer")
    .getByLabel(name, { exact: true })
    .check();
}

// ビューで見渡し、表形式を列で絞り込み、本文の箇所にコメントを付けて開く（正常シナリオ）
test("test_normal", async ({ page, builtRoot }) => {
  // 準備
  await openPage(page, builtRoot);
  await installCommentStore(page);
  await mountDocument(page, {
    markdown: viewMarkdown("group=状態 filter=担当", PARAGRAPH),
    config: { features: { comments: true } },
    docId: "guide",
    useCommentStore: true,
  });
  // 検証: ボード表示
  await expect(page.locator("#doc .mdmark-view-board")).toBeVisible();
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  // 実行・検証: 表形式に切り替える
  await page
    .locator('#doc .mdmark-view-switch-item[data-mode="table"]')
    .click();
  expect(await tableColumn(page, 1)).toHaveLength(5);
  // 実行・検証: 担当の列を絞り込む
  await filterByAssignee(page, "佐藤");
  expect(await tableColumn(page, 3)).toEqual(["佐藤", "佐藤"]);
  // 実行: 本文の段落の文字を選んでコメントを書き、保存する
  await expect
    .poll(async () => (await readCommentCalls(page)).load.length)
    .toBe(1);
  await selectText(page, { selector: "#doc > p", start: 10, end: 16 });
  await page.locator(".mdmark-comment-add").click();
  const form = page.locator(".mdmark-comment-form");
  await form.locator("textarea").fill(COMMENT_BODY);
  await form.getByRole("button", { name: "コメントを保存" }).click();
  // 検証
  const mark = page.locator("#doc mark.mdmark-comment-mark");
  await expect(mark).toHaveText("テーマの変数");
  const saved = (await readCommentCalls(page)).save;
  expect(saved).toHaveLength(1);
  expect(saved[0]?.comment.quote).toBe("テーマの変数");
  expect(saved[0]?.comment.body).toBe(COMMENT_BODY);
  // 実行: 印からコメントを開く
  await mark.click();
  // 検証
  await expect(
    page.locator(".mdmark-comment-bubble .mdmark-comment-body"),
  ).toHaveText(COMMENT_BODY);
});

// 書き出した 1 枚の HTML を外への要求なしで開き、ビューを切り替えて列で絞り込む（正常シナリオ（書き出した HTML で探す））
test("test_normal_when_exported", async ({ page, builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "theme: theme.css\n",
    "theme.css": THEME_SOURCE,
    "guide.md": viewMarkdown("group=状態 filter=担当", PARAGRAPH),
  });
  // 実行
  const result = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "out/guide.html"],
    dir,
  );
  // 検証
  expect(result.code).toBe(0);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "out", "guide.html"),
  });
  await expect(page.locator(".mdmark-view-board")).toBeVisible();
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  // 実行
  await page.locator('.mdmark-view-switch-item[data-mode="table"]').click();
  // 検証
  expect(await tableColumn(page, 1)).toHaveLength(5);
  // 実行
  await filterByAssignee(page, "鈴木");
  // 検証
  expect(await tableColumn(page, 3)).toEqual(["鈴木", "鈴木"]);
  expect(opened.externalRequests()).toEqual([]);
  expect(opened.pageErrors()).toEqual([]);
});

// 使う側の JavaScript から描いたビューを列で絞り込み、片付けの関数で要素を空にする（正常シナリオ（使う側の JavaScript から描く））
test("test_normal_when_called_from_javascript", async ({ page, builtRoot }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  const result = await mountViewInPage(page, {
    columns: VIEW_COLUMNS,
    items: VIEW_ITEMS,
    group: "状態",
    filter: { 担当: "select" },
  });
  // 検証
  expect(result.error).toBeNull();
  await expect(page.locator("#doc .mdmark-view-board")).toBeVisible();
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  // 実行
  await page
    .locator('#doc .mdmark-view-switch-item[data-mode="table"]')
    .click();
  await filterByAssignee(page, "佐藤");
  // 検証
  expect(await tableColumn(page, 3)).toEqual(["佐藤", "佐藤"]);
  // 実行
  await destroyHandles(page);
  // 検証
  await expect(page.locator("#doc")).toBeEmpty();
});
