import { copyFile, cp, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";
import type { OpenedHtml } from "./cli.ts";
import { PAGE_URL } from "./dist-page.ts";

/** 動画・音声・GIF の見本（モックの見本のファイル） */
const MEDIA_SAMPLE_DIR = fileURLToPath(
  new URL("../../dev/mock/refs/263/assets/media/", import.meta.url),
);

/** 見本の動画（mp4）・音声（mp3）・無限ループで間隔が 100ms の GIF・動画の poster の画像（png） */
export type MediaSamples = {
  mp4: Buffer;
  mp3: Buffer;
  gif: Buffer;
  poster: Buffer;
};

/** 見本の動画・音声・GIF・poster の画像の中身を読む */
export async function readMediaSamples(): Promise<MediaSamples> {
  const [mp4, mp3, gif, poster] = await Promise.all(
    ["demo.mp4", "voice.mp3", "build.gif", "demo-poster.png"].map((name) =>
      readFile(join(MEDIA_SAMPLE_DIR, name)),
    ),
  );
  return {
    mp4: mp4 as Buffer,
    mp3: mp3 as Buffer,
    gif: gif as Buffer,
    poster: poster as Buffer,
  };
}

/** 手元の応答で返すファイルの中身と種類 */
export type PageFile = { body: string | Buffer; contentType: string };

/** 指定した大きさと色で塗った SVG の画像 */
export function colorSvg(options: {
  width: number;
  height: number;
  color: string;
}): PageFile {
  const { width, height, color } = options;
  return {
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`,
    contentType: "image/svg+xml",
  };
}

/** ページのオリジンの下のファイル（文書からの相対パス）への要求を、手元の応答に差し替える */
export async function routePageFiles(
  page: Page,
  files: Record<string, PageFile>,
): Promise<void> {
  for (const [path, file] of Object.entries(files)) {
    await page.route(new URL(path, PAGE_URL).href, (route) =>
      route.fulfill({ body: file.body, contentType: file.contentType }),
    );
  }
}

/** 2 つの `rgb(r, g, b)` の色のコントラスト比（WCAG 2） */
export function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light = 0, dark = 0] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light + 0.05) / (dark + 0.05);
}

/** `selector` の要素の中で色の式（`var(--mdmark-...)` など）を解決した computed の色を返す */
export async function resolveColor(
  page: Page,
  selector: string,
  expression: string,
): Promise<string> {
  return page.locator(selector).evaluate((element, value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    element.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, expression);
}

/** 書き出した HTML と隣のコピー先のフォルダだけを空のフォルダへ写し、file:// で開く。コピー先の下への要求は外への要求に数えない */
export async function openStandaloneWithFiles(
  page: Page,
  options: {
    /** 一時フォルダを作る関数 */
    tempDir: () => Promise<string>;
    /** 書き出した HTML */
    htmlFile: string;
    /** 動画・音声をコピーしたフォルダ */
    filesDir: string;
  },
): Promise<OpenedHtml> {
  const dir = await options.tempDir();
  const html = join(dir, basename(options.htmlFile));
  const files = join(dir, basename(options.filesDir));
  await copyFile(options.htmlFile, html);
  await cp(options.filesDir, files, { recursive: true });
  const pageUrl = pathToFileURL(html).href;
  const filesUrl = `${pathToFileURL(files).href}/`;
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    const url = request.url().split("#")[0] ?? "";
    if (
      url !== pageUrl &&
      !url.startsWith(filesUrl) &&
      !/^(?:blob|data):/.test(url)
    ) {
      requests.push(url);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pageUrl);
  return { externalRequests: () => requests, pageErrors: () => errors };
}
