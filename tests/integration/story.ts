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

/** 色の式（CSS 変数・color-mix など）を、ページの中で解決した computed の色の文字列にする */
export function resolveColor(page: Page, expression: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.color = value;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, expression);
}

/** ページ座標の細い帯を撮り、指定した色（`rgb(r, g, b)`）と同じ色の画素の数を返す */
export async function countColorPixels(options: {
  page: Page;
  clip: { x: number; y: number; width: number; height: number };
  color: string;
}): Promise<number> {
  const target = (options.color.match(/\d+/g) ?? []).slice(0, 3).map(Number);
  const png = await options.page.screenshot({
    clip: options.clip,
    fullPage: true,
  });
  return options.page.evaluate(
    async ({ data, rgb }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context?.drawImage(image, 0, 0);
      const pixels = context?.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let index = 0; index < (pixels?.data.length ?? 0); index += 4) {
        // 圧縮や端数の位置で 1〜2 ずれた画素も同じ色として数える
        const near = rgb.every(
          (value, channel) =>
            Math.abs((pixels?.data[index + channel] ?? 0) - value) <= 2,
        );
        if (near) {
          count += 1;
        }
      }
      return count;
    },
    { data: png.toString("base64"), rgb: target },
  );
}

/** ページが横にはみ出しているか（横スクロールが出るか） */
export function pageOverflows(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}
