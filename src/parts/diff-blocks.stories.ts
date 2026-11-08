import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffBlocks" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const AddParagraph: Story = {
  name: "AddParagraph",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "add",
    unit: "block",
    html: "<p>確認する項目は表のとおりです。</p>",
  },
};

export const DelParagraph: Story = {
  name: "DelParagraph",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "del",
    unit: "block",
    html: '<p data-source-line="4">リリースの前日までに、変更履歴の下書きを用意しておきます。</p>',
  },
};

export const AddHeading: Story = {
  name: "AddHeading",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "add",
    unit: "block",
    html: '<h2 id="リリースの後">リリースの後</h2>',
  },
};

export const TableRowDel: Story = {
  name: "TableRowDel",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "del",
    unit: "row",
    html: "<tr><td>配布物</td><td><code>dist/</code> にバージョンが埋まっている</td><td>開発者</td></tr>",
  },
};

export const ListItemDel: Story = {
  name: "ListItemDel",
  parameters: { server: { id: "diff-blocks" } },
  args: { kind: "del", unit: "item", html: "<li>release ブランチを消す</li>" },
};

export const CodeBlock: Story = {
  name: "CodeBlock",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "add",
    unit: "block",
    html: "<pre><code>npm run build</code></pre>",
  },
};

export const Callout: Story = {
  name: "Callout",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "del",
    unit: "block",
    html: '<div class="mdmark-callout" data-kind="note"><p>配布物が届くまで数分かかります。</p></div>',
  },
};

export const LongUrl: Story = {
  name: "LongUrl",
  parameters: { server: { id: "diff-blocks" } },
  args: {
    kind: "add",
    unit: "block",
    html: "<p>https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.9.0/dist/index.js?cache-bust=20261030-feature-vscode-diff-view-preview</p>",
  },
};
