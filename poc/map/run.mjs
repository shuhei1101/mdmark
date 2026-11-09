// PoC の計測: harness を束ねて Chromium で描き、結果とスクリーンショットを記録する
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const bundled = await build({ entryPoints: [join(here, "harness.ts")], bundle: true, format: "iife", write: false });
const minified = await build({ entryPoints: [join(here, "layout.ts"), join(here, "parse.ts")], bundle: true, format: "esm", minify: true, write: false, outdir: "out" });
const sizes = minified.outputFiles.map((file) => ({ file: file.path.split("/").pop(), bytes: file.contents.length }));
const both = await build({ stdin: { contents: 'export { layoutMap } from "./layout.ts"; export { parseFlowchart, parseSequence } from "./parse.ts";', resolveDir: here, loader: "ts" }, bundle: true, format: "esm", minify: true, write: false });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2700, height: 1200 } });
await page.setContent('<!doctype html><html lang="ja"><body style="margin:0"><div id="host"></div></body></html>');
await page.addScriptTag({ content: bundled.outputFiles[0].text });
const result = await page.evaluate(() => window.runPoc());
await page.locator("#host svg").screenshot({ path: join(here, "screenshot.png") });
await browser.close();
const output = { chromium: chromium.name(), sizes, combinedMinifiedBytes: both.outputFiles[0].contents.length, ...result };
writeFileSync(join(here, "result.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output.results.map((r) => ({ name: r.name, max: r.max.toFixed(1), times: r.times.map((t) => t.toFixed(1)).join(" "), leaves: r.leaves, boxes: r.boxes, edges: r.edges, issues: r.issues.length, notFit: r.labelsNotFit.length, diff: r.maxEstimateDiff.toFixed(1) })), null, 1));
console.log(JSON.stringify({ sizes, combined: output.combinedMinifiedBytes, overrideChecks: output.overrideChecks }));
