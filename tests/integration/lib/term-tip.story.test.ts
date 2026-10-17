import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

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
