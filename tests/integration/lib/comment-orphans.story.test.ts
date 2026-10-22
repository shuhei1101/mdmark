import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 見つからないコメントを、選んだ文字と本文の組で並べ、HTML に見える本文は文字のまま出す（Default）
test("test_default", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-commentorphans--default");
  // 検証
  const section = page.locator("section.mdmark-comment-orphans");
  await expect(section.getAttribute("aria-labelledby")).resolves.toBe(
    "story-orphans",
  );
  await expect(section.locator("h2#story-orphans").innerText()).resolves.toBe(
    "箇所が見つからないコメント",
  );
  await expect(
    section.locator(".mdmark-comment-orphans-lead").innerText(),
  ).resolves.toBe("本文が書き換わり、コメントを付けた文字が見つかりません。");
  await expect(
    section.locator(".mdmark-comment-quote").allInnerTexts(),
  ).resolves.toEqual([
    "「テーマの変数」へのコメント",
    "「角丸は 6px」へのコメント",
  ]);
  await expect(
    section.locator(".mdmark-comment-body").allInnerTexts(),
  ).resolves.toEqual([
    "ここは <b>太字</b> にしたい",
    "角丸は 6px のままでよいと思います。",
  ]);
  await expect(section.locator("li b").count()).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// コメントが空のときは、何も出さない（Empty）
test("test_empty", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-commentorphans--empty");
  // 検証
  await expect(page.locator(".mdmark-comment-orphans").count()).resolves.toBe(
    0,
  );
  await expect(page.locator("#storybook-root").innerText()).resolves.toBe("");
});
