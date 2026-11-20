import { expect, test } from "vitest";
import { findTag, findTags, innerHtml, matches } from "../../helpers/html.ts";

/** 一覧の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadList = () => import("../../../../src/map/list.part.ts");

/** 部品設計『mapの一覧』の Flow の項目 */
const FLOW_ITEMS = [
  {
    id: "user",
    name: "利用側のページ",
    kind: "外部",
    out: ["→ mount（設定と Markdown）"],
  },
  {
    id: "lib",
    name: "mdmark",
    kind: "グループ",
    out: [],
    children: [
      { id: "mount", name: "mount", kind: "処理", out: ["→ マーカーの読み取り"] },
      {
        id: "read",
        name: "記法の読み取り",
        kind: "グループ",
        out: [],
        children: [
          {
            id: "marker",
            name: "マーカーの読み取り",
            kind: "処理",
            out: ["→ 補足の検査"],
          },
          {
            id: "data",
            name: "補足の検査",
            kind: "処理",
            note: "補足のキーと値を点検する",
            out: ["→ キャッシュ"],
          },
        ],
      },
      { id: "cache", name: "キャッシュ", kind: "保存先", out: [] },
    ],
  },
];

/** 部品設計『mapの一覧』の WithChanges の項目 */
const CHANGE_ITEMS = [
  {
    id: "lib",
    name: "mdmark",
    kind: "グループ",
    out: [],
    children: [
      {
        id: "mount",
        name: "mount",
        kind: "処理",
        change: "changed" as const,
        out: [],
      },
      { id: "cache", name: "キャッシュ", kind: "保存先", change: "added" as const, out: [] },
      {
        id: "legacy",
        name: "旧版の読み取り",
        kind: "処理",
        change: "removed" as const,
        out: [],
      },
    ],
  },
];

// 入れ子の一覧（正常系）
test("test_render_map_list", async () => {
  // 準備
  const { renderMapList } = await loadList();
  // 実行
  const html = renderMapList({ label: "「全体の構成」の一覧", items: FLOW_ITEMS });
  // 検証
  const tree = findTag(html, 'role="tree"');
  expect(tree).toContain('aria-label="「全体の構成」の一覧"');
  expect(tree).toContain("mdmark-map-list");
  const levels = matches(html, /aria-level="(\d)"/g).map((item) =>
    item.replace(/\D/g, ""),
  );
  expect(new Set(levels)).toEqual(new Set(["1", "2", "3"]));
  const group = findTag(html, 'data-id="lib"');
  expect(group).toContain('aria-expanded="true"');
  expect(innerHtml(html, 'data-id="lib"')).toContain('role="group"');
  const focusable = findTags(html, 'tabindex="0"');
  expect(focusable).toHaveLength(1);
  expect(focusable[0]).toContain('data-id="user"');
  expect(findTag(html, 'data-id="user"')).toContain(
    'aria-label="利用側のページ、外部、出る線 1 本"',
  );
});

// 計画した変更（正常系）
test("test_render_map_list_when_changes", async () => {
  // 準備
  const { renderMapList } = await loadList();
  // 実行
  const html = renderMapList({ label: "「計画した変更」の一覧", items: CHANGE_ITEMS });
  // 検証
  const removed = findTag(html, 'data-id="legacy"');
  expect(removed).toContain('data-change="removed"');
  expect(removed).toMatch(/aria-label="旧版の読み取り、削除、処理/);
  const badges = findTags(html, "mdmark-map-change");
  expect(badges).toHaveLength(3);
  for (const badge of badges) expect(badge).toContain('aria-hidden="true"');
});

// 閉じた項目と ID での指定（正常系）
test("test_render_map_list_when_collapsed", async () => {
  // 準備
  const { renderMapList } = await loadList();
  // 実行
  const html = renderMapList({
    label: "「全体の構成」の一覧",
    items: FLOW_ITEMS,
    collapsed: ["read"],
    focused: "read",
  });
  // 検証
  const read = findTag(html, 'data-id="read"');
  expect(read).toContain('aria-expanded="false"');
  expect(read).toContain('tabindex="0"');
  expect(findTags(html, 'tabindex="0"')).toHaveLength(1);
  const group = findTag(innerHtml(html, 'data-id="read"'), 'role="group"');
  expect(group).toContain("hidden");
});
