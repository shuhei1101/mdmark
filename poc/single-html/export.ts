// PoC: 配布物と外部ライブラリのモジュールを埋めた 1 枚の HTML を書き出す
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { render } from "../../dist/index.js";

/** 埋めたモジュールを読む URL の種類 */
type Variant = "blob" | "data";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const outDir = join(here, "out");

/** 非機能要件『対応ブラウザ』のビルドの target */
const TARGET = ["chrome99", "firefox97", "safari16.4"];

/** `https://` と、取得したモジュールが import する `/npm/...` などを、取得して解決する esbuild のプラグイン */
const httpUrlPlugin: esbuild.Plugin = {
  name: "http-url",
  setup(build) {
    build.onResolve({ filter: /^https?:\/\// }, (args) => ({
      path: args.path,
      namespace: "http-url",
    }));
    // 取得したモジュールの中の import は、そのモジュールの URL を基準に解決する
    build.onResolve({ filter: /.*/, namespace: "http-url" }, (args) => ({
      path: new URL(args.path, args.importer).href,
      namespace: "http-url",
    }));
    build.onLoad({ filter: /.*/, namespace: "http-url" }, async (args) => {
      const response = await fetch(args.path);
      if (!response.ok) {
        throw new Error(`${args.path} を取得できない: ${response.status}`);
      }
      return { contents: await response.text(), loader: "js" };
    });
  },
};

/** 外部ライブラリの印のモジュールを 1 つの ES モジュールに束ねる */
async function bundleLibrary(entry: string) {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    minify: true,
    target: TARGET,
    write: false,
    metafile: true,
    plugins: [httpUrlPlugin],
  });
  return { code: result.outputFiles[0].text, metafile: result.metafile };
}

/** `<script>` の中に置く JSON（`</script` で閉じないよう `<` を逃がす） */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

/** 埋めたモジュールを URL に替え、配布物を読んで `mount` する起動のスクリプト */
function bootScript(variant: Variant): string {
  return `
const payload = JSON.parse(document.getElementById("mdmark-payload").textContent);
const toUrl = (code) => ${
    variant === "blob"
      ? `URL.createObjectURL(new Blob([code], { type: "text/javascript" }))`
      : `"data:text/javascript;charset=utf-8," + encodeURIComponent(code)`
  };
const { mount } = await import(toUrl(payload.mdmark));
const libraries = Object.fromEntries(Object.entries(payload.modules).map(([name, code]) => [name, toUrl(code)]));
mount(document.getElementById("doc"), { markdown: payload.markdown, config: { libraries } });
`;
}

/** 1 枚の HTML を組み立てる */
function buildHtml(options: {
  variant: Variant;
  css: string;
  body: string;
  payload: { markdown: string; mdmark: string; modules: Record<string, string> };
}): string {
  const { variant, css, body, payload } = options;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PoC: 1 枚の HTML（${variant}）</title>
<style>${css}</style>
</head>
<body>
<main id="doc" class="mdmark">${body}</main>
<script type="application/json" id="mdmark-payload">${scriptJson(payload)}</script>
<script type="module">${bootScript(variant)}</script>
</body>
</html>
`;
}

const markdown = await readFile(join(here, "sample.md"), "utf8");
const library = await bundleLibrary(join(here, "chart-draw.js"));
const mdmark = await readFile(join(root, "dist", "index.js"), "utf8");
const css = await readFile(join(root, "dist", "index.css"), "utf8");
// 書き出した直後に読める本文。開いた後は mount が描き直す
const body = render(markdown, { config: { libraries: { chart: "embedded" } } });

await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, "metafile.json"),
  JSON.stringify(library.metafile, null, 2),
);
for (const variant of ["blob", "data"] as const) {
  const html = buildHtml({
    variant,
    css,
    body,
    payload: { markdown, mdmark, modules: { chart: library.code } },
  });
  const file = join(outDir, `single-${variant}.html`);
  await writeFile(file, html);
  console.log(`${file}: ${Buffer.byteLength(html)} バイト`);
}
console.log(`束ねたモジュール: ${Buffer.byteLength(library.code)} バイト`);
console.log("束ねたモジュールに入ったファイル:");
for (const [input, info] of Object.entries(library.metafile.inputs)) {
  console.log(`  ${input}（${info.bytes} バイト）`);
}
const leftovers = library.code.match(/(?:from|import)\s*\(?\s*["'](?:https?:|\/npm\/)[^"']*["']/g);
console.log(`束ねたモジュールに残った外部の import: ${leftovers?.length ?? 0} 件`);