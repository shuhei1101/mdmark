import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffSideBySide" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

const TABLE =
  "<table><thead><tr><th>項目</th><th>件数</th></tr></thead><tbody><tr><td>受付</td><td>12</td></tr></tbody></table>";

/** 見出し・段落・表を変えず、段落の単語を書き換え、1 つ追加し、1 つ削除した行（描画のインターフェースへは JSON の文字列で渡す） */
const ROWS = [
  { kind: "same", before: "<h2>手順</h2>", after: "<h2>手順</h2>" },
  {
    kind: "change",
    before: "<p>配布物を読み込んでから文書を描きます。</p>",
    after: "<p>配布物を読み込んでから差分を描きます。</p>",
  },
  { kind: "del", before: "<p>古い設定の説明を残します。</p>" },
  { kind: "same", before: TABLE, after: TABLE },
  { kind: "add", after: "<p>新しい段落を足しました。</p>" },
];

export const Wide: Story = {
  name: "Wide",
  parameters: { server: { id: "diff-side-by-side" } },
  args: { rows: JSON.stringify(ROWS), frameWidth: "1280px" },
};

export const LongBlock: Story = {
  name: "LongBlock",
  parameters: { server: { id: "diff-side-by-side" } },
  args: {
    rows: JSON.stringify([
      ...ROWS.slice(0, 4),
      {
        kind: "add",
        after:
          "<p>追加した段落が長いときは、向かいの斜線の空きが段落の高さに合わせて伸びます。差分を開いた読者は、左の列に対応するブロックが無いことを、空きの高さで確かめられます。描く先の要素の幅を変えても、左右のセルの上端は同じ行で揃ったままです。</p>",
      },
    ]),
    frameWidth: "1280px",
  },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "diff-side-by-side" } },
  args: { rows: JSON.stringify(ROWS), frameWidth: "390px" },
};

export const Dark: Story = {
  name: "Dark",
  parameters: { server: { id: "diff-side-by-side" } },
  args: { rows: JSON.stringify(ROWS), frameWidth: "1280px", scheme: "dark" },
};
