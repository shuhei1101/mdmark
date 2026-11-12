import { expect, test } from "vitest";
import { markOf } from "../../../../../src/render/syntax/tokens.ts";
import { parseWithRules } from "../../../helpers/core-rules.ts";
import { findTags, innerHtml, matches } from "../../../helpers/html.ts";
import { jsonMark } from "../../../helpers/marks.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** タブの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTabs = () => import("../../../../../src/render/syntax/tabs.ts");

/** マーカーの開きを `open` にして `### macOS`・`### Windows` を囲んだ Markdown */
function tabsMarkdown(open: string): string {
  return [
    open,
    "",
    "### macOS",
    "",
    "macOS の手順",
    "",
    "### Windows",
    "",
    "Windows の手順",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
}

// 見出しごとの中身に区切る（正常系）
test("test_build_tabs", () => {
  // 準備
  const markdown = [
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "macOS の手順",
    "",
    "### Windows",
    "",
    "Windows の手順",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<div class="mdmark-tabs">');
  expect(html).toContain('<p class="mdmark-tab-title">macOS</p>');
  expect(html).toContain('<p class="mdmark-tab-title">Windows</p>');
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
  expect(html).toContain("macOS の手順");
  expect(html).toContain("Windows の手順");
  expect(html).not.toContain("<h3");
});

// 見出しの無い範囲は警告と中身にする（正常系）
test("test_build_tabs_when_no_heading", () => {
  // 準備
  const markdown = "<!-- tabs -->\n\n段落だけ\n\n<!-- /tabs -->\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("<p>段落だけ</p>");
  expect(html).not.toContain("mdmark-tabs");
});

// group を部品に写す（正常系）
test("test_build_tabs_when_group", () => {
  // 準備
  const markdown = tabsMarkdown('<!-- tabs: {"group": "os"} -->');
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<div class="mdmark-tabs" data-group="os">');
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 読み込めない指定は警告にしてタブにはする（異常系）
test("test_build_tabs_when_unreadable_options", () => {
  // 準備
  const markdown = tabsMarkdown('<!-- tabs: {"group": "", "grop": "os"} -->');
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
  expect(html).toContain("group");
  const unknown = warnings
    .filter((warning) => warning.kind === "unknown_mark_arg")
    .map((warning) => warning.message)
    .join("\n");
  expect(unknown).toContain("grop");
  expect(html).toContain('<div class="mdmark-tabs">');
  expect(html).not.toContain("data-group");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("mdmark-tabs"),
  );
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
});

// group を読み込む（正常系）
test("test_read_tabs_options", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const options = readTabsOptions(jsonMark("tabs", { group: "os" }));
  // 検証
  expect(options.group).toBe("os");
  expect(options.collapse).toBe("none");
});

// 引数が無ければ組も折り畳みも無い（正常系）
test("test_read_tabs_options_when_none", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const options = readTabsOptions(jsonMark("tabs"));
  // 検証
  expect(options.group).toBeUndefined();
  expect(options.collapse).toBe("none");
});

// closed のタブをタブ名の見出しの折り畳みに入れる（正常系）
test("test_build_tabs_when_collapsed", () => {
  // 準備
  const markdown = [
    '<!-- tabs: {"collapse": {"open": false}} -->',
    "",
    "### uv",
    "",
    "uv で入れる",
    "",
    "### pip",
    "",
    "pip で入れる",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="mdmark-collapsible"><summary>タブ（uv・pip）</summary><div class="mdmark-tabs"',
  );
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 折り畳みの指定を group と一緒に読み込む（正常系）
test("test_read_tabs_options_when_collapse", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const options = readTabsOptions(
    jsonMark("tabs", {
      group: "os",
      collapse: { open: true, title: "入れ方" },
    }),
  );
  // 検証
  expect(options).toEqual({ group: "os", collapse: "open", title: "入れ方" });
});

/** 外側のタブで `### macOS`・`### **Windows**` を囲み、`macOS` の中に `#### zsh`・`#### bash` の内側のタブを配置した Markdown（`innerClose` が偽なら内側の閉じを記載しない） */
function nestedTabsMarkdown(innerClose: boolean): string {
  return [
    "<!-- tabs -->",
    "",
    "### macOS",
    "",
    "<!-- tabs -->",
    "",
    "#### zsh",
    "",
    "zsh の手順",
    "",
    "#### bash",
    "",
    "bash の手順",
    "",
    ...(innerClose ? ["<!-- /tabs -->", ""] : []),
    "### **Windows**",
    "",
    "Windows の手順",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
}

/** Markdown の中のタブのマーカーのトークンの位置 */
function tabsMarkIndexes(markdown: string): number[] {
  const tokens = parseWithRules(markdown, []);
  return tokens.flatMap((token, index) =>
    markOf(token)?.name === "tabs" ? [index] : [],
  );
}

// 入れ子のタブを外側の中身の中のタブにする（正常系）
test("test_build_tabs_when_nested", () => {
  // 準備
  const markdown = nestedTabsMarkdown(true);
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-tabs"/g)).toHaveLength(2);
  expect(matches(html, /class="mdmark-tab-panel"/g)).toHaveLength(4);
  const macos = innerHtml(html, "mdmark-tab-panel");
  expect(macos).toContain('<p class="mdmark-tab-title">macOS</p>');
  expect(macos).toContain('class="mdmark-tabs"');
  expect(macos).toContain('<p class="mdmark-tab-title">zsh</p>');
  expect(macos).toContain('<p class="mdmark-tab-title">bash</p>');
  const windows = html.slice(html.indexOf("<strong>Windows</strong>"));
  expect(windows).not.toContain("zsh");
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<!--");
});

// 見出しの強調をタブ名の strong に残す（正常系）
test("test_build_tabs_when_strong_title", () => {
  // 準備
  const markdown = [
    "<!-- tabs -->",
    "",
    "### **Windows**",
    "",
    "Windows の手順",
    "",
    "### macOS",
    "",
    "macOS の手順",
    "",
    "<!-- /tabs -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<p class="mdmark-tab-title"><strong>Windows</strong></p>',
  );
  expect(html).not.toContain("**");
});

// 閉じの足りない入れ子は外側の開きに警告を配置し、タブにしない（異常系）
test("test_build_tabs_when_nested_unclosed", () => {
  // 準備
  const markdown = nestedTabsMarkdown(false);
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(findTags(html, 'class="mdmark-syntax-warning"')).toHaveLength(1);
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("<h3"),
  );
  expect(html).not.toContain("mdmark-tabs");
  for (const title of ["macOS", "Windows"]) {
    expect(matches(html, new RegExp(`<h3[^>]*>.*${title}`, "g"))).toHaveLength(
      1,
    );
  }
  for (const title of ["zsh", "bash"]) {
    expect(matches(html, new RegExp(`<h4[^>]*>.*${title}`, "g"))).toHaveLength(
      1,
    );
  }
  for (const text of ["zsh の手順", "bash の手順", "Windows の手順"]) {
    expect(html).toContain(text);
  }
});

// 入れ子の閉じを飛ばして外側の閉じを返却する（正常系）
test("test_find_tabs_close", async () => {
  // 準備
  const { findTabsClose } = await loadTabs();
  const markdown = nestedTabsMarkdown(true);
  const tokens = parseWithRules(markdown, []);
  const marks = tabsMarkIndexes(markdown);
  // 実行
  const found = findTabsClose(tokens, marks[0] ?? -1);
  // 検証
  expect(marks).toHaveLength(4);
  expect(found).toEqual({ close: marks[3], nested: true });
});

// 閉じが足りなければ -1 を返却する（異常系）
test("test_find_tabs_close_when_unclosed", async () => {
  // 準備
  const { findTabsClose } = await loadTabs();
  const markdown = nestedTabsMarkdown(false);
  const tokens = parseWithRules(markdown, []);
  const marks = tabsMarkIndexes(markdown);
  // 実行
  const found = findTabsClose(tokens, marks[0] ?? -1);
  // 検証
  expect(marks).toHaveLength(3);
  expect(found).toEqual({ close: -1, nested: true });
});
