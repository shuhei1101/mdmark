import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Steps" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Basic: Story = {
  name: "Basic",
  parameters: { server: { id: "steps" } },
  args: {
    items: '["配布物を読み込む","描く先の要素を用意する","mount を呼ぶ"]',
  },
};

export const Rich: Story = {
  name: "Rich",
  parameters: { server: { id: "steps" } },
  args: {
    items:
      '["<p>依存を入れる</p><pre><code>npm ci</code></pre>","<p>確認する</p><ol><li>lint</li><li>型検査</li></ol>"]',
  },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "steps" } },
  args: {
    items:
      '["とても長い手順の説明で、画面の幅を超えて何行かに折り返すときに、番号と線の位置がずれないことを確認する","短い手順"]',
  },
};

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "steps" } },
  args: {
    items: '["配布物を読み込む","描く先の要素を用意する","mount を呼ぶ"]',
    collapse: "closed",
  },
};

export const OpenTitle: Story = {
  name: "OpenTitle",
  parameters: { server: { id: "steps" } },
  args: {
    items: '["配布物を読み込む","描く先の要素を用意する","mount を呼ぶ"]',
    collapse: "open",
    title: "準備",
  },
};
