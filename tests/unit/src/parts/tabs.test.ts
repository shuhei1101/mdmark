import { expect, test } from "vitest";
import { findTags, matches } from "../../helpers/html.ts";

/** タブの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTabs = () => import("../../../../src/parts/tabs.ts");

// selected が無ければ全ての中身を隠さずに出す（正常系）
test("test_render_tabs", async () => {
  // 準備
  const { renderTabs } = await loadTabs();
  // 実行
  const html = renderTabs({
    id: "t",
    titles: ["macOS", "Windows"],
    panels: ["<p>a</p>", "<p>b</p>"],
  });
  // 検証
  expect(html.startsWith('<div class="mdmark-tabs">')).toBe(true);
  expect(matches(html, /mdmark-tab-title/g)).toHaveLength(2);
  expect(html).not.toContain('role="tablist"');
  expect(html).not.toMatch(/\shidden\b/);
});

// selected のタブだけを出す（正常系）
test("test_render_tabs_when_selected", async () => {
  // 準備
  const { renderTabs } = await loadTabs();
  // 実行
  const html = renderTabs({
    id: "t",
    titles: ["macOS", "Windows"],
    panels: ["<p>a</p>", "<p>b</p>"],
    selected: 1,
  });
  // 検証
  expect(html).toContain('role="tablist"');
  const tabs = findTags(html, 'role="tab"');
  expect(tabs).toHaveLength(2);
  expect(tabs[1]).toContain('aria-selected="true"');
  expect(tabs[1]).toContain('tabindex="0"');
  expect(tabs[0]).not.toContain('aria-selected="true"');
  const panels = findTags(html, 'role="tabpanel"');
  expect(panels).toHaveLength(2);
  expect(panels[0]).toMatch(/\shidden\b/);
  expect(panels[1]).not.toMatch(/\shidden\b/);
});

// group を data-group に写す（正常系）
test("test_render_tabs_when_group", async () => {
  // 準備
  const { renderTabs } = await loadTabs();
  // 実行
  const html = renderTabs({
    id: "t",
    titles: ["macOS", "Windows"],
    panels: ["<p>a</p>", "<p>b</p>"],
    group: 'os"&',
  });
  // 検証
  expect(
    html.startsWith('<div class="mdmark-tabs" data-group="os&quot;&amp;">'),
  ).toBe(true);
});

// 折り畳みの見出しをタブ名か title にする（正常系）
test("test_render_tabs_when_collapsed", async () => {
  // 準備
  const { renderTabs } = await loadTabs();
  // 実行
  const closed = renderTabs({
    id: "t",
    titles: ["uv", "pip"],
    panels: ["<p>a</p>", "<p>b</p>"],
    selected: 0,
    collapse: "closed",
  });
  const opened = renderTabs({
    id: "t",
    titles: ["macOS", "Windows"],
    panels: ["<p>a</p>", "<p>b</p>"],
    selected: 0,
    collapse: "open",
    title: "入れ方",
  });
  // 検証
  expect(
    closed.startsWith(
      '<details class="mdmark-collapsible"><summary>タブ（uv・pip）</summary><div class="mdmark-tabs"',
    ),
  ).toBe(true);
  expect(
    opened.startsWith(
      '<details class="mdmark-collapsible" open><summary>入れ方</summary>',
    ),
  ).toBe(true);
});

// タブ名の strong をそのまま配置する（正常系）
test("test_render_tabs_when_strong_title", async () => {
  // 準備
  const { renderTabs } = await loadTabs();
  // 実行
  const html = renderTabs({
    id: "t",
    titles: ["<strong>案 A</strong> SVG のまま", "案 B"],
    panels: ["<p>a</p>", "<p>b</p>"],
    selected: 0,
    collapse: "closed",
  });
  // 検証
  const firstTab = html.slice(
    html.indexOf('id="t-tab-0"'),
    html.indexOf("</button>"),
  );
  expect(firstTab).toContain("<strong>案 A</strong>");
  expect(html).toContain(
    '<p class="mdmark-tab-title"><strong>案 A</strong> SVG のまま</p>',
  );
  expect(html).toContain("<summary>タブ（案 A SVG のまま・案 B）</summary>");
  expect(html).not.toContain("&lt;strong&gt;");
});

// タブ名のリンクはボタンでは文字にし、中身のタブ名には残す（正常系）
test("test_render_tabs_when_link_title", async () => {
  // 準備
  const { renderTabs } = await loadTabs();
  // 実行
  const html = renderTabs({
    id: "t",
    titles: ['<a href="https://example.com">設定</a>', "案 B"],
    panels: ["<p>a</p>", "<p>b</p>"],
    selected: 0,
  });
  // 検証
  const firstTab = html.slice(
    html.indexOf('id="t-tab-0"'),
    html.indexOf("</button>"),
  );
  expect(firstTab).not.toContain("<a");
  expect(firstTab).toContain("設定");
  expect(html).toContain(
    '<p class="mdmark-tab-title"><a href="https://example.com">設定</a></p>',
  );
});
