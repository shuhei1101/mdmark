import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 行の種類ごとの地の色と、行頭の印 */
async function readLines(id: string) {
  const page = await holder.openStory(id);
  const info = await page.evaluate(() => {
    const kinds = (kind: string) => [
      ...document.querySelectorAll(`.mdmark-diff-line[data-kind="${kind}"]`),
    ];
    const background = (kind: string) => {
      const [line] = kinds(kind);
      return line ? getComputedStyle(line).backgroundColor : undefined;
    };
    const words = (tag: string) =>
      [...document.querySelectorAll(`${tag}.mdmark-diff-word`)].map(
        (element) => element.textContent,
      );
    return {
      same: background("same"),
      del: background("del"),
      add: background("add"),
      delSign: kinds("del")[0]?.querySelector(".mdmark-diff-sign")?.textContent,
      addSign: kinds("add")[0]?.querySelector(".mdmark-diff-sign")?.textContent,
      signHidden: kinds("del")[0]
        ?.querySelector(".mdmark-diff-sign")
        ?.getAttribute("aria-hidden"),
      delName: kinds("del")[0]?.querySelector(".mdmark-visually-hidden")
        ?.textContent,
      addName: kinds("add")[0]?.querySelector(".mdmark-visually-hidden")
        ?.textContent,
      delWords: words("del"),
      insWords: words("ins"),
      group: document
        .querySelector(".mdmark-diff-lines")
        ?.getAttribute("aria-label"),
    };
  });
  return { page, info };
}

// 削除した行は赤、追加した行は緑で、対の行は変わった語だけを濃い色にする（Normal）
test("test_normal", async () => {
  // 準備・実行
  const { page, info } = await readLines("parts-difflines--normal");
  // 検証
  expect(info.group).toBe("変更の行");
  expect(info.del).not.toBe(info.same);
  expect(info.add).not.toBe(info.same);
  expect(info.del).not.toBe(info.add);
  expect(info.delSign).toBe("-");
  expect(info.addSign).toBe("+");
  expect(info.signHidden).toBe("true");
  expect(info.delName).toBe("削除した行: ");
  expect(info.addName).toBe("追加した行: ");
  expect(info.delWords).toEqual(["差分"]);
  expect(info.insWords).toEqual(["変更"]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 語の区切りを持たないブラウザの結果は、1 文字ずつ比べた語が濃い色になる（CharByChar）
test("test_char_by_char", async () => {
  // 準備・実行
  const { info } = await readLines("parts-difflines--char-by-char");
  // 検証
  expect(info.delWords.join("")).toBe("差分");
  expect(info.insWords.join("")).toBe("変更");
});

// 長い URL を持つ行は、行の中で折り返し、横スクロールを出さない（LongLine）
test("test_long_line", async () => {
  // 準備・実行
  const { page } = await readLines("parts-difflines--long-line");
  // 検証
  const lines = await page.evaluate(() => {
    const line = document.querySelector(".mdmark-diff-line") as HTMLElement;
    return {
      height: line.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(line).lineHeight),
    };
  });
  expect(lines.height).toBeGreaterThan(lines.lineHeight * 1.5);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 行の塊の間に、変えた埋め込んだ HTML の範囲が 1 つ入る（WithHtml）
test("test_with_html", async () => {
  // 準備・実行
  const { info, page } = await readLines("parts-difflines--with-html");
  // 検証
  expect(info.delWords.length).toBeGreaterThan(0);
  const range = page.locator(".mdmark-diff-html");
  await expect(range.count()).resolves.toBe(1);
  await expect(
    range.locator(".mdmark-diff-html-label").innerText(),
  ).resolves.toBe("HTML");
  await expect(
    range.locator('[aria-label="HTML の見方"] button').count(),
  ).resolves.toBe(2);
});
