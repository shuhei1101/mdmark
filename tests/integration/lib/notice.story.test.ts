import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 図の印の外部ライブラリを読めない知らせの枠は、題が「この図を表示できません」になる（Figure）
test("test_figure", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-notice--figure");
  // 検証
  const notice = page.locator(".mdmark-notice");
  await expect(notice.getAttribute("role")).resolves.toBe("status");
  await expect(page.locator(".mdmark-notice-title").innerText()).resolves.toBe(
    "この図を表示できません",
  );
  await expect(notice.locator("p code").innerText()).resolves.toBe("chart");
  await expect(notice.locator("p").innerText()).resolves.toBe(
    "表示に使うライブラリ（chart）を読み込めませんでした。ネットワークにつながっているかを確かめて、ページを読み込み直してください。",
  );
});

// 図でない印の知らせの枠は、題が「この箇所を表示できません」になる（Block）
test("test_block", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-notice--block");
  // 検証
  await expect(page.locator(".mdmark-notice-title").innerText()).resolves.toBe(
    "この箇所を表示できません",
  );
  await expect(page.locator(".mdmark-notice p code").innerText()).resolves.toBe(
    "tabs",
  );
});

// 印の名前が枠の幅を超えても、名前が枠の中で折り返し、横スクロールが出ない（LongName）
test("test_long_name", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-notice--long-name");
  // 検証
  const layout = await page.evaluate(() => {
    const notice = document.querySelector(".mdmark-notice");
    const code = document.querySelector(".mdmark-notice code");
    if (!notice || !code) {
      throw new Error("知らせの枠が描かれていない");
    }
    const noticeBox = notice.getBoundingClientRect();
    const codeBoxes = [...code.getClientRects()];
    return {
      codeLines: codeBoxes.length,
      codeOutside: codeBoxes.some(
        (box) => box.right > noticeBox.right || box.left < noticeBox.left,
      ),
      pageOverflows:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    };
  });
  expect(layout.codeLines).toBeGreaterThan(1);
  expect(layout.codeOutside).toBe(false);
  expect(layout.pageOverflows).toBe(false);
});
