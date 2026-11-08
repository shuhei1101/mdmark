import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Frame, type Page } from "@playwright/test";

/** 端末の設定と上のフォルダ・近いフォルダの設定を重ねるシナリオの見本 */

/** `theme.css` が描く先の要素に適用する CSS 変数 */
export const CASCADE_THEME_VARIABLE = "--e2e-cascade-theme";

/** `theme.css` の中身。`value` を描く先の要素の CSS 変数にする */
export const cascadeTheme = (value: string): string =>
  `.mdmark { ${CASCADE_THEME_VARIABLE}: ${value}; }\n`;

/** 固有の部品のモジュール。`greet` のマーカーの場所に `{prefix}:{引数}` を描く */
export const greetSource = (prefix = "greet"): string => `export default {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot, value) {
      slot.textContent = "${prefix}:" + value.args.join(",");
    },
  }),
};
`;

/** 注意書き・表・固有の部品のマーカーを持つ文書 */
export const CASCADE_GUIDE = [
  "# ガイド",
  "",
  "> [!NOTE]",
  "> 注意書き",
  "",
  "<!-- table: data -->",
  "",
  "| 名前 | 数 |",
  "| --- | --- |",
  "| a | 2 |",
  "| b | 1 |",
  "",
  "<!-- /table -->",
  "",
  "<!-- greet: 世界 -->",
  "",
].join("\n");

/** 上のフォルダ（`theme`・`extensions`）と、その下の `docs/`（`features.table: false` と文書）のファイル。キーは `root` からの相対パス */
export const cascadeFolderFiles = (): Record<string, string> => ({
  "mdmark.config.yaml": "theme: ./theme.css\nextensions:\n  - ./ext/greet.js\n",
  "theme.css": cascadeTheme("rgb(1, 2, 3)"),
  "ext/greet.js": greetSource(),
  "docs/mdmark.config.yaml": "features:\n  table: false\n",
  "docs/guide.md": CASCADE_GUIDE,
});

/** 端末の設定の中身 */
export const cascadeSettings = (options: {
  cascade: boolean;
  applyToExport?: boolean;
  /** 3 行目を YAML として読み込めない行にする */
  broken?: boolean;
}): string =>
  [
    "config:",
    `  cascade: ${options.cascade}`,
    ...(options.applyToExport === undefined
      ? []
      : [`  applyToExport: ${options.applyToExport}`]),
    ...(options.broken ? ["libraries: [a, b}"] : []),
    "features:",
    "  callout: false",
    "",
  ].join("\n");

/** 端末の設定を `dir/settings.yaml` に書き込み、そのパスを返却する */
export async function writeSettings(
  dir: string,
  content: string,
): Promise<string> {
  const path = join(dir, "settings.yaml");
  await writeFile(path, content);
  return path;
}

/** 設定ファイルの中身を並べて読み込む（書き換わっていないかを比べる） */
export async function readConfigs(paths: string[]): Promise<string[]> {
  return Promise.all(paths.map((path) => readFile(path, "utf8")));
}

/** フォルダの中の 2 つの `mdmark.config.yaml` のパス */
export const cascadeConfigPaths = (root: string): string[] => [
  join(root, "mdmark.config.yaml"),
  join(root, "docs", "mdmark.config.yaml"),
];

/** 描いた文書の、描く先の要素の `theme.css` の CSS 変数の値 */
export async function themeValue(root: Page | Frame): Promise<string> {
  return root.evaluate(
    (name) =>
      getComputedStyle(document.querySelector(".mdmark") as Element)
        .getPropertyValue(name)
        .trim(),
    CASCADE_THEME_VARIABLE,
  );
}

/** 注意書きと表の機能がオフで描かれている */
export async function expectFeaturesOff(root: Page | Frame): Promise<void> {
  const article = root.locator(".mdmark").first();
  await expect(article.locator("h1")).toContainText("ガイド");
  await expect(article.locator(".markdown-alert")).toHaveCount(0);
  await expect(article.locator("blockquote")).toHaveCount(1);
  await expect(article.locator("button.mdmark-sort")).toHaveCount(0);
}

/** 上のフォルダの `theme.css` と固有の部品が該当している */
export async function expectUpperApplied(root: Page | Frame): Promise<void> {
  await expect(root.locator(".mdmark [data-mdmark-slot]")).toHaveText([
    "greet:世界",
  ]);
  await expect.poll(() => themeValue(root)).toBe("rgb(1, 2, 3)");
}

/** 上のフォルダの `theme.css` と固有の部品が該当していない */
export async function expectUpperNotApplied(root: Page | Frame): Promise<void> {
  await expect(root.locator(".mdmark [data-mdmark-slot]")).toHaveCount(0);
  expect(await themeValue(root)).toBe("");
}
