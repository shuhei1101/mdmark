import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/SyntaxWarning" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const UnknownKind: Story = {
  name: "UnknownKind",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- table: unknown +sort -->",
    message:
      "の種類 `unknown` は使えません。使える種類は `data`・`plain` です。既定の種類に `+sort` を当てて描いています。",
  },
};

export const Items: Story = {
  name: "Items",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- table: data +unknown size=2 -->",
    message: "の読めない指定を当てずに描いています。",
    items:
      '[{"label":"+unknown","message":"使えない機能です。使える機能は `sort`・`pin`・`filter` です"},{"label":"size=","message":"使えないキーです。使えるキーは `filter=` です"}]',
  },
};

export const BrokenReference: Story = {
  name: "BrokenReference",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    message:
      "リンク先の `#fig-missing` の図表がありません。`<!-- fig: missing -->` を図か表の直前に書くか、リンク先を直してください。",
  },
};

export const ExtensionSchema: Story = {
  name: "ExtensionSchema",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- greet: World 2 -->",
    message:
      "の引数が、拡張 `greet` の決まりに合いません。直してから読み込み直してください。",
    items:
      '[{"label":"1 つ目の World","message":"Invalid format: Expected /^[a-z]+$/ but received \\"World\\""},{"label":"2 つ目の 2","message":"Invalid type: Expected never but received \\"2\\""}]',
  },
};

export const LongMark: Story = {
  name: "LongMark",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- table: data filter=とても長い列の名前:range,もう一つの長い列の名前:text,更新日:date -->",
    message:
      "の絞り込みの種類 `range` は使えません。使える種類は `select`・`text`・`date` です。",
  },
};

export const GlossaryColumn: Story = {
  name: "GlossaryColumn",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- glossary: term=用語 meaning=説明 -->",
    message:
      "の `meaning=` の列 `説明` が表にありません。表の列は `用語`・`意味` です。列名を直してください。この表からは用語を入れずに描いています。",
  },
};

export const GlossaryMissingArg: Story = {
  name: "GlossaryMissingArg",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- glossary: term=用語 -->",
    message:
      "に `meaning=` がありません。意味の列を `meaning=列名` で指してください。この表からは用語を入れずに描いています。",
  },
};

export const ViewGroupColumn: Story = {
  name: "ViewGroupColumn",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- view: group=優先度 -->",
    message:
      "の列 `優先度` は表にありません。表の列は `題`・`状態`・`担当` です。ボードにせず、表で描いています。",
  },
};

export const ViewNoTable: Story = {
  name: "ViewNoTable",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- view: group=状態 -->",
    message:
      "の範囲に、項目にする表がありません。範囲の中に Markdown の表を書いてください。範囲の中身はそのまま描いています。",
  },
};

export const ViewUnknownIcon: Story = {
  name: "ViewUnknownIcon",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- view: group=状態 icons=完了:rocket -->",
    message:
      "のアイコン `rocket` は使えません。使えるアイコンは `circle`・`circle-dashed`・`circle-dot`・`circle-pause`・`circle-check`・`circle-x`・`inbox`・`archive`・`clock`・`flag`・`star`・`bug`・`eye`・`lock`・`zap`・`ban` です。`完了` の列には既定のアイコンを付けています。",
  },
};

export const IconName: Story = {
  name: "IconName",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "icon:Rocket!",
    message:
      "の `Rocket!` は Lucide のアイコンの名前になりません。名前は英小文字・数字・`-` で書きます（例: `rocket`）。書いた文字のまま表示しています。",
  },
};

export const IconNotInLucide: Story = {
  name: "IconNotInLucide",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "icon:no-such-icon",
    message:
      "の `no-such-icon` は Lucide に無いアイコンの名前です。https://lucide.dev/icons/ で名前を確かめてください。書いた文字のまま表示しています。",
  },
};

export const ColumnsCount: Story = {
  name: "ColumnsCount",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- columns -->",
    message:
      "の範囲が 4 列です。横に並べられるのは 2〜3 列です。`<!-- column -->` を減らしてください。中身を書いた順に表示しています。",
  },
};

export const IncludeMissing: Story = {
  name: "IncludeMissing",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- include: src/app.ts#L20-L22 -->",
    message:
      "の `src/app.ts` は 12 行で、20〜22 行目がありません。行の範囲を修正してください。",
  },
};

export const IncludeCircular: Story = {
  name: "IncludeCircular",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- include: a.md -->",
    message:
      "の取り込みが循環しています（`a.md → b.md → a.md`）。この場所では取り込んでいません。",
  },
};

export const CsvColumns: Story = {
  name: "CsvColumns",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    message:
      "CSV の 2 行目・3 行目の列の数が、見出しの行の 3 列と違います。見出しの列の数にそろえて表示しています。",
  },
};
