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

/** 縦の中ほどを比べる相手。選んだ文字の印（`mark`）か、CSS セレクタで指す要素（`selector`） */
type LineTarget = { mark: string } | { selector: string };

/** 相手の最初の行の縦の中ほどと、選んだ文字の余白のマーカーの縦の中ほどの差（px） */
async function middleGap(page: Page, quote: string, target: LineTarget) {
  return page.evaluate(
    ({ quote, target }) => {
      const marker = [
        ...document.querySelectorAll<HTMLElement>(
          "#doc .mdmark-comment-margin .mdmark-comment-marker",
        ),
      ].find((el) => el.getAttribute("aria-label")?.includes(`「${quote}」`));
      const line =
        "mark" in target
          ? [
              ...document.querySelectorAll("#doc mark.mdmark-comment-mark"),
            ].find((mark) => mark.textContent === target.mark)
          : document.querySelector(target.selector);
      if (!marker || !line) {
        return Number.POSITIVE_INFINITY;
      }
      const lineRect = line.getClientRects()[0] ?? line.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      return Math.abs(
        lineRect.top +
          lineRect.height / 2 -
          (markerRect.top + markerRect.height / 2),
      );
    },
    { quote, target },
  );
}

/** 選んだ文字の印を包む閉じた要素を `aria-controls` で指す開くボタンの CSS セレクタ */
async function openerSelector(page: Page, quote: string) {
  const id = await page
    .locator("#doc mark.mdmark-comment-mark", { hasText: quote })
    .evaluate((mark) => mark.closest("[hidden]")?.id ?? "");
  return `#doc [aria-controls="${id}"]`;
}

// 余白に置くマーカーと縦の中ほどを比べるときの許容差（px）
const MIDDLE_TOLERANCE = 1;

// 画面の高さを超える段落の後に、閉じたセクション・2 つのタブ・`テーマの変数` の段落を並べた文書
const MARGIN_MARKDOWN = [
  ...Array.from(
    { length: 40 },
    (_, i) => `間の段落 ${i + 1} は、画面の高さを超えるまで並べる本文。\n`,
  ),
  "## 補足",
  "",
  "<!-- section: closed -->",
  "",
  "閉じた中の閉じた箇所を読む。",
  "",
  "## 手順",
  "",
  "<!-- tabs -->",
  "",
  "### macOS",
  "",
  "macOS の手順",
  "",
  "### Windows",
  "",
  "Windows のタブの箇所を読む。",
  "",
  "<!-- /tabs -->",
  "",
  PARAGRAPH,
  "",
].join("\n");

/** 前後の文字を持たない、選んだ文字だけのコメント */
function quoteComment(id: string, quote: string) {
  return { id, quote, prefix: "", suffix: "", body: `${quote}へのコメント` };
}

// 余白のマーカーを押して印へ移り、幅の変化とタブの切り替えでマーカーを置き直す（正常シナリオ（余白のマーカーから移る））
test("test_normal_when_jumped_from_margin", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await installCommentStore(page, {
    loaded: [
      quoteComment("c1", "テーマの変数"),
      quoteComment("c2", "閉じた箇所"),
      quoteComment("c3", "タブの箇所"),
      quoteComment("c4", "無い文字"),
    ],
  });
  // 実行
  await mountDocument(page, {
    markdown: MARGIN_MARKDOWN,
    config: COMMENTS_ON,
    docId: DOC_ID,
    useCommentStore: true,
  });
  // 検証: 本文の右の余白に、箇所が見つかったコメントのマーカーだけが出る
  const margin = page.locator("#doc .mdmark-comment-margin");
  const themeMarker = margin.getByRole("button", {
    name: "コメント 「テーマの変数」",
    exact: true,
  });
  await expect(themeMarker).toHaveCount(1);
  await expect(margin.getByRole("button", { name: /無い文字/ })).toHaveCount(0);
  const themeMark = page.locator("#doc mark.mdmark-comment-mark", {
    hasText: "テーマの変数",
  });
  await expect
    .poll(() => middleGap(page, "テーマの変数", { mark: "テーマの変数" }))
    .toBeLessThanOrEqual(MIDDLE_TOLERANCE);
  // 検証: 閉じた中の箇所のマーカーは、開くボタンの行に破線で出る
  const closedMarker = margin.getByRole("button", {
    name: "コメント 「閉じた箇所」（閉じたセクションの中）",
  });
  const tabMarker = margin.getByRole("button", {
    name: "コメント 「タブの箇所」（選ばれていないタブの中）",
  });
  await expect(closedMarker).toHaveAttribute("data-closed", "section");
  await expect(tabMarker).toHaveAttribute("data-closed", "tab");
  await expect(closedMarker).toHaveCSS("border-top-style", "dashed");
  await expect(tabMarker).toHaveCSS("border-top-style", "dashed");
  const sectionOpener = await openerSelector(page, "閉じた箇所");
  const tabOpener = await openerSelector(page, "タブの箇所");
  await expect
    .poll(() => middleGap(page, "閉じた箇所", { selector: sectionOpener }))
    .toBeLessThanOrEqual(MIDDLE_TOLERANCE);
  await expect
    .poll(() => middleGap(page, "タブの箇所", { selector: tabOpener }))
    .toBeLessThanOrEqual(MIDDLE_TOLERANCE);
  // 実行: 余白のマーカーを押す
  await themeMarker.click();
  // 検証: 印が画面に入り、吹き出しが開く
  const bubble = page.locator(".mdmark-comment-bubble");
  await expect(themeMark).toBeInViewport();
  await expect(bubble).toBeVisible();
  await expect(bubble.locator(".mdmark-comment-body")).toHaveText(
    "テーマの変数へのコメント",
  );
  // 実行: 吹き出しを閉じ、マーカーにフォーカスして Enter を押す
  await page.keyboard.press("Escape");
  await expect(bubble).toBeHidden();
  await themeMarker.focus();
  await page.keyboard.press("Enter");
  // 検証
  await expect(bubble).toBeVisible();
  await page.keyboard.press("Escape");
  // 実行: 描く先の要素の幅を狭める
  await page.locator("#doc").evaluate((el) => {
    el.style.width = "360px";
  });
  // 検証: 折り返し直した印の行の高さへ置き直す
  await expect
    .poll(() => middleGap(page, "テーマの変数", { mark: "テーマの変数" }))
    .toBeLessThanOrEqual(MIDDLE_TOLERANCE);
  // 実行: 閉じたセクションの見出しの行のマーカーを押す
  await closedMarker.click();
  // 検証: セクションが開き、印まで移って吹き出しが開く
  const closedMark = page.locator("#doc mark.mdmark-comment-mark", {
    hasText: "閉じた箇所",
  });
  await expect(page.locator(sectionOpener)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(closedMark).toBeInViewport();
  await expect(bubble.locator(".mdmark-comment-body")).toHaveText(
    "閉じた箇所へのコメント",
  );
  await page.keyboard.press("Escape");
  // 実行: 2 つ目のタブに切り替える
  await page.locator(tabOpener).click();
  // 検証: タブの中の印の行の高さにマーカーが出る
  const shownTabMarker = margin.getByRole("button", {
    name: "コメント 「タブの箇所」",
    exact: true,
  });
  await expect(shownTabMarker).not.toHaveAttribute("data-closed");
  await expect
    .poll(() => middleGap(page, "タブの箇所", { mark: "タブの箇所" }))
    .toBeLessThanOrEqual(MIDDLE_TOLERANCE);
});
