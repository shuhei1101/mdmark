import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { INQUIRY_COUNT_TEXT, wrapHtml } from "../../unit/helpers/charts.ts";
import {
  parsed,
  STRENGTH_TEXT,
  wrapDirective,
} from "../../unit/helpers/diagrams.ts";
import { PNG_BYTES, runCli, useTempDirs, writeFiles } from "../cli.ts";

const createTempDir = useTempDirs();

/** CLI の子プロセスで、外へのネットワークの接続（`fetch` と TCP の接続）を記録するファイルへ追記させる、`--import` で読み込むモジュール */
const NETWORK_RECORDER = `import { appendFileSync } from "node:fs";
import net from "node:net";
const file = process.env.MDMARK_TEST_NETWORK_LOG;
const record = (target) => appendFileSync(file, String(target) + "\\n");
const fetchOriginal = globalThis.fetch;
globalThis.fetch = (input, init) => { record(input); return fetchOriginal(input, init); };
const connectOriginal = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) { record(JSON.stringify(args[0])); return connectOriginal.apply(this, args); };
`;

/** 記録のモジュールを置き、CLI を実行して、終了コード・出力と記録した接続を返却する */
async function runRecorded(args: string[], cwd: string) {
  const recorder = join(cwd, ".network-recorder.mjs");
  const log = join(cwd, ".network.log");
  await writeFile(recorder, NETWORK_RECORDER);
  await writeFile(log, "");
  const result = await runCli(args, cwd, {
    NODE_OPTIONS: `--import=${recorder}`,
    MDMARK_TEST_NETWORK_LOG: log,
  });
  const requests = (await readFile(log, "utf8")).split("\n").filter(Boolean);
  return { ...result, requests };
}

/** SVG の href・src・url( の値を並べる */
function references(svg: string): string[] {
  const attributes = [...svg.matchAll(/\s(?:href|src)="([^"]*)"/g)].map(
    (match) => match[1] ?? "",
  );
  const urls = [...svg.matchAll(/url\(\s*['"]?([^'")]*)/g)].map(
    (match) => match[1] ?? "",
  );
  return [...attributes, ...urls];
}

/** 目次・表・chart・param・埋め込んだ HTML を持つ文書 */
const GUIDE = [
  "# 手引き",
  "",
  "<!-- toc -->",
  "",
  "## 件数",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| 窓口 | 件数 |",
  "| --- | --- |",
  "| メール | 3 |",
  "",
  "<!-- /table -->",
  "",
  "## 図",
  "",
  wrapDirective("chart", INQUIRY_COUNT_TEXT),
  wrapDirective("param", STRENGTH_TEXT),
  wrapHtml("<table><tr><td>セル</td></tr></table>"),
].join("\n");

/** 設定 */
const CONFIG = "features:\n  print: true\n";

// 記法を持つ文書を Markdown と SVG に書き出す（正常系）
test("test_normal", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG,
    "guide.mark.md": GUIDE,
  });
  const chart = parsed<{ title: string; series: { name: string }[] }>(
    INQUIRY_COUNT_TEXT,
  );
  // 実行
  const result = await runRecorded(["export-markdown", "guide.mark.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const out = join(dir, "guide-markdown");
  expect((await readdir(join(out, "images"))).sort()).toEqual([
    "figure-1.svg",
    "figure-2.svg",
    "figure-3.svg",
  ]);
  const markdown = await readFile(join(out, "guide.md"), "utf8");
  expect(markdown).not.toContain("<!--");
  for (const index of [1, 2, 3]) {
    expect(markdown).toContain(`](images/figure-${index}.svg)`);
  }
  expect(markdown).toContain(
    [
      `**${chart.title}**`,
      "",
      `![${chart.title}](images/figure-1.svg)`,
      "",
      ...chart.series.map((item) => `- ${item.name}`),
    ].join("\n"),
  );
  for (const index of [1, 2, 3]) {
    const svg = await readFile(
      join(out, "images", `figure-${index}.svg`),
      "utf8",
    );
    for (const reference of references(svg)) {
      expect(reference.startsWith("data:") || reference.startsWith("#")).toBe(
        true,
      );
    }
  }
  expect(result.requests).toEqual([]);
});

// 範囲のスクリプトと https の画像を取り除き、相対パスの画像を埋めて警告を出す（正常系（書き出せない中身を持つ埋め込んだ HTML））
test("test_normal_when_unexportable_contents", async () => {
  // 準備
  const dir = await createTempDir();
  const document = [
    "# 中身",
    "",
    "<!-- html -->",
    "",
    "```html",
    '<div class="box">中身</div>',
    "```",
    "",
    "```ts",
    'export default (el: HTMLElement) => { el.textContent = "書き換え"; };',
    "```",
    "",
    "<!-- /html -->",
    "",
    wrapHtml(
      `<mdmark-chart>\n${INQUIRY_COUNT_TEXT}\n</mdmark-chart><img src="pic.png" alt="a"><img src="https://example.com/b.png" alt="b">`,
    ),
  ].join("\n");
  await writeFiles(dir, {
    "mdmark.config.yaml": "features:\n  html-scripts: true\n",
    "guide.mark.md": document,
    "pic.png": PNG_BYTES,
  });
  // 実行
  const result = await runRecorded(["export-markdown", "guide.mark.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const warnings = result.stderr.split("\n").filter(Boolean);
  expect(warnings.filter((line) => line.includes("スクリプト"))).toHaveLength(
    1,
  );
  expect(
    warnings.filter((line) => line.includes("https://example.com/b.png")),
  ).toHaveLength(1);
  const svg = await readFile(
    join(dir, "guide-markdown", "images", "figure-2.svg"),
    "utf8",
  );
  expect(svg).toContain("mdmark-diagram-wires");
  expect(svg).toContain("mdmark-diagram-title");
  expect(svg).toContain("mdmark-diagram-legend");
  expect(svg).not.toContain("mdmark-diagram-tools");
  expect(svg).not.toContain("mdmark-diagram-resize");
  expect(svg).toContain('src="data:image/png');
  expect(svg).not.toContain("https://example.com/b.png");
  expect(result.requests).toEqual([]);
});

/** 書き出しのフックを持つ拡張と持たない拡張 */
const EXTENSION_FILES = {
  "extensions/bold.js": `export default {
  name: "太字の拡張",
  directive: "bold-mark",
  load: async () => ({ draw() {} }),
  toMarkdown: (value) => "**" + value.options.target + "**",
};
`,
  "extensions/silent.js": `export default {
  name: "フックの無い拡張",
  directive: "silent-mark",
  load: async () => ({ draw() {} }),
};
`,
};

// 設定の拡張の書き出しのフックを呼び、フックの無い拡張のマーカーを取り除く（正常系（拡張のマーカー））
test("test_normal_when_extension_marks", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    ...EXTENSION_FILES,
    "mdmark.config.yaml":
      "extensions:\n  - extensions/bold.js\n  - extensions/silent.js\n",
    "guide.mark.md": [
      "前の段落。",
      "",
      '<!-- bold-mark: {"target": "world"} -->',
      "",
      "<!-- silent-mark -->",
      "",
      "```json",
      '{"hidden": true}',
      "```",
      "",
      "<!-- /silent-mark -->",
      "",
      "後の段落。",
      "",
    ].join("\n"),
  });
  // 実行
  const result = await runCli(["export-markdown", "guide.mark.md"], dir);
  // 検証
  expect(result.code).toBe(0);
  const markdown = await readFile(
    join(dir, "guide-markdown", "guide.md"),
    "utf8",
  );
  expect(markdown).toContain("**world**");
  expect(markdown).not.toContain("hidden");
  expect(markdown).not.toContain("<!--");
  expect(markdown).toContain("前の段落。");
  expect(markdown).toContain("後の段落。");
});

// 無い文書は何も書き込まずに終了コード 1 で終える（異常系）
test("test_error_when_file_missing", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": CONFIG });
  // 実行
  const result = await runCli(["export-markdown", "missing.md"], dir);
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("missing.md");
  expect(existsSync(join(dir, "missing-markdown"))).toBe(false);
});

// 出力のフォルダのパスがファイルを指すとき、何も書き込まずに修正方法を出す（異常系）
test("test_error_when_output_unwritable", async () => {
  // 準備
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG,
    "guide.mark.md": GUIDE,
    blocked: "ファイル",
  });
  // 実行
  const result = await runCli(
    ["export-markdown", "guide.mark.md", "--out", "blocked"],
    dir,
  );
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("blocked");
  expect(result.stderr).toContain("--out");
  const files = await readdir(dir, { recursive: true });
  expect(
    files.filter(
      (name) => /\.(md|svg)$/.test(String(name)) && name !== "guide.mark.md",
    ),
  ).toEqual([]);
});
