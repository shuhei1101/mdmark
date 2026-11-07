// CLI の bundleViewer と同じ設定で mermaid をまとめ、1 枚の HTML を書き出す
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.__MDMARK_LUCIDE_VERSION__ = "0.0.0";
globalThis.__MDMARK_VERSION__ = "0.0.0";
const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2];
const { bundleViewer, hasDynamicImport, cacheFetchText } = await import(resolve(repo, "src/cli/embed.ts"));
const MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";
const logic = JSON.stringify(resolve(here, "logic.js"));
const fetchText = cacheFetchText();
const withMermaid = await bundleViewer({
  entry: `import mermaid from ${JSON.stringify(MERMAID)};\nimport { run } from ${logic};\nrun(mermaid);\n`,
  baseDir: here,
  fetchText,
});
const without = await bundleViewer({
  entry: `import { run } from ${logic};\nwindow.__noop = run;\n`,
  baseDir: here,
  fetchText,
});
const css = await readFile(resolve(repo, "src/index.css"), "utf8");
const diagrams = await readFile(resolve(here, "diagrams.html"), "utf8");
const page = (script) =>
  `<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><title>PoC</title><style>${css}</style></head><body><div class="mdmark">${diagrams}</div><script type="module">${script}</script></body></html>\n`;
const html = page(withMermaid);
const base = page(without);
await writeFile(resolve(here, "out/export.html"), html);
const summary = {
  dynamicImport: hasDynamicImport(withMermaid),
  scriptBytes: Buffer.byteLength(withMermaid),
  htmlBytes: Buffer.byteLength(html),
  baselineHtmlBytes: Buffer.byteLength(base),
  diffBytes: Buffer.byteLength(html) - Buffer.byteLength(base),
};
await writeFile(resolve(here, "out/bundle.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
