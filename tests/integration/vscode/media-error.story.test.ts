import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 再生できない動画・音声の知らせのストーリーを開く */
async function open(id: string) {
  const page = await holder.openStory(`vscode-mediaerror--${id}`);
  return { page, notice: page.locator(".mdmark-notice") };
}

// 再生できない音声は、音声のタイトルと形式・「既定のアプリで開く」とパスを出す（Audio）
test("test_audio", async () => {
  // 準備・実行
  const { notice } = await open("audio");
  // 検証
  await expect(notice.getAttribute("role")).resolves.toBe("status");
  await expect(
    notice.locator(".mdmark-notice-title").innerText(),
  ).resolves.toBe("この音声をプレビューで再生できません");
  await expect(notice.locator("p").innerText()).resolves.toBe(
    "VS Code のプレビューは m4a の形式を再生できません。既定のアプリで開く（meeting.m4a）",
  );
  await expect(notice.locator("p code").allInnerTexts()).resolves.toEqual([
    "m4a",
    "meeting.m4a",
  ]);
  await expect(notice.locator("a").innerText()).resolves.toBe(
    "既定のアプリで開く",
  );
});

// 再生できない動画は、動画のタイトルを出す（Video）
test("test_video", async () => {
  // 準備・実行
  const { notice } = await open("video");
  // 検証
  await expect(
    notice.locator(".mdmark-notice-title").innerText(),
  ).resolves.toBe("この動画をプレビューで再生できません");
  await expect(notice.locator("p code").allInnerTexts()).resolves.toEqual([
    "webm",
    "media/demo.webm",
  ]);
});

// 長いパスは、枠の中で折り返す（LongPath）
test("test_long_path", async () => {
  // 準備・実行
  const { page, notice } = await open("long-path");
  // 検証
  const outside = await notice.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const code = element.querySelectorAll("p code")[1] as HTMLElement;
    return [...code.getClientRects()].some(
      (rect) => rect.right > box.right || rect.left < box.left,
    );
  });
  expect(outside).toBe(false);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
