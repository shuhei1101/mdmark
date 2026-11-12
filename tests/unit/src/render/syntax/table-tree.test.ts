import { expect, test } from "vitest";
import {
  findTag,
  findTags,
  innerHtml,
  plainText,
} from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 表のマーカーと見出し・行から、マーカーで囲んだ表の Markdown を作る */
function treeTable(mark: Record<string, unknown>, rows: string[]): string {
  return [
    `<!-- table: ${JSON.stringify(mark)} -->`,
    "",
    ...rows,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 階層の表の行の開始タグを、並んだ順に返却する */
function treeRows(html: string): string[] {
  return findTags(html, "mdmark-tree-row").filter((tag) =>
    tag.startsWith("<tr"),
  );
}

/** 開始タグの属性の値を返却する（無ければ `undefined`） */
function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

// 表に無い親の行を補い、行にパスと深さを付ける（正常系）
test("test_decorate_tree_table", () => {
  // 準備
  const markdown = treeTable(
    { kind: "data", tree: { key: { column: "キー" } } },
    [
      "| キー | 説明 |",
      "| --- | --- |",
      "| features.table | 表の機能 |",
      "| features.html | 埋め込んだ HTML の機能 |",
      "| aliases[].id | 別名の ID |",
    ],
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const rows = treeRows(html);
  expect(rows.map((tag) => attr(tag, "data-path"))).toEqual([
    "features",
    "features.table",
    "features.html",
    "aliases[]",
    "aliases[].id",
  ]);
  for (const index of [0, 3]) {
    const classes = attr(rows[index] as string, "class")?.split(/\s+/) ?? [];
    expect(classes).toEqual(
      expect.arrayContaining(["mdmark-tree-row", "is-virtual", "has-children"]),
    );
  }
  expect(attr(rows[4] as string, "data-depth")).toBe("1");
  expect(attr(rows[4] as string, "data-parent")).toBe("aliases[]");
  expect(findTag(html, 'class="mdmark-table"')).toMatch(/\sdata-tree="0"/);
});

// 型をバッジとチップにし、必須の列を出さず * にし、既定を囲む（正常系）
test("test_decorate_tree_table_when_columns", () => {
  // 準備
  const markdown = treeTable(
    {
      kind: "data",
      tree: {
        key: { column: "キー" },
        type: { column: "型" },
        required: { column: "必須" },
        default: { column: "既定" },
      },
    },
    [
      "| キー | 型 | 必須 | 既定 | 説明 |",
      "| --- | --- | --- | --- | --- |",
      "| features.table | bool | ✓ | true | 表の機能 |",
      "| aliases[].type | ref \\| custom | | | 別名の種類 |",
    ],
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTag(html, "mdmark-type-badge")).toContain('data-type="bool"');
  const chips = findTags(html, "mdmark-type-chip");
  expect(chips).toHaveLength(2);
  const head = innerHtml(html, "<thead");
  expect(plainText(head)).not.toContain("必須");
  const required = findTags(html, "mdmark-tree-required");
  expect(required).toHaveLength(1);
  const tableRow = innerHtml(html, 'data-path="features.table"');
  expect(tableRow).toContain("mdmark-tree-required");
  expect(html).toContain('<span class="mdmark-tree-default">true</span>');
});

/** `tree` の `key` が `キー`、`example.heading` が `設定の見本` の表と、見出し `設定の見本` の下の 2 つのタブを持つ文書 */
const EXAMPLE_DOC = [
  treeTable(
    {
      kind: "data",
      tree: { key: { column: "キー" }, example: { heading: "設定の見本" } },
    },
    [
      "| キー | 説明 |",
      "| --- | --- |",
      "| features.table | 表の機能 |",
      "| aliases[].id | 別名の ID |",
    ],
  ),
  "## 設定の見本",
  "",
  "<!-- tabs -->",
  "",
  "### 最小",
  "",
  "```yaml",
  "features:",
  "  table: true",
  "```",
  "",
  "### エイリアス",
  "",
  "```yaml",
  "aliases:",
  "  - id: terms",
  "```",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

// 見出しの下のタブを表の下へ移し、見本の行にパスを付ける（正常系）
test("test_link_tree_examples", () => {
  // 準備
  const markdown = EXAMPLE_DOC;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const layout = innerHtml(html, 'class="mdmark-tree-layout"');
  const tableAt = layout.indexOf('class="mdmark-table"');
  const exampleAt = layout.indexOf("mdmark-tree-example");
  expect(tableAt).toBeGreaterThanOrEqual(0);
  expect(exampleAt).toBeGreaterThan(tableAt);
  const example = innerHtml(layout, "mdmark-tree-example");
  expect(findTag(layout, "mdmark-tree-example")).toContain(
    'aria-label="見本: 設定の見本"',
  );
  expect(plainText(example)).toContain("最小");
  expect(plainText(example)).toContain("エイリアス");
  const heading = findTag(html, "<h2");
  expect(html.indexOf(heading)).toBeGreaterThan(html.indexOf(layout));
  const idLine = findTags(example, "mdmark-yaml-line").find((tag) =>
    tag.includes('data-path="aliases[].id"'),
  );
  expect(idLine).toBeDefined();
});

// 見出しが無い `example.heading` は記載の警告にし、見本を配置しない（異常系）
test("test_link_tree_examples_when_heading_missing", () => {
  // 準備
  const markdown = treeTable(
    {
      kind: "data",
      tree: { key: { column: "キー" }, example: { heading: "見本" } },
    },
    ["| キー | 説明 |", "| --- | --- |", "| features.table | 表の機能 |"],
  );
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warningAt = html.indexOf("mdmark-syntax-warning");
  expect(warningAt).toBeGreaterThanOrEqual(0);
  expect(warningAt).toBeLessThan(html.indexOf("<table"));
  expect(html).not.toContain("mdmark-tree-example");
});
