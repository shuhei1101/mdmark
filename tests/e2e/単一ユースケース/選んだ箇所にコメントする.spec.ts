import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  installCommentStore,
  mountDocument,
  openPage,
  readCommentCalls,
  removeDistRoot,
  selectText,
  updateDocument,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 文書の ID
const DOC_ID = "guide";

// コメントを付ける段落の文字
const PARAGRAPH = "描いた文書の見た目はテーマの変数で変える。";

// 読む人が入力欄に書く本文
const COMMENT_BODY = "ここは <b>太字</b> にしたい";

// `テーマの変数` を選ぶ範囲（段落の最初の文字の節の中の位置）
const SELECTION = { selector: "#doc p", start: 10, end: 16 };

// コメントの機能をオンにした設定
const COMMENTS_ON = { features: { comments: true } };

// `テーマの変数` に付いた、保存済みのコメント
const SAVED_COMMENT = {
  id: "c1",
  quote: "テーマの変数",
  prefix: "描いた文書の見た目は",
  suffix: "で変える。",
  body: "保存したコメント",
};

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** ページの `console.error` の出力を控える。引数の `Error` はメッセージにして 1 つの文字にする。戻り値の関数で、これまでに出た文字を返す */
function collectConsoleErrors(page: Page): () => Promise<string[]> {
  const pending: Array<Promise<string>> = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      pending.push(
        Promise.all(
          message
            .args()
            .map((arg) =>
              arg.evaluate((value) =>
                value instanceof Error ? value.message : String(value),
              ),
            ),
        ).then((texts) => texts.join(" ")),
      );
    }
  });
  return () => Promise.all(pending);
}

/** `テーマの変数` を選び、コメントのボタンを押して入力欄を開き、本文を書く */
async function openFormAndType(page: Page, body: string) {
  await selectText(page, SELECTION);
  await page.locator(".mdmark-comment-add").click();
  const form = page.locator(".mdmark-comment-form");
  await expect(form).toBeVisible();
  await form.locator("textarea").fill(body);
  return form;
}

// 文字を選んでコメントを保存し、印から吹き出しを開いて Esc で閉じる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await installCommentStore(page);
  await mountDocument(page, {
    markdown: `${PARAGRAPH}\n`,
    config: COMMENTS_ON,
    docId: DOC_ID,
    useCommentStore: true,
  });
  await expect
    .poll(async () => (await readCommentCalls(page)).load)
    .toEqual([{ docId: DOC_ID }]);
  const button = page.locator(".mdmark-comment-add");
  // 実行・検証: 文字を選ぶとボタンが出て、選びを外すと消える
  await selectText(page, SELECTION);
  await expect(button).toBeVisible();
  await selectText(page, null);
  await expect(button).toBeHidden();
  // 実行: 選び直してコメントを書いて保存する
  const form = await openFormAndType(page, COMMENT_BODY);
  await form.getByRole("button", { name: "コメントを保存" }).click();
  // 検証
  const mark = page.locator("#doc mark.mdmark-comment-mark");
  await expect(mark).toHaveText("テーマの変数");
  expect((await readCommentCalls(page)).save).toEqual([
    {
      docId: DOC_ID,
      comment: {
        quote: "テーマの変数",
        prefix: "描いた文書の見た目は",
        suffix: "で変える。",
        body: COMMENT_BODY,
      },
    },
  ]);
  await expect(mark).toBeFocused();
  // 実行: Enter で吹き出しを開く
  await page.keyboard.press("Enter");
  // 検証
  const bubble = page.locator(".mdmark-comment-bubble");
  await expect(bubble).toBeVisible();
  await expect(bubble.locator(".mdmark-comment-body")).toHaveText(COMMENT_BODY);
  await expect(bubble.locator("b")).toHaveCount(0);
  // 実行・検証: Esc で閉じる
  await page.keyboard.press("Escape");
  await expect(bubble).toBeHidden();
});

// 保存したコメントを描いた時点で印に付け、印を押して吹き出しを開く（正常シナリオ（保存したコメントを読み込む））
test("test_normal_when_loaded", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await installCommentStore(page, { loaded: [SAVED_COMMENT] });
  // 実行
  await mountDocument(page, {
    markdown: `${PARAGRAPH}\n`,
    config: COMMENTS_ON,
    docId: DOC_ID,
    useCommentStore: true,
  });
  // 検証
  const mark = page.locator("#doc mark.mdmark-comment-mark");
  await expect(mark).toHaveText("テーマの変数");
  // 実行
  await mark.click();
  // 検証
  await expect(
    page.locator(".mdmark-comment-bubble .mdmark-comment-body"),
  ).toHaveText("保存したコメント");
});

// 描き直した後も同じ文字に印を付け直し、文字が無いコメントは末尾の一覧に並べる（正常シナリオ（描き直した後に付き直す））
test("test_normal_when_updated", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await installCommentStore(page, { loaded: [SAVED_COMMENT] });
  await mountDocument(page, {
    markdown: `${PARAGRAPH}\n`,
    config: COMMENTS_ON,
    docId: DOC_ID,
    useCommentStore: true,
  });
  const mark = page.locator("#doc mark.mdmark-comment-mark");
  await expect(mark).toHaveText("テーマの変数");
  // 実行: 段落を足して描き直す
  await updateDocument(page, `別の段落\n\n${PARAGRAPH}\n`);
  // 検証
  await expect(mark).toHaveText("テーマの変数");
  // 実行: 選んだ文字を書き換えて描き直す
  await updateDocument(page, "描いた文書の見た目は CSS 変数 で変える。\n");
  // 検証
  const orphans = page.locator("#doc .mdmark-comment-orphans");
  await expect(orphans).toBeVisible();
  await expect(page.locator("#doc mark")).toHaveCount(0);
  await expect(orphans).toContainText("テーマの変数");
  await expect(orphans).toContainText("保存したコメント");
  await expect(orphans).toContainText("箇所が見つからないコメント");
  expect(
    await page
      .locator("#doc")
      .evaluate((doc) => doc.lastElementChild?.className ?? ""),
  ).toContain("mdmark-comment-orphans");
});

// comments を指定しない設定では、読み書きの関数を渡してもボタンを出さず、読み込みも呼ばない（正常シナリオ（機能を外す））
test("test_normal_when_disabled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await installCommentStore(page);
  await mountDocument(page, {
    markdown: `${PARAGRAPH}\n`,
    docId: DOC_ID,
    useCommentStore: true,
  });
  // 実行
  await selectText(page, SELECTION);
  await page.waitForTimeout(300);
  // 検証
  await expect(page.locator(".mdmark-comment-add")).toHaveCount(0);
  expect((await readCommentCalls(page)).load).toEqual([]);
});

// 保存が失敗したときは、入力欄と本文を残して知らせ、印を付けず、理由を console.error に出す（異常シナリオ（保存できない））
test("test_error_when_save_failed", async ({ page }) => {
  // 準備
  const errors = collectConsoleErrors(page);
  await openPage(page, builtRoot);
  await installCommentStore(page, { failSave: true });
  await mountDocument(page, {
    markdown: `${PARAGRAPH}\n`,
    config: COMMENTS_ON,
    docId: DOC_ID,
    useCommentStore: true,
  });
  await expect
    .poll(async () => (await readCommentCalls(page)).load.length)
    .toBe(1);
  const form = await openFormAndType(page, COMMENT_BODY);
  // 実行
  await form.getByRole("button", { name: "コメントを保存" }).click();
  // 検証
  await expect(form.getByRole("alert")).toHaveText(
    /^コメントを保存できませんでした。/,
  );
  await expect(form).toBeVisible();
  await expect(form.locator("textarea")).toHaveValue(COMMENT_BODY);
  await expect(page.locator("#doc mark")).toHaveCount(0);
  const logged = await errors();
  expect(logged).toHaveLength(1);
  expect(logged[0]).toContain("network");
});

// 読み書きの関数を渡さないときは、ボタンを出さず、必要なことを console.error に 1 回だけ出す（異常シナリオ（読み書きの関数が無い））
test("test_error_when_store_missing", async ({ page }) => {
  // 準備
  const errors = collectConsoleErrors(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${PARAGRAPH}\n`,
    config: COMMENTS_ON,
    docId: DOC_ID,
  });
  await expect(page.locator("#doc p")).toHaveText(PARAGRAPH);
  await selectText(page, SELECTION);
  await page.waitForTimeout(300);
  // 検証
  await expect(page.locator(".mdmark-comment-add")).toHaveCount(0);
  const logged = await errors();
  expect(logged).toHaveLength(1);
  expect(logged[0]).toContain("commentStore");
});
