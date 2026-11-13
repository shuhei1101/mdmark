import { execFile } from "node:child_process";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

const execFileAsync = promisify(execFile);

/** CLI を子プロセスで実行した結果 */
export type CliResult = {
  /** 終了コード */
  code: number;
  /** 標準出力 */
  stdout: string;
  /** 標準エラー */
  stderr: string;
};

/** 画像の見本: 1 ピクセルの PNG */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 動画・音声・GIF の見本（モックの見本のファイル） */
const MEDIA_SAMPLE_DIR = fileURLToPath(
  new URL("../../docs/mock/refs/263/assets/media/", import.meta.url),
);

/** 見本の動画（mp4）・音声（mp3）・動く GIF の中身を読み込む */
export async function readMediaSamples(): Promise<{
  mp4: Buffer;
  mp3: Buffer;
  gif: Buffer;
}> {
  const [mp4, mp3, gif] = await Promise.all(
    ["demo.mp4", "voice.mp3", "build.gif"].map((name) =>
      readFile(join(MEDIA_SAMPLE_DIR, name)),
    ),
  );
  return { mp4: mp4 as Buffer, mp3: mp3 as Buffer, gif: gif as Buffer };
}

/** 外部ライブラリの代役: `draw` でマーカーの場所の文字を `drawn:` と `options.items` を `,` で結んだものにする */
export const TEST_LIB_SOURCE = `export function draw(slot, options) {
  slot.textContent = "drawn:" + options.items.join(",");
}
`;

/** 拡張の代役: `draw` でマーカーの場所の文字を `greet:` と `options.target` にする */
export const GREET_SOURCE = `export default {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot, value) {
      slot.textContent = "greet:" + value.options.target;
    },
  }),
};
`;

/** 拡張の代役: `load` の中で同じフォルダの `greet-text.js` を動的 `import()` で読み込み、マーカーの場所の文字を `greet:` と読み込んだ文字と `options.target` にする */
export const GREET_WITH_IMPORT_SOURCE = `export default {
  name: "greet",
  directive: "greet",
  load: async () => {
    const { TEXT } = await import("./greet-text.js");
    return {
      draw(slot, value) {
        slot.textContent = "greet:" + TEXT + ":" + value.options.target;
      },
    };
  },
};
`;

/** 項目の表をビューのマーカーで囲んだ本文 */
export const VIEW_SOURCE = [
  '<!-- view: {"board": {"group": {"column": "状態"}}} -->',
  "",
  "| タイトル | 状態 |",
  "| --- | --- |",
  "| a | 未着手 |",
  "| b | 完了 |",
  "",
  "<!-- /view -->",
].join("\n");

/** 色分けのライブラリの本体と `typescript` のモジュールを、`vendor/highlightjs/es/` の下のファイルの中身にして返却する */
export async function readHighlightVendor(): Promise<Record<string, string>> {
  const vendor: Record<string, string> = {};
  for (const file of ["core.min.js", "languages/typescript.min.js"]) {
    vendor[`vendor/highlightjs/es/${file}`] = await readFile(
      fileURLToPath(
        new URL(
          `../../node_modules/@highlightjs/cdn-assets/es/${file}`,
          import.meta.url,
        ),
      ),
      "utf8",
    );
  }
  return vendor;
}

/** 利用側の CSS の見本: 角丸の変数を上書きする */
export const THEME_SOURCE = ".mdmark { --mdmark-radius: 0px; }\n";

/** 端末の設定を持たないことにする `MDMARK_CONFIG`（無いファイル）。開発者の端末の設定をテストに混ぜない */
export const NO_SETTINGS = join(
  tmpdir(),
  "mdmark-integration-no-settings.yaml",
);

/** ビルドした `dist/cli.js` を、`cwd` で子プロセスとして実行する。終了コードが 0 以外でも例外を投げず、結果を返却する。`env` で環境変数を追加する（`MDMARK_CONFIG` の既定は `NO_SETTINGS`） */
export async function runCli(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): Promise<CliResult> {
  const cli = join(inject("builtRoot"), "dist", "cli.js");
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cli, ...args],
      { cwd, env: { ...process.env, MDMARK_CONFIG: NO_SETTINGS, ...env } },
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

/** テストごとに作った一時フォルダを削除する。一時フォルダを作る関数を返却する */
export function useTempDirs(): () => Promise<string> {
  const created: string[] = [];
  afterEach(async () => {
    await Promise.all(
      created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });
  return async () => {
    const dir = await mkdtemp(join(tmpdir(), "mdmark-integration-cli-"));
    created.push(dir);
    return dir;
  };
}

/** フォルダの下にファイルを書き込む（親のフォルダは作る） */
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

/** フォルダで git を 1 回呼び、標準出力を返却する */
export async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

/** 最初のコミットに付けるタグの名前 */
export const BASE_TAG = "base";

/** 文書 `a`・`b` が互いを `change_together` で記載した索引の中身 */
const CHANGE_TOGETHER_INDEX = [
  "schema: 2",
  "docs:",
  "  - id: a",
  "    path: a.mark.md",
  "    title: A",
  "    related:",
  "      - to: b",
  "        type: change_together",
  "        when: 索引の Schema を変えるとき",
  "  - id: b",
  "    path: b.mark.md",
  "    title: B",
  "    related:",
  "      - to: a",
  "        type: change_together",
  "        when: 索引の Schema を変えるとき",
  "",
].join("\n");

/**
 * `mdmark init` の雛形に、互いを `change_together` で記載した文書 `a`・`b` を追加した git のフォルダを作る。
 * 全てをコミットしてタグ `base` を付け、その後 `a.mark.md` だけを書き換えてコミットする
 */
export async function createChangeTogetherDir(
  createTempDir: () => Promise<string>,
): Promise<string> {
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  await writeFiles(dir, {
    "a.mark.md": "# A\n",
    "b.mark.md": "# B\n",
    "index.yaml": CHANGE_TOGETHER_INDEX,
  });
  await git(dir, "init", "-q");
  await git(dir, "config", "user.email", "test@example.com");
  await git(dir, "config", "user.name", "test");
  await git(dir, "config", "commit.gpgsign", "false");
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "最初のコミット");
  await git(dir, "tag", BASE_TAG);
  await writeFiles(dir, { "a.mark.md": "# A\n\n書き換えた。\n" });
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "a を書き換える");
  return dir;
}

/** 標準出力・標準エラーを行に分ける（空行は除く） */
export function linesOf(text: string): string[] {
  return text.split("\n").filter((line) => line !== "");
}

/** 書き出した HTML を、1 つだけ空のフォルダへコピーして file:// で開いた結果 */
export type OpenedHtml = {
  /** 開いたページ */
  page: Page;
  /** 開いてから今までの、ページ自身（開いた HTML）と `blob:`・`data:` のほかへの要求の URL */
  externalRequests: () => string[];
};

/** テストファイルの間で使用する、Chromium の起動と終了と、書き出した HTML を開く関数を返却する */
export function useBrowser(createTempDir: () => Promise<string>): {
  openHtml: (
    htmlFile: string,
    size?: { width: number; height: number },
  ) => Promise<OpenedHtml>;
  openWithFiles: (htmlFile: string, filesDir: string) => Promise<OpenedHtml>;
  openWithCsp: (htmlFile: string) => Promise<CspOpenedHtml>;
} {
  let browser: Browser | undefined;
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });
  return {
    openWithCsp: async (htmlFile) => {
      if (!browser) {
        throw new Error("ブラウザを起動していない");
      }
      return openWithCsp(browser, htmlFile);
    },
    openHtml: async (htmlFile, size = { width: 1200, height: 800 }) => {
      if (!browser) {
        throw new Error("ブラウザを起動していない");
      }
      // 配布先と同じく、HTML だけを空のフォルダへコピーして開く
      const dir = await createTempDir();
      const alone = join(dir, "alone.html");
      await copyFile(htmlFile, alone);
      const page = await browser.newPage({ viewport: size });
      const pageUrl = pathToFileURL(alone).href;
      const requests: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (url !== pageUrl && !/^(?:blob|data):/.test(url)) {
          requests.push(url);
        }
      });
      await page.goto(`file://${alone}`);
      return { page, externalRequests: () => requests };
    },
    // HTML と隣のコピー先のフォルダだけを空のフォルダへコピーして開き、コピー先の下への要求も外への要求に数えない
    openWithFiles: async (htmlFile, filesDir) => {
      if (!browser) {
        throw new Error("ブラウザを起動していない");
      }
      const dir = await createTempDir();
      const html = join(dir, basename(htmlFile));
      const files = join(dir, basename(filesDir));
      await copyFile(htmlFile, html);
      await cp(filesDir, files, { recursive: true });
      const page = await browser.newPage({
        viewport: { width: 1200, height: 800 },
      });
      const pageUrl = pathToFileURL(html).href;
      const filesUrl = `${pathToFileURL(files).href}/`;
      const requests: string[] = [];
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
      await page.goto(pageUrl);
      return { page, externalRequests: () => requests };
    },
  };
}

/** `blob:` と `data:` のスクリプトを許さない CSP。動的 `import()` で読み込むスクリプトも、ページ自身のほかは許さない */
export const STRICT_SCRIPT_CSP = "script-src 'unsafe-inline'";

/** CSP のヘッダーを付けて開いたページと、CSP の違反・`blob:`・`data:` のスクリプトへの要求の記録 */
export type CspOpenedHtml = {
  /** 開いたページ */
  page: Page;
  /** 開いてから今までの CSP の違反（`securitypolicyviolation`）の、違反したディレクティブと URL */
  violations: () => Promise<string[]>;
  /** 開いてから今までの `blob:`・`data:` の URL のスクリプトへの要求 */
  inlineUrlScripts: () => string[];
  /** 開いてから今までのコンソールのエラーの文 */
  consoleErrors: () => string[];
  /** 手元のサーバーとページを閉じる */
  close: () => Promise<void>;
};

/** HTML を `STRICT_SCRIPT_CSP` のヘッダーを付けて返却する手元のサーバーを起動し、Chromium で開く */
export async function openWithCsp(
  browser: Browser,
  htmlFile: string,
): Promise<CspOpenedHtml> {
  const html = await readFile(htmlFile);
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": STRICT_SCRIPT_CSP,
    });
    response.end(html);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  const page = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  await page.addInitScript(() => {
    const store = globalThis as unknown as { __violations: string[] };
    store.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      store.__violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const inlineUrls: string[] = [];
  page.on("request", (request) => {
    if (
      /^(?:blob|data):/.test(request.url()) &&
      request.resourceType() === "script"
    ) {
      inlineUrls.push(request.url());
    }
  });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  return {
    page,
    violations: () =>
      page.evaluate(
        () =>
          (globalThis as unknown as { __violations: string[] }).__violations,
      ),
    inlineUrlScripts: () => inlineUrls,
    consoleErrors: () => errors,
    close: async () => {
      await page.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

/** mermaid（`mermaid@12.3.0` の `dist/` の ES モジュールと chunk）を `dir` の `vendor/mermaid/` に写す */
export async function copyMermaidVendor(dir: string): Promise<void> {
  const source = fileURLToPath(
    new URL("../../node_modules/mermaid/dist/", import.meta.url),
  );
  await cp(
    join(source, "mermaid.esm.min.mjs"),
    join(dir, "vendor", "mermaid", "mermaid.esm.min.mjs"),
  );
  await cp(
    join(source, "chunks", "mermaid.esm.min"),
    join(dir, "vendor", "mermaid", "chunks", "mermaid.esm.min"),
    { recursive: true },
  );
}

/** HTML の script 要素の中の動的 `import()` の呼び出しの数 */
export function countDynamicImportsInScripts(html: string): number {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => (match[1] ?? "").match(/\bimport\s*\(/g)?.length ?? 0)
    .reduce((sum, count) => sum + count, 0);
}

/** map の設定（`map.kinds` の store・`map.lines` の -.->・`map.node_fit: width`）の YAML の行 */
export const MAP_STORE_CONFIG = [
  "map:",
  "  node_fit: width",
  "  kinds:",
  "    store: { label: 保存先, icon: database, shape: rect, color: purple }",
  "  lines:",
  '    "-.->": { dash: dashed }',
  "",
].join("\n");

/** `:::store` のノードと -.-> の線を持つ map の範囲の文書 */
export const mapStoreDoc = (title: string, links = ""): string =>
  [
    `# ${title}`,
    "",
    links,
    "",
    "<!-- map -->",
    "",
    "```mermaid",
    "flowchart LR",
    '  doc[("文書")]:::store',
    '  read["読み取り"]',
    "  doc -.-> read",
    "```",
    "",
    "<!-- /map -->",
    "",
  ].join("\n");

/** 開いた HTML の map の図で、`doc` のノードの種類の行と、`doc->read` の線を読む（図とアイコンが描かれるまで待つ） */
export async function readMapStore(page: Page): Promise<{
  label: string;
  shape: string | undefined;
  color: string | undefined;
  dash: string | null;
}> {
  await page.waitForSelector(
    'article figure.mdmark-diagram[data-diagram="map"] .mdmark-diagram-node[data-node="doc"] .mdmark-diagram-node-kind svg',
    { timeout: 60_000 },
  );
  return page.evaluate(() => {
    const node = document.querySelector<HTMLElement>(
      'article figure[data-diagram="map"] .mdmark-diagram-node[data-node="doc"]',
    );
    return {
      label:
        node?.querySelector(".mdmark-diagram-node-kind")?.textContent ?? "",
      shape: node?.dataset.shape,
      color: node?.dataset.color,
      dash:
        document
          .querySelector('article .mdmark-diagram-wire[data-wire="doc->read"]')
          ?.getAttribute("stroke-dasharray") ?? null,
    };
  });
}
