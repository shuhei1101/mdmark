import { expect, test } from "vitest";
import { type Mark, parseMarkArgs } from "../../../../../src/render/marks.ts";
import { matches } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** タブの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTabs = () => import("../../../../../src/render/syntax/tabs.ts");

/** `<!-- tabs: {rest} -->` の開きの印（引数が無ければ `<!-- tabs -->`） */
function tabsMark(rest?: string): Mark {
  return {
    name: "tabs",
    args: parseMarkArgs(rest ?? ""),
    raw: rest === undefined ? "<!-- tabs -->" : `<!-- tabs: ${rest} -->`,
    closing: false,
    rest: rest ?? "",
  };
}

/** 印の開きを `open` にして `### macOS`・`### Windows` を囲んだ Markdown */
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
  const markdown = tabsMarkdown("<!-- tabs: group=os -->");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain('<div class="mdmark-tabs" data-group="os">');
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 読めない指定は警告にしてタブにはする（正常系）
test("test_build_tabs_when_unreadable_options", () => {
  // 準備
  const markdown = tabsMarkdown("<!-- tabs: group= grop=os fold -->");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /class="mdmark-syntax-warning"/g)).toHaveLength(1);
  for (const label of ["group=", "grop=", "fold"]) {
    expect(html).toContain(`<code>${label}</code>`);
  }
  expect(html).toContain('<div class="mdmark-tabs">');
  expect(html).not.toContain("data-group");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf("mdmark-tabs"),
  );
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
});

// group を読む（正常系）
test("test_read_tabs_options", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const options = readTabsOptions(tabsMark("group=os"));
  // 検証
  expect(options.group).toBe("os");
  expect(options.warning).toBeUndefined();
});

// 引数が無ければ組も警告も無い（正常系）
test("test_read_tabs_options_when_none", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const options = readTabsOptions(tabsMark());
  // 検証
  expect(options.group).toBeUndefined();
  expect(options.warning).toBeUndefined();
});

// 読めない指定を 1 つの警告にまとめる（異常系）
test("test_read_tabs_options_when_unreadable", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const options = readTabsOptions(tabsMark("group= grop=os fold"));
  // 検証
  expect(options.group).toBeUndefined();
  expect(options.warning?.message).toBe(
    "の読めない指定を当てずに描いています。",
  );
  expect(options.warning?.mark).toBe("<!-- tabs: group= grop=os fold -->");
  const items = options.warning?.items ?? [];
  expect(items.map((item) => item.label).sort()).toEqual(
    ["fold", "grop=", "group="].sort(),
  );
  const message = (label: string): string =>
    items.find((item) => item.label === label)?.message ?? "";
  expect(message("group=")).toContain("組の名前がありません");
  expect(message("group=")).toContain("組を持たないタブとして描いています");
  expect(message("grop=")).toContain("使えないキーです");
  expect(message("fold")).toContain("使えない指定です");
});

// closed のタブをタブ名の見出しの折り畳みに入れる（正常系）
test("test_build_tabs_when_collapsed", () => {
  // 準備
  const markdown = [
    "<!-- tabs: closed -->",
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

// 折り畳みの指定を group と一緒に読む（正常系）
test("test_read_tabs_options_when_collapse", async () => {
  // 準備
  const { readTabsOptions } = await loadTabs();
  // 実行
  const opened = readTabsOptions(tabsMark("open title=入れ方 group=os"));
  const conflict = readTabsOptions(tabsMark("closed open"));
  // 検証
  expect(opened.group).toBe("os");
  expect(opened.collapse).toBe("open");
  expect(opened.title).toBe("入れ方");
  expect(opened.warning).toBeUndefined();
  expect(conflict.collapse).toBe("closed");
  expect((conflict.warning?.items ?? []).map((item) => item.label)).toEqual([
    "closed と open",
  ]);
});
