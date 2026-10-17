import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { test as base, expect, type Page } from "@playwright/test";
import { buildDistRoot, removeDistRoot } from "./dist-page.ts";

export { expect };

const execFileAsync = promisify(execFile);

/** CLI を子プロセスで流した結果 */
export type CliResult = {
  /** 終了コード */
  code: number;
  /** 標準出力 */
  stdout: string;
  /** 標準エラー */
  stderr: string;
};

/** テストごとに使う道具 */
type CliFixtures = {
  /** 一時フォルダを作る関数。テストが終わると作ったフォルダを消す */
  tempDir: () => Promise<string>;
};

/** ワーカーごとに 1 回作る道具 */
type CliWorkerFixtures = {
  /** `v0.0.1` を埋めてビルドした作業ツリー（`dist/cli.js` と `templates/` を持つ） */
  builtRoot: string;
};

/** ビルドした CLI と一時フォルダを使えるようにした `test` */
export const test = base.extend<CliFixtures, CliWorkerFixtures>({
  builtRoot: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読む
    async ({}, use) => {
      const root = await buildDistRoot();
      await use(root);
      await removeDistRoot(root);
    },
    { scope: "worker" },
  ],
  // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読む
  tempDir: async ({}, use) => {
    const created: string[] = [];
    await use(async () => {
      const dir = await mkdtemp(join(tmpdir(), "mdmark-e2e-cli-"));
      created.push(dir);
      return dir;
    });
    await Promise.all(
      created.map((dir) => rm(dir, { recursive: true, force: true })),
    );
  },
});

/** ビルドした `dist/cli.js` を、`cwd` で子プロセスとして流す。終了コードが 0 以外でも例外を投げず、結果を返す */
export async function runCli(
  builtRoot: string,
  args: string[],
  cwd: string,
): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [join(builtRoot, "dist", "cli.js"), ...args],
      { cwd },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failed.code ?? -1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

/** フォルダの下にファイルを書く（親のフォルダは作る） */
export async function writeFiles(
  root: string,
  files: Record<string, string | Uint8Array>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}

/** 標準出力・標準エラーを行に分ける（空行は除く） */
export function linesOf(text: string): string[] {
  return text.split("\n").filter((line) => line !== "");
}

/** 書き出した HTML を空のフォルダへ写して file:// で開いた結果 */
export type OpenedHtml = {
  /** 開いてから今までの、ページ自身と `blob:`・`data:` のほかへの要求の URL */
  externalRequests: () => string[];
  /** ページで起きた例外のメッセージ */
  pageErrors: () => string[];
};

/** 書き出した HTML だけを空のフォルダへ写し、file:// で開く。`hash` があれば URL の `#` に付ける */
export async function openStandalone(
  page: Page,
  options: {
    /** 一時フォルダを作る関数 */
    tempDir: () => Promise<string>;
    /** 書き出した HTML */
    htmlFile: string;
    /** URL の `#`（`#` を含める） */
    hash?: string;
  },
): Promise<OpenedHtml> {
  const dir = await options.tempDir();
  const alone = join(dir, "alone.html");
  await copyFile(options.htmlFile, alone);
  const pageUrl = pathToFileURL(alone).href;
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url !== pageUrl && !/^(?:blob|data):/.test(url)) {
      requests.push(url);
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${pageUrl}${options.hash ?? ""}`);
  return { externalRequests: () => requests, pageErrors: () => errors };
}

/** 画像の見本: 1 ピクセルの PNG */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Chart.js の代役のモジュール: 印の場所に `canvas` を描く */
export const CHART_SOURCE = `export function draw(slot, args) {
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 40;
  canvas.getContext("2d").fillRect(0, 0, 20, 20);
  canvas.dataset.args = args.join(",");
  slot.replaceChildren(canvas);
}
`;

/** 使う側の CSS の見本: 角丸の変数を上書きする */
export const THEME_SOURCE = ".mdmark { --mdmark-radius: 0px; }\n";

/** 用語集の表を持つ文書の中身 */
export const GLOSSARY_DOCUMENT = [
  "# 用語集",
  "",
  "<!-- glossary: term=用語 meaning=意味 -->",
  "",
  "| 用語 | 意味 |",
  "| --- | --- |",
  "| 印 | HTML コメントで書く指定 |",
  "",
  "<!-- /glossary -->",
  "",
].join("\n");

/** 文書 3 つ（入口・用語集の表を持つ文書・Chart.js の印と画像を持つ文書）を載せた索引 */
export const THREE_DOCS_INDEX = [
  "schema: 1",
  "docs:",
  "  - id: top",
  "    path: README.md",
  "    title: 入口",
  "  - id: terms",
  "    path: 用語集.md",
  "    title: 用語集",
  "  - id: guide",
  "    path: 使い方/guide.md",
  "    title: 使い方",
  "",
].join("\n");

/** 見本の文書群を書く（`mdmark init` の後に、文書を書く人が手で書き足す分）。設定の `build` の行は `buildLines` で決める */
export async function writeSampleDocs(
  dir: string,
  options: { buildLines?: string[]; readme?: string } = {},
): Promise<void> {
  const buildLines = options.buildLines ?? [
    '  include: ["**/*.md"]',
    '  exclude: ["node_modules/**", "dist/**"]',
    '  glossary: ["用語集.md"]',
    "  entry: README.md",
    "  out: dist/docs.html",
  ];
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: index.yaml",
      "theme: theme.css",
      "libraries:",
      "  chart: lib/chart.js",
      "build:",
      ...buildLines,
      "",
    ].join("\n"),
    "index.yaml": THREE_DOCS_INDEX,
    "README.md":
      options.readme ??
      "# 入口\n\n[使い方](使い方/guide.md) を読む。\n\n印を書く。\n",
    "用語集.md": GLOSSARY_DOCUMENT,
    "使い方/guide.md":
      "# 使い方\n\n<!-- chart: a -->\n\n![図](../img/a.png)\n\n[入口へ](../README.md)\n",
    "lib/chart.js": CHART_SOURCE,
    "img/a.png": PNG_BYTES,
  });
}
