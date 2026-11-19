import { type Browser, chromium, type Page } from "playwright";
import { expect, inject, onTestFinished } from "vitest";
import { CONNECT_TIMEOUT_MS } from "./storybook-setup.ts";

// ストーリーを開く画面の大きさ（狭い幅で折り返しを確認する）
const VIEWPORT = { width: 420, height: 360 };

/** ストーリーを開く画面の大きさ */
export type Viewport = { width: number; height: number };

/** テストファイルの間で使用する、共有の Chromium への接続と切断 */
export function createBrowserHolder(): {
  launch: () => Promise<void>;
  close: () => Promise<void>;
  openStory: (id: string, viewport?: Viewport) => Promise<Page>;
} {
  let browser: Browser | undefined;
  return {
    // storybook-setup.ts がプロジェクトで 1 つ起動し、温めを済ませた Chromium に接続する
    launch: async () => {
      browser = await chromium.connect(inject("browserWsEndpoint"), {
        timeout: CONNECT_TIMEOUT_MS,
      });
    },
    // 接続だけを切る（Chromium は storybook-setup.ts が閉じる）
    close: async () => {
      await browser?.close();
    },
    // ストーリーを単独で開き、部品が描かれるまで待つ。開いたページはテストの終わりに閉じる
    openStory: async (id, viewport = VIEWPORT) => {
      if (!browser) {
        throw new Error("ブラウザに接続していない");
      }
      const page = await browser.newPage({ viewport });
      // テストの中で閉じたページを閉じ直しても失敗しない
      onTestFinished(() => page.close());
      await page.goto(
        `${inject("storybookUrl")}/iframe.html?id=${id}&viewMode=story`,
      );
      // 部品の HTML のストーリーは `.mdmark`、VS Code の React の部品は `.mdmark-panel-part` を根に持つ
      await page.waitForSelector(
        "#storybook-root .mdmark, #storybook-root .mdmark-panel-part",
      );
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

/** ページ座標の細い帯を撮り、指定した色（`rgb(r, g, b)`）と同じ色の画素の数を返却する */
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

/** 色の式を、`selector` に該当する要素の中で解決した computed の色の文字列にする（`.mdmark` の中だけで決まる CSS 変数を解決する） */
export function resolveColorIn(
  page: Page,
  selector: string,
  expression: string,
): Promise<string> {
  return page.evaluate(
    ({ selector, value }) => {
      const host = document.querySelector(selector) ?? document.body;
      const probe = document.createElement("span");
      probe.style.color = value;
      host.append(probe);
      const resolved = getComputedStyle(probe).color;
      probe.remove();
      return resolved;
    },
    { selector, value: expression },
  );
}

/** 2 つの `rgb(r, g, b)` の色のコントラスト比（WCAG 2） */
export function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const [r, g, b] = (color.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
  };
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** `selector` に該当する要素のうち表示した文字を持つものごとの、文字の色（SVG の文字は `fill`）と、その下の面（透明なら外側の要素の面）の色のコントラスト比 */
export const textContrastsOf = async (
  page: Page,
  selector: string,
): Promise<{ id: string; ratio: number }[]> => {
  const pairs = await page.locator(selector).evaluateAll((elements) => {
    // computed の色（`rgb()`・`rgba()`・`color(srgb …)`）を、`rgb(r, g, b)` と不透明度にする
    const channels = (color: string): { rgb: string; alpha: number } => {
      const values = (color.match(/[\d.]+/g) ?? []).map(Number);
      const scale = color.startsWith("color(") ? 255 : 1;
      const [r = 0, g = 0, b = 0] = values.map((value) => value * scale);
      const translucent = color.includes("/") || color.startsWith("rgba");
      return {
        rgb: `rgb(${r}, ${g}, ${b})`,
        alpha: translucent ? (values[3] ?? 1) : 1,
      };
    };
    const named = elements.filter((element) => {
      const text =
        element.querySelector(".mdmark-diagram-node-name") ?? element;
      return text.checkVisibility() && text.textContent?.trim() !== "";
    });
    return named.map((element) => {
      const text =
        element.querySelector(".mdmark-diagram-node-name") ?? element;
      let surface: Element | null = element;
      let background = channels(getComputedStyle(element).backgroundColor);
      while (background.alpha === 0 && surface?.parentElement) {
        surface = surface.parentElement;
        background = channels(getComputedStyle(surface).backgroundColor);
      }
      return {
        id:
          element.getAttribute("data-node") ??
          element.getAttribute("data-group") ??
          element.getAttribute("data-wire") ??
          element.getAttribute("data-wire-mark") ??
          "",
        text: channels(
          text instanceof SVGElement
            ? getComputedStyle(text).fill
            : getComputedStyle(text).color,
        ).rgb,
        surface: background.alpha === 0 ? "rgb(255, 255, 255)" : background.rgb,
      };
    });
  });
  return pairs.map(({ id, text, surface }) => ({
    id,
    ratio: contrastRatio(text, surface),
  }));
};

/** 色の式を、明るい配色の `.mdmark` の中で解決した computed の色の文字列にする */
export function resolveLightColor(
  page: Page,
  expression: string,
): Promise<string> {
  return page.evaluate((value) => {
    const host = document.createElement("div");
    host.className = "mdmark mdmark-theme-light";
    const probe = document.createElement("span");
    probe.style.color = value;
    host.append(probe);
    document.body.append(host);
    const resolved = getComputedStyle(probe).color;
    host.remove();
    return resolved;
  }, expression);
}

/** map の閉じたグループの、ノード・タイトルの行・数の行の矩形と数の行の文字 */
export function closedGroupRows(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const box = (target: Element | null) => {
      const rect = target?.getBoundingClientRect();
      return {
        top: rect?.top ?? Number.NaN,
        bottom: rect?.bottom ?? Number.NaN,
        left: rect?.left ?? Number.NaN,
        right: rect?.right ?? Number.NaN,
      };
    };
    const count = element.querySelector(".map-closed-count");
    return {
      node: box(element),
      head: box(element.querySelector(".map-group-head")),
      count: box(count),
      text: count?.textContent ?? "",
    };
  });
}

/** 閉じたグループのタイトルの行の下に数の行があり、2 つの行が重ならず、どちらもノードに収まるかを確かめる */
export async function expectCountBelowTitle(
  page: Page,
  selector: string,
  text: string,
): Promise<void> {
  const rows = await closedGroupRows(page, selector);
  expect(rows.text).toBe(text);
  expect(rows.count.top).toBeGreaterThanOrEqual(rows.head.bottom - 0.5);
  expect(rows.head.top).toBeGreaterThanOrEqual(rows.node.top - 0.5);
  expect(rows.count.bottom).toBeLessThanOrEqual(rows.node.bottom + 0.5);
}

/** 要素の矩形（ページの座標） */
export type Box = { left: number; top: number; right: number; bottom: number };

/** 辺が接するだけは重ならない扱いで、2 つの矩形が重なるか */
export const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

/** 押せる要素の大きさの下限（WCAG 2.5.8・axe の target-size） */
export const MIN_TARGET_SIZE = 24;

/** セレクタに該当する押せる要素が 1 つ以上あり、どれも幅と高さが MIN_TARGET_SIZE 以上かを確認する */
export async function expectTargetSize(
  page: Page,
  selector: string,
): Promise<void> {
  const sizes = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.width).toBeGreaterThanOrEqual(MIN_TARGET_SIZE);
    expect(size.height).toBeGreaterThanOrEqual(MIN_TARGET_SIZE);
  }
}

/** map の図の、同じ向きの区間が同じ直線の上で重なる 2 本の線の組（「{線} と {線}」。同じ点から出る・入る線の端の区間は除く） */
export function mapWireOverlaps(page: Page): Promise<string[]> {
  return page
    .locator(".map-wire-hits > .map-wire-hit[data-wire]")
    .evaluateAll((paths) => {
      type Segment = {
        wire: string;
        from: [number, number];
        to: [number, number];
      };
      const pointsOf = (path: Element) =>
        [
          ...(path.getAttribute("d") ?? "").matchAll(
            /[ML](-?[\d.]+) (-?[\d.]+)/g,
          ),
        ].map(
          (match) => [Number(match[1]), Number(match[2])] as [number, number],
        );
      const ends = new Map<string, number>();
      for (const points of paths.map(pointsOf))
        for (const end of [points[0], points.at(-1)])
          if (end) ends.set(`${end}`, (ends.get(`${end}`) ?? 0) + 1);
      const sharedEnd = (end: [number, number]) =>
        (ends.get(`${end}`) ?? 0) > 1;
      const segments: Segment[] = paths.flatMap((path) => {
        const points = pointsOf(path);
        const last = points.length - 2;
        return points
          .slice(1)
          .map((to, index) => ({
            wire: path.getAttribute("data-wire") ?? "",
            from: points[index] as [number, number],
            to,
            index,
          }))
          .filter(
            (segment) =>
              !(segment.index === 0 && sharedEnd(segment.from)) &&
              !(segment.index === last && sharedEnd(segment.to)),
          );
      });
      const axisOf = (s: Segment): number | undefined => {
        if (s.from[1] === s.to[1] && s.from[0] !== s.to[0]) return 0;
        if (s.from[0] === s.to[0] && s.from[1] !== s.to[1]) return 1;
        return undefined;
      };
      const overlap = (a: Segment, b: Segment): number => {
        const axis = axisOf(a);
        if (axis === undefined || axis !== axisOf(b)) return 0;
        const other = 1 - axis;
        if (Math.abs(a.from[other] - b.from[other]) > 0.5) return 0;
        const low = (s: Segment) => Math.min(s.from[axis], s.to[axis]);
        const high = (s: Segment) => Math.max(s.from[axis], s.to[axis]);
        return Math.min(high(a), high(b)) - Math.max(low(a), low(b));
      };
      const pairs = new Set<string>();
      for (const [index, a] of segments.entries())
        for (const b of segments.slice(index + 1))
          if (a.wire !== b.wire && overlap(a, b) > 1)
            pairs.add(`${a.wire} と ${b.wire}`);
      return [...pairs];
    });
}
