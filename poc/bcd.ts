import { createRequire } from "node:module";

/** 互換データの 1 ブラウザ分の記述 */
type Support = { version_added: string | boolean | null };

/** 互換データの木の 1 節 */
type CompatNode = {
  __compat?: { support: Record<string, Support | Support[]> };
  [key: string]: unknown;
};

// 比べるブラウザと、非機能要件の下限
const BROWSERS = [
  { key: "chrome", floor: "94" },
  { key: "firefox", floor: "93" },
  { key: "safari", floor: "16.4" },
];
// 調べる機能と、互換データのキー
const FEATURES = [
  { label: "@layer", path: "css.at-rules.layer" },
  { label: "動的 import()", path: "javascript.operators.import" },
  { label: "import map", path: "html.elements.script.type.importmap" },
  {
    label: "モジュールを読んだ後に足した import map",
    path: "html.elements.script.type.importmap.multiple_import_maps",
  },
];

/** 互換データから、機能が使える最初の版をブラウザごとに引く */
function firstVersions(data: CompatNode, path: string): string[] {
  let node = data;
  for (const key of path.split(".")) {
    node = node[key] as CompatNode;
  }
  const support = node.__compat?.support ?? {};
  return BROWSERS.map(({ key }) => {
    const entry = support[key];
    const first = Array.isArray(entry) ? entry[0] : entry;
    return String(first?.version_added);
  });
}

/** 機能ごとの最初の版と下限を Markdown の表で出す */
function main(): void {
  const require = createRequire(import.meta.url);
  const data: CompatNode = require("@mdn/browser-compat-data");
  console.log("| 機能 | キー | Chrome | Firefox | Safari |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const { label, path } of FEATURES) {
    console.log(
      `| ${label} | ${path} | ${firstVersions(data, path).join(" | ")} |`,
    );
  }
  console.log(
    `| 対応ブラウザの下限 | - | ${BROWSERS.map(({ floor }) => floor).join(" | ")} |`,
  );
}

main();
