import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/LayoutColumns" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Two: Story = {
  name: "Two",
  parameters: { server: { id: "layout-columns" } },
  args: {
    columns: '["<p>左の列の段落</p>","<ul><li>右の列のリスト</li></ul>"]',
  },
};

export const Three: Story = {
  name: "Three",
  parameters: { server: { id: "layout-columns" } },
  args: { columns: '["<p>1 列目</p>","<p>2 列目</p>","<p>3 列目</p>"]' },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "layout-columns" } },
  args: {
    columns: '["<p>左の列の段落</p>","<p>右の列の段落</p>"]',
    frameWidth: "390px",
  },
};
