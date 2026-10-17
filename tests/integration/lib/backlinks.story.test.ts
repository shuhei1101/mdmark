import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 2 件の関連文書を、題「関連文書」の一覧で並べる（Two）
test("test_two", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-backlinks--two");
  // 検証
  const nav = page.locator("nav.mdmark-backlinks");
  await expect(nav.getAttribute("aria-labelledby")).resolves.toBe(
    "backlinks-two",
  );
  await expect(page.locator("#backlinks-two").innerText()).resolves.toBe(
    "関連文書",
  );
  const links = await nav
    .locator("li a")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => [
        anchor.getAttribute("href"),
        anchor.textContent,
      ]),
    );
  expect(links).toEqual([
    ["../api.md", "API"],
    ["../使い方/guide.md", "使い方"],
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 1 件の関連文書も、同じ一覧で並べる（One）
test("test_one", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-backlinks--one");
  // 検証
  const nav = page.locator("nav.mdmark-backlinks");
  await expect(nav.getAttribute("aria-labelledby")).resolves.toBe(
    "backlinks-one",
  );
  await expect(nav.locator("li").count()).resolves.toBe(1);
  await expect(nav.locator("li a").getAttribute("href")).resolves.toBe(
    "../api.md",
  );
});

// 題が長い文書は折り返し、一覧は枠の中に収まる（Long）
test("test_long", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-backlinks--long");
  // 検証
  const nav = page.locator("nav.mdmark-backlinks");
  await expect(nav.locator("li").count()).resolves.toBe(5);
  const lines = await nav
    .locator("li:nth-child(3) a")
    .evaluate((element) => element.getClientRects().length);
  expect(lines).toBeGreaterThan(1);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
