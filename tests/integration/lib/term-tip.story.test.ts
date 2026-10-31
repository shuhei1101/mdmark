import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

// スクリプトが動かないときも語の上に開く広い画面（狭い画面は語の直後に出す）
const WIDE_VIEWPORT = { width: 1280, height: 800 };

beforeAll(holder.launch);
afterAll(holder.close);

/** ツールチップと語の画面に対する上端・下端 */
function tipAndTermRects(page: Page) {
  return page.evaluate(() => {
    const tip = document.querySelector(".mdmark-term-tip");
    const term = document.querySelector(".mdmark-term");
    if (!tip || !term) {
      throw new Error("ツールチップか語が無い");
    }
    const t = tip.getBoundingClientRect();
    const w = term.getBoundingClientRect();
    return {
      tipTop: t.top,
      tipBottom: t.bottom,
      termTop: w.top,
      termBottom: w.bottom,
    };
  });
}

/** 広い画面でストーリーを開き、開いたツールチップが語の上にあり、透明な線が下側にあることを確かめる */
async function expectOpenedAbove(id: string): Promise<void> {
  const page = await holder.openStory(id, WIDE_VIEWPORT);
  const rects = await tipAndTermRects(page);
  expect(rects.tipBottom).toBeLessThanOrEqual(rects.termTop);
  const borders = await page.locator(".mdmark-term-tip").evaluate((tip) => ({
    bottom: getComputedStyle(tip).borderBlockEndColor,
    bottomWidth: parseFloat(getComputedStyle(tip).borderBlockEndWidth),
    top: getComputedStyle(tip).borderBlockStartColor,
  }));
  expect(borders.bottom).toBe("rgba(0, 0, 0, 0)");
  expect(borders.bottomWidth).toBeGreaterThan(1);
  expect(borders.top).not.toBe("rgba(0, 0, 0, 0)");
}

// 用語だけに一致した語は、意味だけを持つ role="tooltip" のツールチップを開く（TermOnly）
test("test_term_only", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--term-only");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(tip.innerText()).resolves.toContain(
    "話し合いの記録を置くフォルダ",
  );
  await expect(
    tip.locator(".mdmark-term-tip-heading").allInnerTexts(),
  ).resolves.toEqual(["用語"]);
  const term = page.locator(".mdmark-term");
  await expect(term.getAttribute("tabindex")).resolves.toBe("0");
  await expect(term.getAttribute("aria-describedby")).resolves.toBe("tip-term");
  await expectOpenedAbove("parts-termtip--term-only");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 文書の別名だけに一致した語は、関連文書だけを持つ role="group" のツールチップを開く（DocsOnly）
test("test_docs_only", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--docs-only");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("group");
  await expect(tip.getAttribute("aria-label")).resolves.toBe(
    "「公開関数」の関連文書",
  );
  await expect(
    tip.locator(".mdmark-term-tip-heading").allInnerTexts(),
  ).resolves.toEqual(["関連文書"]);
  await expect(tip.locator("a").getAttribute("href")).resolves.toBe(
    "../api.md",
  );
  await expect(
    tip.locator(".mdmark-term-tip-doc-desc").innerText(),
  ).resolves.toBe("mount・render などの公開関数と引数の一覧");
  await expect(
    tip.locator(".mdmark-term-tip-docs").getAttribute("role"),
  ).resolves.toBe("list");
  await expect(
    page.locator(".mdmark-term").getAttribute("aria-details"),
  ).resolves.toBe("tip-docs");
  await expectOpenedAbove("parts-termtip--docs-only");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 用語にも文書の別名にも一致した語は、用語 → 関連文書の順に並ぶ（Both）
test("test_both", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--both");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("group");
  await expect(
    tip.locator(".mdmark-term-tip-heading").allInnerTexts(),
  ).resolves.toEqual(["用語", "関連文書"]);
  const term = page.locator(".mdmark-term");
  await expect(term.getAttribute("aria-details")).resolves.toBe("tip-both");
  const meaningId = await term.getAttribute("aria-describedby");
  expect(meaningId).toBe("tip-both-meaning");
  await expect(
    page.locator(`[id="tip-both-meaning"]`).innerText(),
  ).resolves.toBe("文書と用語を並べた YAML のファイル");
  await expectOpenedAbove("parts-termtip--both");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 上に収まらず語の下に開いた状態は、is-below が付き、ツールチップが語の下、透明な線が上側にある（Below）
test("test_below", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--below", WIDE_VIEWPORT);
  // 検証
  const wrap = page.locator(".mdmark-term-wrap");
  await expect(wrap.getAttribute("class")).resolves.toContain("is-below");
  const rects = await tipAndTermRects(page);
  expect(rects.tipTop).toBeGreaterThanOrEqual(rects.termBottom);
  const borders = await page.locator(".mdmark-term-tip").evaluate((tip) => ({
    top: getComputedStyle(tip).borderBlockStartColor,
    topWidth: parseFloat(getComputedStyle(tip).borderBlockStartWidth),
    bottom: getComputedStyle(tip).borderBlockEndColor,
  }));
  expect(borders.top).toBe("rgba(0, 0, 0, 0)");
  expect(borders.topWidth).toBeGreaterThan(1);
  expect(borders.bottom).not.toBe("rgba(0, 0, 0, 0)");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 関連文書が高さの上限を超えるときは、ツールチップの中をスクロールする（ManyDocs）
test("test_many_docs", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--many-docs");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.locator(".mdmark-term-tip-doc").count()).resolves.toBe(7);
  const sizes = await tip.evaluate((element) => ({
    scroll: element.scrollHeight,
    client: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  expect(sizes.overflowY).toBe("auto");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 意味が長いときは、幅の上限で折り返す（LongMeaning）
test("test_long_meaning", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--long-meaning");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  const box = await tip.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    maxWidth: parseFloat(getComputedStyle(element).maxWidth),
  }));
  expect(box.width).toBeLessThanOrEqual(box.maxWidth + 1);
  const lines = await tip
    .locator(".mdmark-term-tip-meaning")
    .evaluate((element) => element.getClientRects().length);
  expect(lines).toBeGreaterThanOrEqual(1);
  const meaningHeight = await tip
    .locator(".mdmark-term-tip-meaning")
    .evaluate((element) => element.getBoundingClientRect().height);
  const lineHeight = await tip
    .locator(".mdmark-term-tip-meaning")
    .evaluate((element) => parseFloat(getComputedStyle(element).lineHeight));
  expect(meaningHeight).toBeGreaterThan(lineHeight * 1.5);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 開く前は破線の下線だけが出て、ツールチップは隠れ、ポインターとフォーカスで開く（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--closed");
  // 検証
  const term = page.locator(".mdmark-term");
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.isVisible()).resolves.toBe(false);
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationLine),
  ).resolves.toBe("underline");
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationStyle),
  ).resolves.toBe("dashed");
  // スクリプトが動かなくても、ポインターを乗せると開く
  await term.hover();
  await expect(tip.isVisible()).resolves.toBe(true);
  await page.mouse.move(0, 300);
  await expect(tip.isVisible()).resolves.toBe(false);
  // フォーカスでも開く
  await term.focus();
  await expect(tip.isVisible()).resolves.toBe(true);
});

// やめた言い方は、波線のマーカーと、見出し「代わりの用語」だけの role="tooltip" のツールチップを開く（Avoided）
test("test_avoided", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--avoided");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(
    tip.locator(".mdmark-term-tip-heading").allInnerTexts(),
  ).resolves.toEqual(["代わりの用語"]);
  const replacement = tip.locator(".mdmark-term-tip-replacement");
  await expect(replacement.innerText()).resolves.toBe("ワークスペース");
  await expect(
    replacement.evaluate((element) => getComputedStyle(element).fontWeight),
  ).resolves.toBe("600");
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("話し合いの記録を置くフォルダ");
  const term = page.locator(".mdmark-term");
  await expect(term.getAttribute("class")).resolves.toBe(
    "mdmark-term mdmark-term-avoided",
  );
  await expect(term.getAttribute("tabindex")).resolves.toBe("0");
  await expect(term.getAttribute("aria-describedby")).resolves.toBe(
    "tip-avoided",
  );
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationStyle),
  ).resolves.toBe("wavy");
  await expectOpenedAbove("parts-termtip--avoided");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 開く前は波線の下線だけが出て、ツールチップは隠れ、ポインターとフォーカスで開く（AvoidedClosed）
test("test_avoided_closed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--avoided-closed");
  // 検証
  const term = page.locator(".mdmark-term");
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.isVisible()).resolves.toBe(false);
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationLine),
  ).resolves.toBe("underline");
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationStyle),
  ).resolves.toBe("wavy");
  // スクリプトが動かなくても、ポインターを乗せると開く
  await term.hover();
  await expect(tip.isVisible()).resolves.toBe(true);
  await page.mouse.move(0, 300);
  await expect(tip.isVisible()).resolves.toBe(false);
  // フォーカスでも開く
  await term.focus();
  await expect(tip.isVisible()).resolves.toBe(true);
});

/** ストーリーのツールチップの区分の見出しを並べて返す */
function tipHeadings(page: Page): Promise<string[]> {
  return page
    .locator(".mdmark-term-tip .mdmark-term-tip-heading")
    .allInnerTexts();
}

// term のエイリアスは、「用語」の区分に名前と説明を持つ role="tooltip" のツールチップを開く（AliasTerm）
test("test_alias_term", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-term");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.isVisible()).resolves.toBe(true);
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(tipHeadings(page)).resolves.toEqual(["用語"]);
  await expect(tip.locator(".mdmark-term-tip-name").innerText()).resolves.toBe(
    "レビュー",
  );
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("変更を別の人が確かめること");
  const term = page.locator(".mdmark-term");
  await expect(term.getAttribute("class")).resolves.toBe("mdmark-term");
  await expect(term.getAttribute("aria-describedby")).resolves.toBe(
    "tip-alias-term",
  );
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationStyle),
  ).resolves.toBe("dashed");
  await expectOpenedAbove("parts-termtip--alias-term");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// doc のエイリアスは、「文書」の区分に名前と概要を持つ role="tooltip" のツールチップを開く（AliasDoc）
test("test_alias_doc", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-doc");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(tipHeadings(page)).resolves.toEqual(["文書"]);
  await expect(tip.locator(".mdmark-term-tip-name").innerText()).resolves.toBe(
    "設計書",
  );
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("仕様を記載した文書");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// command のエイリアスは、「コマンド」の区分に名前・説明・コマンドとコピーのボタン・実行場所を持つ role="group" のツールチップを開く（AliasCommand）
test("test_alias_command", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-command");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("group");
  await expect(tip.getAttribute("aria-label")).resolves.toBe(
    "「単体テスト」のコマンド",
  );
  await expect(tipHeadings(page)).resolves.toEqual(["コマンド"]);
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("ライブラリ本体の単体テストを流す");
  await expect(tip.locator("code").innerText()).resolves.toBe(
    "npm run test:unit",
  );
  await expect(tip.innerText()).resolves.toContain("実行場所");
  await expect(tip.innerText()).resolves.toContain("リポジトリの直下");
  const button = tip.locator("button.mdmark-term-tip-copy");
  await expect(button.getAttribute("type")).resolves.toBe("button");
  await expect(button.getAttribute("data-state")).resolves.toBe("idle");
  await expect(button.innerText()).resolves.toBe("コピー");
  await expect(button.locator("svg").count()).resolves.toBe(1);
  const term = page.locator(".mdmark-term");
  await expect(term.getAttribute("aria-details")).resolves.toBe(
    "tip-alias-command",
  );
  await expect(term.getAttribute("aria-describedby")).resolves.toBe(
    "tip-alias-command-meaning",
  );
  await expect(tip.locator('[role="status"]').innerText()).resolves.toBe("");
  await expectOpenedAbove("parts-termtip--alias-command");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// コマンドをコピーした状態は、ボタンが「コピーしました」と読み上げの要素の文を持つ（AliasCommandCopied）
test("test_alias_command_copied", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-command-copied");
  // 検証
  const button = page.locator(".mdmark-term-tip button.mdmark-term-tip-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("copied");
  await expect(button.innerText()).resolves.toBe("コピーしました");
  await expect(
    page.locator('.mdmark-term-tip [role="status"]').textContent(),
  ).resolves.toBe("コマンドをコピーしました");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// コマンドをコピーできなかった状態は、ボタンが「コピーできませんでした」と読み上げの要素の文を持つ（AliasCommandFailed）
test("test_alias_command_failed", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-command-failed");
  // 検証
  const button = page.locator(".mdmark-term-tip button.mdmark-term-tip-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("failed");
  await expect(button.innerText()).resolves.toBe("コピーできませんでした");
  await expect(
    page.locator('.mdmark-term-tip [role="status"]').textContent(),
  ).resolves.toBe("コマンドをコピーできませんでした");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 長いコマンドは、コマンドの面の幅で折り返し、ツールチップの幅の上限を超えない（AliasCommandLong）
test("test_alias_command_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-command-long");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  const box = await tip.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    maxWidth: parseFloat(getComputedStyle(element).maxWidth),
  }));
  expect(box.width).toBeLessThanOrEqual(box.maxWidth + 1);
  const command = tip.locator(".mdmark-term-tip-command");
  const commandBox = await command.evaluate((element) => ({
    right: element.getBoundingClientRect().right,
    tipRight:
      element.closest(".mdmark-term-tip")?.getBoundingClientRect().right ?? 0,
  }));
  expect(commandBox.right).toBeLessThanOrEqual(commandBox.tipRight);
  const code = tip.locator("code");
  const lineHeight = await code.evaluate((element) =>
    parseFloat(getComputedStyle(element).lineHeight),
  );
  const height = await code.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(height).toBeGreaterThan(lineHeight * 1.5);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// url のエイリアスは、「URL」の区分に名前・説明・URL の文字のリンクを持つ role="group" のツールチップを開く（AliasUrl）
test("test_alias_url", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-url");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("group");
  await expect(tip.getAttribute("aria-label")).resolves.toBe(
    "「課題の一覧」の URL",
  );
  await expect(tipHeadings(page)).resolves.toEqual(["URL"]);
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("Issue を並べたページ");
  const link = tip.locator("a.mdmark-term-tip-link");
  await expect(link.innerText()).resolves.toBe(
    "https://github.com/shuhei1101/mdmark/issues",
  );
  await expect(link.getAttribute("href")).resolves.toBe(
    "https://github.com/shuhei1101/mdmark/issues",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 長い URL は、リンクの文字を 1 行に収めて末尾を「...」で省略する（AliasUrlLong）
test("test_alias_url_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-url-long");
  // 検証
  const link = page.locator(".mdmark-term-tip a.mdmark-term-tip-link");
  const style = await link.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      whiteSpace: computed.whiteSpace,
      textOverflow: computed.textOverflow,
      overflow: computed.overflow,
      truncated: element.scrollWidth > element.clientWidth,
      height: element.getBoundingClientRect().height,
      lineHeight: parseFloat(computed.lineHeight),
    };
  });
  expect(style.whiteSpace).toBe("nowrap");
  expect(style.textOverflow).toBe("ellipsis");
  expect(style.overflow).toBe("hidden");
  expect(style.truncated).toBe(true);
  expect(style.height).toBeLessThan(style.lineHeight * 1.5);
  await expect(link.getAttribute("href")).resolves.toContain(
    "?plain=1#L12-L48",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// http・https でない URL は、リンクにせず文字で出し、role="tooltip" になる（AliasUrlNotHttp）
test("test_alias_url_not_http", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-url-not-http");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(tip.locator("a").count()).resolves.toBe(0);
  await expect(
    tip.locator("span.mdmark-term-tip-link").innerText(),
  ).resolves.toBe("javascript:alert(1)");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 説明が空の skill のエイリアスは、説明を出さず、名前とスキル名の等幅の 1 行だけを出す（AliasSkill）
test("test_alias_skill", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-skill");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(tipHeadings(page)).resolves.toEqual(["スキル"]);
  await expect(tip.locator(".mdmark-term-tip-meaning").count()).resolves.toBe(
    0,
  );
  const code = tip.locator("code.mdmark-term-tip-code");
  await expect(code.innerText()).resolves.toBe("mindstella:session");
  await expect(
    code.evaluate((element) => getComputedStyle(element).fontFamily),
  ).resolves.toMatch(/mono/i);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// tool のエイリアスは、「ツール」の区分に名前・説明・ツール名の等幅の 1 行を出す（AliasTool）
test("test_alias_tool", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-tool");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tipHeadings(page)).resolves.toEqual(["ツール"]);
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("設定と索引のずれを返す");
  await expect(
    tip.locator("code.mdmark-term-tip-code").innerText(),
  ).resolves.toBe("check");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// path のエイリアスは、「パス」の区分に名前・説明・パスの等幅の 1 行を出す（AliasPath）
test("test_alias_path", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-path");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tipHeadings(page)).resolves.toEqual(["パス"]);
  await expect(
    tip.locator(".mdmark-term-tip-meaning").innerText(),
  ).resolves.toBe("機能のオン・オフと読む文書を記載する");
  await expect(
    tip.locator("code.mdmark-term-tip-code").innerText(),
  ).resolves.toBe("mdmark.config.yaml");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// avoid の種類のエイリアスは、波線の下線を引き、「代わりの用語」の区分に置き換え先の語だけを出す（AliasAvoid）
test("test_alias_avoid", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-termtip--alias-avoid");
  // 検証
  const tip = page.locator(".mdmark-term-tip");
  await expect(tip.getAttribute("role")).resolves.toBe("tooltip");
  await expect(tipHeadings(page)).resolves.toEqual(["代わりの用語"]);
  await expect(
    tip.locator(".mdmark-term-tip-replacement").innerText(),
  ).resolves.toBe("ワークスペース");
  await expect(tip.locator(".mdmark-term-tip-meaning").count()).resolves.toBe(
    0,
  );
  const term = page.locator(".mdmark-term");
  await expect(term.getAttribute("class")).resolves.toBe(
    "mdmark-term mdmark-term-avoided",
  );
  await expect(
    term.evaluate((element) => getComputedStyle(element).textDecorationStyle),
  ).resolves.toBe("wavy");
  await expect(pageOverflows(page)).resolves.toBe(false);
});
