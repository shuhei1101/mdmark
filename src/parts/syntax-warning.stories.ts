import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/SyntaxWarning" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const TypeMismatch: Story = {
  name: "TypeMismatch",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- tabs: {"collapse": "closed"} -->',
    message:
      'の `collapse` には `open`・`title` を持つオブジェクトを記載してください（例 `{"open": false}`）。折り畳みに入れずに描いています。',
  },
};

export const InvalidJson: Story = {
  name: "InvalidJson",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- details: {"title": 補足} -->',
    message:
      'の引数を JSON として読めません（11 文字目の `補` で、値の文字を `"` で囲んでいません）。値の文字は `"` で囲んでください。既定の設定で描いています。',
  },
};

export const CommentEndInValue: Story = {
  name: "CommentEndInValue",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- details: {"title": "a -->',
    message:
      "の引数を JSON として読めません（文字の値が閉じていません）。値に `-->` を記載すると、コメントがそこで閉じます。`>` を `\\u003e` にした `--\\u003e` で記載してください。既定の設定で描いています。",
  },
};

export const LegacyExtension: Story = {
  name: "LegacyExtension",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- greet: world -->",
    message:
      'の引数は JSON のオブジェクトで記載してください（例: `<!-- greet: {"target": "world"} -->`）。拡張 `greet` の部品は描いていません。`mdmark upgrade` の移行の報告で、記載し直す箇所を確かめられます。',
  },
};

export const Items: Story = {
  name: "Items",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "max"}]}, "名前": {"hidden": true}}} -->',
    message: "の読み込めない指定を当てずに描いています。",
    items:
      '[{"label":"columns.数量.total[0].calc","message":"`max` は選べる値にありません。選べる値は `sum`・`avg`・`count` です"},{"label":"columns.名前.hidden","message":"先頭の列は隠せません。当てずに描いています"}]',
  },
};

export const BrokenReference: Story = {
  name: "BrokenReference",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    message:
      'リンク先の `#fig-missing` の図表がありません。`<!-- fig: {"id": "missing"} -->` を図か表の直前に記載するか、リンク先を修正してください。',
  },
};

export const ExtensionSchema: Story = {
  name: "ExtensionSchema",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- greet: {"target": "World", "count": "2"} -->',
    message:
      "の引数が、拡張 `greet` の決まりに合いません。修正してから再読み込みしてください。",
    items:
      '[{"label":"target","message":"Invalid format: Expected /^[a-z]+$/ but received \\"World\\""},{"label":"count","message":"Invalid type: Expected number but received \\"2\\""}]',
  },
};

export const LongMark: Story = {
  name: "LongMark",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- table: {"kind": "data", "columns": {"とても長い列の名前": {"filter": {"type": "range"}}, "もう一つの長い列の名前": {"filter": {"type": "text"}}, "更新日": {"filter": {"type": "date"}}}} -->',
    message:
      "の `filter.type` の `range` は選べる値にありません。選べる値は `select`・`text`・`date` です。",
  },
};

export const GlossaryColumn: Story = {
  name: "GlossaryColumn",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "説明"}} -->',
    message:
      "の `meaning.column` の列 `説明` が表にありません。表の列は `用語`・`意味` です。列名を修正してください。この表からは用語を入れずに描いています。",
  },
};

export const GlossaryMissingArg: Story = {
  name: "GlossaryMissingArg",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- glossary: {"term": {"column": "用語"}} -->',
    message:
      'に必須の `meaning` がありません。意味の列を `"meaning": {"column": "列名"}` で指してください。この表からは用語を入れずに描いています。',
  },
};

export const ViewGroupColumn: Story = {
  name: "ViewGroupColumn",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- view: {"board": {"group": {"column": "優先度"}}} -->',
    message:
      "の列 `優先度` は表にありません。表の列は `タイトル`・`状態`・`担当` です。ボードにせず、表で描いています。",
  },
};

export const ViewNoTable: Story = {
  name: "ViewNoTable",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- view: {"board": {"group": {"column": "状態"}}} -->',
    message:
      "の範囲に、項目にする表がありません。範囲の中に Markdown の表を記載してください。範囲の中身はそのまま描いています。",
  },
};

export const ViewUnknownIcon: Story = {
  name: "ViewUnknownIcon",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- view: {"board": {"group": {"column": "状態"}, "values": {"完了": {"icon": "rocket"}}}} -->',
    message:
      "のアイコン `rocket` は使用できません。使用できるアイコンは `circle`・`circle-dashed`・`circle-dot`・`circle-pause`・`circle-check`・`circle-x`・`inbox`・`archive`・`clock`・`flag`・`star`・`bug`・`eye`・`lock`・`zap`・`ban` です。`完了` の列には既定のアイコンを付けています。",
  },
};

export const IconName: Story = {
  name: "IconName",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "icon:Rocket!",
    message:
      "の `Rocket!` は Lucide のアイコンの名前になりません。名前は英小文字・数字・`-` で記載します（例: `rocket`）。記載した文字のまま表示しています。",
  },
};

export const IconNotInLucide: Story = {
  name: "IconNotInLucide",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "icon:no-such-icon",
    message:
      "の `no-such-icon` は Lucide に無いアイコンの名前です。https://lucide.dev/icons/ で名前を確認してください。記載した文字のまま表示しています。",
  },
};

export const ColumnsCount: Story = {
  name: "ColumnsCount",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: "<!-- columns -->",
    message:
      "の範囲が 4 列です。横に並べられるのは 2〜3 列です。`<!-- column -->` を減らしてください。中身を記載した順に表示しています。",
  },
};

export const IncludeMissing: Story = {
  name: "IncludeMissing",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- include: {"path": "src/app.ts", "lines": {"from": 20, "to": 22}} -->',
    message:
      "の `src/app.ts` は 12 行で、20〜22 行目がありません。行の範囲を修正してください。",
  },
};

export const IncludeCircular: Story = {
  name: "IncludeCircular",
  parameters: { server: { id: "syntax-warning" } },
  args: {
    mark: '<!-- include: {"path": "a.md"} -->',
    message:
      "の取り込みが循環しています（`a.md` → `b.md` → `a.md`）。この場所では取り込んでいません。",
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
