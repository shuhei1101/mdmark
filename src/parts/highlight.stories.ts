import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Highlight" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "highlight" } },
  args: { html: "決め手" },
};

export const Colored: Story = {
  name: "Colored",
  parameters: { server: { id: "highlight" } },
  args: { html: "例外", color: "green" },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "highlight" } },
  args: {
    html: "とても長い強調の文字で行の幅を超えて次の行へ折り返すときの見え方を確かめる",
    frameWidth: "320px",
  },
};

export const Dark: Story = {
  name: "Dark",
  parameters: { server: { id: "highlight" } },
  args: { html: "決め手", color: "yellow", scheme: "dark" },
};
