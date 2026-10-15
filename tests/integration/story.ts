import { type Browser, chromium, type Page } from "playwright";
import { inject } from "vitest";

// ストーリーを開く画面の大きさ（狭い幅で折り返しを見る）
const VIEWPORT = { width: 420, height: 360 };

/** テストファイルの間で使う、Chromium の起動と終了 */
export function createBrowserHolder(): {
  launch: () => Promise<void>;
  close: () => Promise<void>;
  openStory: (id: string) => Promise<Page>;
} {
  let browser: Browser | undefined;
  const pages: Page[] = [];
  return {
    launch: async () => {
      browser = await chromium.launch();
    },
    close: async () => {
      await browser?.close();
    },
    // ストーリーを単独で開き、部品が描かれるまで待つ
    openStory: async (id) => {
      if (!browser) {
        throw new Error("ブラウザを起動していない");
      }
      const page = await browser.newPage({ viewport: VIEWPORT });
      pages.push(page);
      await page.goto(
        `${inject("storybookUrl")}/iframe.html?id=${id}&viewMode=story`,
      );
      await page.waitForSelector("#storybook-root .mdmark");
      return page;
    },
  };
}

/** ページが横にはみ出しているか（横スクロールが出るか） */
export function pageOverflows(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}
