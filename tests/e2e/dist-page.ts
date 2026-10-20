import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import type {
  MdmarkConfig,
  MdmarkExtension,
  MdmarkIndex,
  MdmarkIndexIssue,
  MdmarkReferences,
} from "../../src/index.ts";

const execFileAsync = promisify(execFile);

// jsDelivr の GitHub エンドポイントの、版のタグまでの URL
const CDN_BASE = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark";
// ページを返す架空のオリジン
const PAGE_URL = "https://app.example.test/";
// 外部ライブラリの代役のモジュールを返す架空の URL
export const LIB_URL = "https://libs.example.test/test-lib.js";
// 拡張の代役のモジュールを返す架空の URL
export const EXTENSION_URL = "https://libs.example.test/greet.js";
// 配布物を埋めてビルドする版
const BUILT_VERSION = "v0.0.1";
// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");
// 外部ライブラリの代役: `draw` で印の場所の文字を `drawn:` と引数を `,` で結んだものにする
const TEST_LIB_SOURCE =
  'export function draw(slot, args) { slot.textContent = "drawn:" + args.join(","); }\n';

// 拡張の代役: `draw` で印の場所の文字を `greet:` と引数を `,` で結んだものにする
const EXTENSION_SOURCE =
  'export function draw(slot, value) { slot.textContent = "greet:" + value.args.join(","); }\n';

/** 見本の Markdown: 見出し・段落・リスト・表・コードブロック・リンク・折り畳み・機能の印・スクリプト */
export const SAMPLE_MARKDOWN = [
  "<!-- features: +a -b -->",
  "",
  "# 見出し",
  "",
  "段落",
  "",
  "- 項目",
  "",
  "| 列A | 列B |",
  "| --- | ---: |",
  "| 1 | 2 |",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
  "[リンク](https://example.com/page)",
  "",
  "<details><summary>折り畳み</summary>中身</details>",
  "",
  "<script>window.__ran = true</script>",
  "",
].join("\n");

/** 描く先の要素の id */
export const DOC_SELECTOR = "#doc";

/** 索引を渡して描くときの引数 */
export type IndexOptions = {
  /** 索引 */
  index?: MdmarkIndex;
  /** 描く文書の索引の `id` */
  docId?: string;
  /** 参照の表 */
  references?: MdmarkReferences;
};

type MdmarkWindow = Window & {
  mdmark?: {
    mount: (
      el: HTMLElement,
      opts: { markdown: string; config?: MdmarkConfig } & IndexOptions,
    ) => { update: (markdown: string) => void; destroy: () => void };
    render: (
      markdown: string,
      opts?: { config?: MdmarkConfig } & IndexOptions,
    ) => string;
    registerExtension: (extension: MdmarkExtension) => void;
    collectReferences: (input: {
      index: MdmarkIndex;
      documents: Record<string, string>;
    }) => MdmarkReferences;
  };
  handle?: { update: (markdown: string) => void; destroy: () => void };
};

/** `version`（既定は `v0.0.1`）を埋めてビルドした作業ツリーを作り、その場所を返す。ビルドは入口 `node scripts/build.ts --version {版}` を流し、配布ファイルの上限は既定のままにする */
export async function buildDistRoot(
  version: string = BUILT_VERSION,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-e2e-dist-"));
  await cp(join(REPO_ROOT, "scripts"), join(root, "scripts"), {
    recursive: true,
  });
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  // CLI の `init` が写す雛形の正本
  await cp(join(REPO_ROOT, "templates"), join(root, "templates"), {
    recursive: true,
  });
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await cp(join(REPO_ROOT, name), join(root, name));
  }
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "version.ini"), `${BUILT_VERSION}\n`);
  await symlink(
    join(REPO_ROOT, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  // 失敗（上限の超過を含む）すると例外になる
  await execFileAsync(
    process.execPath,
    ["scripts/build.ts", "--version", version],
    { cwd: root },
  );
  return root;
}

/** ビルドした作業ツリーを消す */
export async function removeDistRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

/** 配布物を読むページの HTML を返す。使う側の CSS は mdmark の CSS の後に置く */
function pageHtml(hostCss: string): string {
  return `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="${CDN_BASE}@${BUILT_VERSION}/dist/index.css">
    <style>${hostCss}</style>
    <script type="module">
      import { mount, render, registerExtension, collectReferences } from "${CDN_BASE}@${BUILT_VERSION}/dist/index.js";
      window.mdmark = { mount, render, registerExtension, collectReferences };
    </script>
  </head>
  <body><div id="doc"></div></body>
</html>`;
}

/** ページの HTML と、jsDelivr への要求を、手元の応答に差し替えてページを開き、公開関数が使えるまで待つ */
export async function openPage(
  page: Page,
  root: string,
  options: { hostCss?: string; hash?: string } = {},
): Promise<void> {
  await page.route(PAGE_URL, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: pageHtml(options.hostCss ?? ""),
    }),
  );
  await page.route(`${CDN_BASE}@*/dist/*`, async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    await route.fulfill({
      body: await readFile(join(root, "dist", file)),
      contentType: file.endsWith(".css") ? "text/css" : "text/javascript",
      // 別のオリジンのページが module を読むため
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`${PAGE_URL}${options.hash ?? ""}`);
  await page.waitForFunction(() => "mdmark" in window);
}

/** 外部ライブラリの代役のモジュールを返す応答に差し替え、受けた要求の件数を返す関数を返す。status が 404 のときは中身を返さない */
export async function routeLibrary(
  page: Page,
  status: 200 | 404,
): Promise<() => number> {
  let requests = 0;
  await page.route(LIB_URL, (route) => {
    requests += 1;
    return route.fulfill({
      status,
      body: status === 200 ? TEST_LIB_SOURCE : undefined,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => requests;
}

/** 拡張の代役のモジュールを返す応答に差し替え、受けた要求の件数を返す関数を返す。status が 404 のときは中身を返さない。`source` を渡すとその中身を返す */
export async function routeExtension(
  page: Page,
  status: 200 | 404,
  source: string = EXTENSION_SOURCE,
): Promise<() => number> {
  let requests = 0;
  await page.route(EXTENSION_URL, (route) => {
    requests += 1;
    return route.fulfill({
      status,
      body: status === 200 ? source : undefined,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => requests;
}

/** ページから、`greet` の印の拡張を登録する。`strict` が真なら引数を 1 つだけ、英小文字で許す schema を付ける */
export async function registerGreet(
  page: Page,
  options: { strict?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ({ url, strict }) => {
      const w = window as MdmarkWindow;
      if (!w.mdmark) {
        throw new Error("mdmark が無い");
      }
      // モジュールの URL は手元の応答が返すため、バンドラーに解決させない
      const importModule = new Function("u", "return import(u)") as (
        u: string,
      ) => Promise<{ draw: (slot: HTMLElement, value: unknown) => void }>;
      w.mdmark.registerExtension({
        name: "greet",
        directive: "greet",
        load: () => importModule(url),
        schema: strict
          ? {
              "~standard": {
                version: 1,
                vendor: "e2e",
                validate: (value) => {
                  const { args } = value as { args: string[] };
                  const issues = args.flatMap((arg, index) =>
                    index === 0 && /^[a-z]+$/.test(arg)
                      ? []
                      : [
                          {
                            message:
                              index === 0
                                ? "英小文字だけで書いてください"
                                : "引数は 1 つだけです",
                            path: ["args", index],
                          },
                        ],
                  );
                  return issues.length > 0
                    ? { issues }
                    : { value: value as { args: string[] } };
                },
              },
            }
          : undefined,
      } as MdmarkExtension);
    },
    { url: EXTENSION_URL, strict: options.strict ?? false },
  );
}

/** ページから、描く先の要素に文書を描かせる（戻り値はページの `window.handle` に控える）。`documents` を渡すと、ページで `collectReferences` を呼んで参照の表を作って渡す */
export async function mountDocument(
  page: Page,
  options: {
    markdown: string;
    config?: MdmarkConfig;
    documents?: Record<string, string>;
  } & IndexOptions,
): Promise<void> {
  await page.evaluate(
    ({ markdown, config, index, docId, documents, references }) => {
      const w = window as MdmarkWindow;
      const el = document.querySelector<HTMLElement>("#doc");
      if (!w.mdmark || !el) {
        throw new Error("mdmark か描く先の要素が無い");
      }
      const refs =
        references ??
        (index && documents
          ? w.mdmark.collectReferences({ index, documents })
          : undefined);
      w.handle = w.mdmark.mount(el, {
        markdown,
        config,
        index,
        docId,
        references: refs,
      });
    },
    options,
  );
}

/** ページから、描いた文書の本文を差し替えさせる */
export async function updateDocument(
  page: Page,
  markdown: string,
): Promise<void> {
  await page.evaluate((next) => {
    (window as MdmarkWindow).handle?.update(next);
  }, markdown);
}

/** ページから、描いた文書を片付けさせる */
export async function destroyDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as MdmarkWindow).handle?.destroy();
  });
}

/** ページから、Markdown を HTML 文字列にさせ、描く先の要素に触れずに文字列だけを返す */
export async function renderInPage(
  page: Page,
  markdown: string,
  options: IndexOptions = {},
): Promise<string> {
  return page.evaluate(
    ({ source, opts }) => {
      const w = window as MdmarkWindow;
      if (!w.mdmark) {
        throw new Error("mdmark が無い");
      }
      return w.mdmark.render(source, opts);
    },
    { source: markdown, opts: options },
  );
}

/** 配布物を Node で読み（DOM を持たない別のプロセス）、Markdown を HTML 文字列にして返す */
export async function renderInNode(
  root: string,
  markdown: string,
  options: IndexOptions = {},
): Promise<string> {
  const url = pathToFileURL(join(root, "dist", "index.js")).href;
  const script = `import(${JSON.stringify(url)}).then((m) => process.stdout.write(m.render(process.env.MARKDOWN, JSON.parse(process.env.OPTIONS))))`;
  const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
    env: {
      ...process.env,
      MARKDOWN: markdown,
      OPTIONS: JSON.stringify(options),
    },
  });
  return stdout;
}

/** 配布物を Node で読み（DOM を持たない別のプロセス）、索引と文書の本文から点検のずれの一覧を返す */
export async function checkInNode(
  root: string,
  input: {
    index: unknown;
    documents: Record<string, string>;
    indexFile?: string;
  },
): Promise<MdmarkIndexIssue[]> {
  const url = pathToFileURL(join(root, "dist", "index.js")).href;
  const script = `import(${JSON.stringify(url)}).then((m) => process.stdout.write(JSON.stringify(m.checkIndex(JSON.parse(process.env.INPUT)))))`;
  const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
    env: { ...process.env, INPUT: JSON.stringify(input) },
  });
  return JSON.parse(stdout);
}

/** 印刷の前後のイベントを送る */
export async function sendPrintEvent(
  page: Page,
  type: "beforeprint" | "afterprint",
): Promise<void> {
  await page.evaluate((eventType) => {
    window.dispatchEvent(new Event(eventType));
  }, type);
}
