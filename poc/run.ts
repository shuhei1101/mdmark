// PoC: 色分けのライブラリを使うときだけ読み込み、コードブロックを色分けできるかを確かめる
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, resolve } from "node:path";
import { chromium, type Page } from "playwright";

/** 検証する作業ツリーの直下 */
const ROOT = resolve(import.meta.dirname, "..");

/** `@highlightjs/cdn-assets@11.12.0` を展開した `package/` のパス */
const CDN_PACKAGE = process.env.CDN_PACKAGE ?? "";

/** jsDelivr と同じパスの頭 */
const CDN_PREFIX = "/npm/@highlightjs/cdn-assets@11.12.0/";

/** 本番の URL の頭 */
const PRODUCTION = `https://cdn.jsdelivr.net${CDN_PREFIX}`;

/** 拡張子から MIME を引く */
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
};

/** 静的配信を立てて URL の頭を返す */
async function serve(options: {
  base: string;
  prefix: string;
  cors: boolean;
  onRequest?: (path: string) => number | undefined;
}): Promise<{ server: Server; origin: string }> {
  const { base, prefix, cors, onRequest } = options;
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname);
    const forced = onRequest?.(path);
    const headers: Record<string, string> = cors ? { "Access-Control-Allow-Origin": "*" } : {};
    if (forced !== undefined || !path.startsWith(prefix)) {
      response.writeHead(forced ?? 404, headers).end();
      return;
    }
    try {
      const body = await readFile(join(base, path.slice(prefix.length)));
      response.writeHead(200, { ...headers, "Content-Type": MIME[extname(path)] ?? "application/octet-stream" }).end(body);
    } catch {
      response.writeHead(404, headers).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { server, origin: `http://127.0.0.1:${port}` };
}

/** 検証する文書 */
const DOCUMENT = [
  "# 色分けの検証",
  "",
  "```ts",
  "const count: number = 1; // 数える",
  "```",
  "",
  "```yaml",
  "features:",
  "  code: true",
  "```",
  "",
  "```python",
  "def greet(name: str) -> str:",
  '    return f"hello {name}"',
  "```",
  "",
  "<!-- code: title=app.ts -->",
  "```ts",
  'import { mount } from "mdmark";',
  "```",
  "",
  "<!-- code: lines highlight=2 -->",
  "```ts",
  "let count = 0; // [!code --]",
  "let count = 1; // [!code ++]",
  "console.log(count);",
  "```",
  "",
  "<!-- code: lines -->",
  "```ts",
  "/* 1 行目",
  "   2 行目",
  "   3 行目 */",
  'const text = `a',
  "b`;",
  "```",
  "",
  "<!-- code: lines -->",
  "```python",
  'doc = """1 行目',
  "2 行目",
  '3 行目"""',
  "```",
  "",
  "```tree",
  "src/",
  "└── index.ts",
  "```",
  "",
  "```rust",
  'fn main() { println!("hi"); }',
  "```",
].join("\n");

/** 色分けしない言語だけの文書 */
const NO_TARGET_DOCUMENT = ["段落", "", "```tree", "a/", "└── b.ts", "```", "", "```rust", "fn main() {}", "```"].join("\n");

/** コードブロックの無い文書 */
const NO_CODE_DOCUMENT = "# 見出し\n\n段落だけ";

/** 300 行の ts */
const LONG_DOCUMENT = [
  "```ts",
  ...Array.from({ length: 300 }, (_, index) => `export const value${index}: string = "line ${index}"; // ${index}`),
  "```",
].join("\n");

/** 検証ページの HTML */
function pageHtml(options: { pageOrigin: string; libraries: Record<string, string>; markdown: string; targetId: string }): string {
  const { pageOrigin, libraries, markdown, targetId } = options;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${pageOrigin}/dist/index.css"></head>
<body><div id="${targetId}"></div>
<script type="module">
import { mount } from "${pageOrigin}/dist/index.js";
mount(document.getElementById("${targetId}"), { markdown: ${JSON.stringify(markdown)}, config: { libraries: ${JSON.stringify(libraries)} } });
</script></body></html>`;
}

/** 対応表を配信の頭へ向ける */
function librariesAt(origin: string): Record<string, string> {
  return {
    hljs: `${origin}${CDN_PREFIX}es/core.min.js`,
    "hljs-typescript": `${origin}${CDN_PREFIX}es/languages/typescript.min.js`,
    "hljs-yaml": `${origin}${CDN_PREFIX}es/languages/yaml.min.js`,
    "hljs-python": `${origin}${CDN_PREFIX}es/languages/python.min.js`,
  };
}

/** 色分けを読まない対応表 */
const NO_HIGHLIGHT: Record<string, string> = {
  hljs: "data:text/javascript,throw%20new%20Error(%22off%22)",
};

/** コードブロックごとの観測 */
type Snapshot = {
  language: string;
  text: string;
  html: string;
  preAttrs: string;
  codeAttrs: string;
  figure: string | null;
  lines: string[];
  hasClass: boolean;
  unclosed: number;
};

/** 描いたコードブロックを観測する */
async function snapshot(page: Page, selector: string): Promise<Snapshot[]> {
  return page.$$eval(`${selector} pre > code`, (codes) =>
    codes.map((code) => {
      const pre = code.parentElement as HTMLElement;
      const attrs = (element: Element) =>
        [...element.attributes].map((attribute) => `${attribute.name}=${attribute.value}`).sort().join(" ");
      const texts = [...code.querySelectorAll(".mdmark-code-text")];
      // 行の中で閉じていない要素の数: innerHTML を読み直して開きと閉じが釣り合うか
      const unclosed = texts.filter((text) => {
        const html = text.innerHTML;
        return (html.match(/<span/g) ?? []).length !== (html.match(/<\/span>/g) ?? []).length;
      }).length;
      return {
        language: code.className,
        text: code.textContent ?? "",
        html: code.innerHTML,
        preAttrs: attrs(pre),
        codeAttrs: attrs(code),
        figure: pre.closest("figure")?.querySelector("figcaption")?.outerHTML ?? null,
        lines: [...code.querySelectorAll(".mdmark-code-line")].map(
          (line) => `${line.getAttribute("data-line") ?? ""}|${line.getAttribute("data-kind") ?? ""}`,
        ),
        hasClass: code.querySelector("[class^='hljs-']") !== null,
        unclosed,
      };
    }),
  );
}

/** 結果の行 */
const results: Array<{ check: string; ok: boolean; detail: string }> = [];

/** 結果を記録する */
function record(check: string, ok: boolean, detail: string): void {
  results.push({ check, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${check}: ${detail}`);
}

const cdnRequests: string[] = [];
let failPaths: string[] = [];
const cdn = await serve({
  base: CDN_PACKAGE,
  prefix: CDN_PREFIX,
  cors: true,
  onRequest: (path) => {
    cdnRequests.push(path);
    return failPaths.some((fail) => path.endsWith(fail)) ? 404 : undefined;
  },
});
const pages = new Map<string, string>();
const site = await serve({ base: ROOT, prefix: "/", cors: false, onRequest: (path) => (pages.has(path) ? undefined : undefined) });
// ページの HTML は配信の前に差し込む
site.server.removeAllListeners("request");
site.server.on("request", async (request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname);
  const html = pages.get(path);
  if (html !== undefined) {
    response.writeHead(200, { "Content-Type": MIME[".html"] ?? "" }).end(html);
    return;
  }
  try {
    const body = await readFile(join(ROOT, path));
    response.writeHead(200, { "Content-Type": MIME[extname(path)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

const browser = await chromium.launch();

/** 文書を描いて色分けの終わりまで待ち、観測とコンソールのエラーを返す */
async function open(options: { markdown: string; libraries: Record<string, string>; wait: "highlighted" | "settled" }) {
  const { markdown, libraries, wait } = options;
  const path = `/page-${pages.size}.html`;
  pages.set(path, pageHtml({ pageOrigin: site.origin, libraries, markdown, targetId: "doc" }));
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(`${site.origin}${path}`);
  await page.waitForSelector("#doc h1, #doc p, #doc pre");
  if (wait === "highlighted") {
    await page.waitForFunction(() => document.getElementById("doc")?.dataset.mdmarkHighlightMs !== undefined, null, { timeout: 10000 });
  } else {
    await page.waitForTimeout(1500);
  }
  const blocks = await snapshot(page, "#doc");
  const ms = await page.evaluate(() => document.getElementById("doc")?.dataset.mdmarkHighlightMs);
  await page.close();
  return { blocks, errors, ms };
}

// ─── 色分けの前（色分けを読まない） ───
const before = await open({ markdown: DOCUMENT, libraries: NO_HIGHLIGHT, wait: "settled" });

// ─── 読み込みの範囲・保持・写す中身 ───
cdnRequests.length = 0;
const after = await open({ markdown: DOCUMENT, libraries: librariesAt(cdn.origin), wait: "highlighted" });
record(
  "読み込みの範囲（3 言語の文書）",
  cdnRequests.length === 4 && cdnRequests.some((path) => path.endsWith("core.min.js")),
  `要求 ${cdnRequests.length} 件: ${cdnRequests.map((path) => path.slice(CDN_PREFIX.length)).join(", ")}`,
);
const targetLanguages = ["language-ts", "language-yaml", "language-python"];
const pairs = before.blocks.map((block, index) => ({ before: block, after: after.blocks[index] as Snapshot }));
const targets = pairs.filter((pair) => targetLanguages.includes(pair.before.language));
const others = pairs.filter((pair) => !targetLanguages.includes(pair.before.language));
const splitPairs = targets.filter((pair) => pair.before.lines.length > 0);
const flatPairs = targets.filter((pair) => pair.before.lines.length === 0);
record(
  "行に分けたブロックの保持",
  splitPairs.every((pair) => pair.after.hasClass && JSON.stringify(pair.before.lines) === JSON.stringify(pair.after.lines) && pair.after.unclosed === 0),
  splitPairs.map((pair) => `${pair.before.language} 行 ${pair.after.lines.length}（${pair.after.lines.join(",")}）閉じていない行 ${pair.after.unclosed}・色 ${pair.after.hasClass}`).join(" / "),
);
record(
  "行に分けないブロック",
  flatPairs.every((pair) => pair.after.hasClass && pair.before.preAttrs === pair.after.preAttrs && pair.before.codeAttrs === pair.after.codeAttrs && pair.before.figure === pair.after.figure),
  flatPairs.map((pair) => `${pair.before.language}${pair.before.figure ? "（題あり）" : ""} 色 ${pair.after.hasClass}・pre 属性 ${pair.before.preAttrs === pair.after.preAttrs}・code 属性 ${pair.before.codeAttrs === pair.after.codeAttrs}`).join(" / "),
);
record(
  "写す中身",
  pairs.every((pair) => pair.before.text === pair.after.text),
  `${pairs.filter((pair) => pair.before.text === pair.after.text).length}/${pairs.length} ブロックで textContent が一致`,
);
record(
  "対象外の言語は変えない",
  others.every((pair) => pair.before.html === pair.after.html),
  others.map((pair) => `${pair.before.language} ${pair.before.html === pair.after.html ? "同じ" : "変わった"}`).join(" / "),
);
for (const [name, markdown] of [["コードブロックの無い文書", NO_CODE_DOCUMENT], ["tree と rust だけの文書", NO_TARGET_DOCUMENT]] as const) {
  cdnRequests.length = 0;
  await open({ markdown, libraries: librariesAt(cdn.origin), wait: "settled" });
  record(`読み込みの範囲（${name}）`, cdnRequests.length === 0, `要求 ${cdnRequests.length} 件`);
}

// ─── 読み込めないとき ───
failPaths = ["core.min.js"];
const failedAll = await open({ markdown: DOCUMENT, libraries: librariesAt(cdn.origin), wait: "settled" });
record(
  "読み込めないとき（全部）",
  failedAll.blocks.every((block, index) => block.html === before.blocks[index]?.html) && failedAll.errors.some((error) => error.includes("色分けのライブラリを読み込めない")) && !failedAll.errors.some((error) => error.startsWith("pageerror")),
  `HTML が前と同じ ${failedAll.blocks.filter((block, index) => block.html === before.blocks[index]?.html).length}/${failedAll.blocks.length}・コンソール: ${failedAll.errors.join(" | ").slice(0, 200)}`,
);
failPaths = ["python.min.js"];
const failedPython = await open({ markdown: DOCUMENT, libraries: librariesAt(cdn.origin), wait: "highlighted" });
const pythonSame = failedPython.blocks.filter((block) => block.language === "language-python").every((block) => {
  const index = failedPython.blocks.indexOf(block);
  return block.html === before.blocks[index]?.html && block.text === before.blocks[index]?.text;
});
const othersColored = failedPython.blocks.filter((block) => block.language === "language-ts" || block.language === "language-yaml").every((block) => block.hasClass);
record(
  "読み込めないとき（python だけ）",
  pythonSame && othersColored && failedPython.errors.some((error) => error.includes("色分けの言語を読み込めない")),
  `python は前と同じ ${pythonSame}・ts と yaml に色 ${othersColored}・コンソール: ${failedPython.errors.join(" | ").slice(0, 200)}`,
);
failPaths = [];

// ─── 色が付くまでの時間 ───
const times: number[] = [];
for (let round = 0; round < 5; round += 1) {
  const long = await open({ markdown: LONG_DOCUMENT, libraries: librariesAt(cdn.origin), wait: "highlighted" });
  times.push(Number(long.ms));
}
const sorted = [...times].sort((a, b) => a - b);
const median = sorted[2] ?? Number.NaN;
record("色が付くまでの時間（300 行）", median <= 100, `中央値 ${median.toFixed(1)}ms（${times.map((time) => time.toFixed(1)).join(", ")}）`);

// ─── 本番の URL ───
{
  const page = await browser.newPage();
  await page.goto(`${site.origin}/dist/index.css`);
  const production = await page.evaluate(async (base) => {
    const core = await import(`${base}es/core.min.js`);
    const typescript = await import(`${base}es/languages/typescript.min.js`);
    core.default.registerLanguage("typescript", typescript.default);
    return {
      highlight: typeof core.default.highlight,
      sample: core.default.highlight("const a = 1;", { language: "typescript" }).value,
    };
  }, PRODUCTION);
  record("本番の URL", production.highlight === "function", `highlight は ${production.highlight}・例 ${production.sample}`);
  await page.close();
}

// ─── 書き出した HTML ───
{
  const exported = process.env.EXPORTED_HTML ?? "";
  const page = await browser.newPage();
  const external: string[] = [];
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("file:")) {
      return route.continue();
    }
    external.push(url);
    return route.abort();
  });
  await page.goto(`file://${exported}`);
  await page.waitForFunction(() => document.querySelector("[data-mdmark-highlight-ms]") !== null, null, { timeout: 15000 });
  const colored = await page.$$eval("pre > code", (codes) =>
    codes.map((code) => `${code.className}:${code.querySelector("[class^='hljs-']") !== null}`),
  );
  const embedded = Number(process.env.EMBEDDED_BYTES ?? "0");
  const ok =
    external.length === 0 &&
    ["language-ts", "language-yaml", "language-python"].every((language) => colored.some((entry) => entry === `${language}:true`)) &&
    embedded <= 64 * 1024;
  record("書き出した HTML", ok, `外への要求 ${external.length} 件・${colored.join(", ")}・埋めた色分けのモジュール ${embedded} バイト`);
  await page.close();
}

await browser.close();
cdn.server.close();
site.server.close();
console.log(JSON.stringify(results, null, 2));
process.exit(results.every((result) => result.ok) ? 0 : 1);
