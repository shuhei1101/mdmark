import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  destroyDocument,
  destroyHandles,
  installCommentStore,
  mountCommentsInPage,
  mountDocument,
  mountViewInPage,
  openPage,
  readCommentCalls,
  registerTasks,
  removeDistRoot,
  selectText,
} from "../dist-page.ts";
import {
  columnCounts,
  columnNames,
  switchButton,
  tableColumn,
  VIEW_COLUMNS,
  VIEW_ITEMS,
} from "../view-samples.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 1 件目の題を `script` を含む文字に替えた項目
const ITEMS_WITH_SCRIPT = VIEW_ITEMS.map((item, index) =>
  index === 0 ? { ...item, 題: "<script>alert(1)</script>設計" } : item,
);

// コメントを付ける段落の文字
const PARAGRAPH = "導入の手順を整える。";

// 読む人が入力欄に書く本文
const COMMENT_BODY = "手順の数を <b>3</b> にする";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 要素の中にビューを描き、表形式に切り替え、片付けの関数で要素を空にする（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const dialogs: string[] = [];
  const pageErrors: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await openPage(page, builtRoot);
  // 実行
  const result = await mountViewInPage(page, {
    columns: VIEW_COLUMNS,
    items: ITEMS_WITH_SCRIPT,
    group: "状態",
  });
  // 検証: ボード表示
  expect(result.error).toBeNull();
  expect(await columnNames(page)).toEqual(["未着手", "進行中", "完了"]);
  expect(await columnCounts(page)).toEqual(["2", "2", "1"]);
  await expect(switchButton(page, "board")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#doc")).toContainText(
    "<script>alert(1)</script>設計",
  );
  await expect(page.locator("#doc script")).toHaveCount(0);
  // 実行: 表形式に切り替える
  await switchButton(page, "table").click();
  // 検証
  expect(await tableColumn(page, 1)).toEqual([
    "<script>alert(1)</script>設計",
    "余白の変数を決める",
    "印刷の見え方を確かめる",
    "配色を直す",
    "表を絞り込む",
  ]);
  await expect(page.locator("#doc .mdmark-view-table thead th")).toContainText([
    "題",
    "状態",
    "担当",
  ]);
  // 実行: 片付ける
  await destroyHandles(page);
  await page.mouse.click(5, 5);
  await page.keyboard.press("Escape");
  // 検証
  await expect(page.locator("#doc")).toBeEmpty();
  expect(dialogs).toEqual([]);
  expect(pageErrors).toEqual([]);
});

// 拡張の draw から mountView を呼び、印の場所にビューを描き、絞り込み、destroy で片付ける（正常シナリオ（拡張のモジュールから描く））
test("test_normal_when_called_from_extension", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await registerTasks(page);
  const definition = {
    columns: VIEW_COLUMNS,
    items: VIEW_ITEMS.slice(0, 3),
    group: "状態",
    filter: { 担当: "select" },
  };
  const markdown = [
    "<!-- tasks -->",
    "",
    "```json",
    JSON.stringify(definition),
    "```",
    "",
    "<!-- /tasks -->",
    "",
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown });
  // 検証
  await expect(page.locator("#doc .mdmark-view")).toBeVisible();
  await expect(page.locator("#doc .mdmark-view-card")).toHaveCount(3);
  // 実行: 表形式に切り替え、列の絞り込みで鈴木を選ぶ
  await switchButton(page, "table").click();
  await page
    .locator("#doc .mdmark-view-table th", { hasText: "担当" })
    .locator("button.mdmark-filter")
    .click();
  await page
    .locator("#doc .mdmark-filter-drawer")
    .getByLabel("鈴木", { exact: true })
    .check();
  // 検証
  expect(await tableColumn(page, 3)).toEqual(["鈴木"]);
  // 実行
  await destroyDocument(page);
  // 検証
  await expect(page.locator("#doc .mdmark-view")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-filter-drawer")).toHaveCount(0);
});

// 項目の値が配列でないときと、group が列名に無いときに、要素を書き換えずに TypeError にする（異常シナリオ（引数の誤り））
test("test_error_when_arguments_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await page.evaluate(() => {
    const el = document.querySelector("#doc");
    if (el) {
      el.textContent = "前の中身";
    }
  });
  // 実行
  const items = await mountViewInPage(page, {
    columns: VIEW_COLUMNS,
    items: "なし",
  });
  const group = await mountViewInPage(page, {
    columns: VIEW_COLUMNS,
    items: VIEW_ITEMS,
    group: "優先度",
  });
  // 検証
  expect(items.error).toMatch(/^TypeError: .*items/);
  expect(group.error).toMatch(/^TypeError: .*group/);
  await expect(page.locator("#doc")).toHaveText("前の中身");
});

// 使う側が書いた要素の選んだ箇所にコメントを付け、片付けの関数で印とボタンを外す（正常シナリオ（コメントを付ける））
test("test_normal_when_comments_attached", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await page.evaluate((text) => {
    const el = document.querySelector("#doc");
    if (el) {
      el.innerHTML = `<p>${text}</p>`;
    }
    const outside = document.createElement("p");
    outside.id = "outside";
    outside.textContent = "要素の外の段落";
    document.body.append(outside);
  }, PARAGRAPH);
  await installCommentStore(page);
  await mountCommentsInPage(page, "panel-setup");
  expect((await readCommentCalls(page)).load).toEqual([
    { docId: "panel-setup" },
  ]);
  const button = page.locator(".mdmark-comment-add");
  // 実行・検証: 要素の外の文字を選んでもボタンは出ない
  await selectText(page, { selector: "#outside", start: 0, end: 3 });
  await page.waitForTimeout(300);
  await expect(button).toBeHidden();
  // 実行・検証: 要素の中の文字を選ぶとボタンが出る
  await selectText(page, { selector: "#doc p", start: 0, end: 5 });
  await expect(button).toBeVisible();
  // 実行: コメントを書いて保存する
  await button.click();
  const form = page.locator(".mdmark-comment-form");
  await form.locator("textarea").fill(COMMENT_BODY);
  await form.getByRole("button", { name: "コメントを保存" }).click();
  // 検証
  const mark = page.locator("#doc mark.mdmark-comment-mark");
  await expect(mark).toHaveText("導入の手順");
  expect((await readCommentCalls(page)).save).toEqual([
    {
      docId: "panel-setup",
      comment: {
        quote: "導入の手順",
        prefix: "",
        suffix: "を整える。",
        body: COMMENT_BODY,
      },
    },
  ]);
  // 実行: 印からコメントを開く
  await mark.click();
  // 検証
  const bubble = page.locator(".mdmark-comment-bubble");
  await expect(bubble.locator(".mdmark-comment-body")).toHaveText(COMMENT_BODY);
  await expect(bubble.locator("b")).toHaveCount(0);
  // 実行: 片付ける
  await destroyHandles(page);
  // 検証
  await expect(page.locator("#doc mark")).toHaveCount(0);
  await expect(button).toBeHidden();
  await expect(page.locator("#doc")).toHaveText(PARAGRAPH);
  expect(await page.locator("#doc").innerHTML()).toBe(`<p>${PARAGRAPH}</p>`);
});
