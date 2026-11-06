import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/View" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Board: Story = {
  name: "Board",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    id: "story-view",
  },
};

export const Table: Story = {
  name: "Table",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    mode: "table",
    filters: '[{"column":2,"kind":"select"}]',
    id: "story-view",
  },
};

export const TableFilteredSelect: Story = {
  name: "TableFilteredSelect",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    mode: "table",
    filters: '[{"column":2,"kind":"select"}]',
    filterValues: '[{"column":2,"values":["佐藤"]}]',
    id: "story-view",
  },
};

export const BoardAfterFilter: Story = {
  name: "BoardAfterFilter",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    filters: '[{"column":2,"kind":"select"}]',
    filterValues: '[{"column":2,"values":["佐藤"]}]',
    id: "story-view",
  },
};

export const TableFilteredText: Story = {
  name: "TableFilteredText",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    mode: "table",
    filters: '[{"column":0,"kind":"text"}]',
    filterValues: '[{"column":0,"text":"表"}]',
    openFilter: "0",
    id: "story-view",
  },
};

export const TableNoMatch: Story = {
  name: "TableNoMatch",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    mode: "table",
    filters: '[{"column":0,"kind":"text"}]',
    filterValues: '[{"column":0,"text":"山田"}]',
    id: "story-view",
  },
};

export const DefaultIcons: Story = {
  name: "DefaultIcons",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態"]',
    items:
      '[["項目 1","未着手"],["項目 2","進行中"],["項目 3","保留"],["項目 4","完了"],["項目 5","中止"]]',
    group: "状態",
    id: "story-view",
  },
};

export const OverriddenIcons: Story = {
  name: "OverriddenIcons",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"],["表を絞り込む","未着手","佐藤"],["アイコンを決める","完了","高橋"],["印刷を直す","進行中",""]]',
    group: "状態",
    icons: '{"未着手":"inbox","完了":"archive"}',
    id: "story-view",
  },
};

export const ManyColumns: Story = {
  name: "ManyColumns",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","段階"]',
    items:
      '[["項目 1","受付"],["項目 2","設計"],["項目 3","実装"],["項目 4","テスト"],["項目 5","レビュー"],["項目 6","リリース"],["項目 7","運用"]]',
    group: "段階",
    id: "story-view",
  },
};

export const LongTitleEmptyValue: Story = {
  name: "LongTitleEmptyValue",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当","期限"]',
    items:
      '[["使う側のページが自分の JavaScript からビューを描き、拡張のモジュールからも同じ関数を呼べるようにして、文書の印と同じ見た目で出す","進行中","佐藤",""],["短い題","進行中","","2026-11-01"]]',
    group: "状態",
    id: "story-view",
  },
};

export const BoardDisabled: Story = {
  name: "BoardDisabled",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"]]',
    group: "段階",
    boardDisabled: "story-warning",
    id: "story-view",
  },
};

export const TableOnly: Story = {
  name: "TableOnly",
  parameters: { server: { id: "view" } },
  args: {
    columns: '["題","状態","担当"]',
    items:
      '[["ビューを描く","進行中","佐藤"],["コメントを保存する","未着手","鈴木"]]',
    id: "story-view",
  },
};
