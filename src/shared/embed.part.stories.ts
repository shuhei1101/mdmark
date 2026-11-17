import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Embed" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Loading: Story = {
  name: "Loading",
  parameters: { server: { id: "embed" } },
  args: { name: "chart", options: '{"items":["a","b"]}' },
};
