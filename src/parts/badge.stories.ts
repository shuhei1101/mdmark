import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Badge" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Inline: Story = {
  name: "Inline",
  parameters: { server: { id: "badge" } },
  args: { label: "v0.2.0" },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "badge" } },
  args: {
    label: "とても長い状態の名前で札の幅を超えるときの見え方を確認する札",
  },
};

export const Colored: Story = {
  name: "Colored",
  parameters: { server: { id: "badge" } },
  args: { label: "要確認", color: "red" },
};

export const ColoredDark: Story = {
  name: "ColoredDark",
  parameters: { server: { id: "badge" } },
  args: { label: "完了", color: "green", scheme: "dark" },
};

export const ColoredLong: Story = {
  name: "ColoredLong",
  parameters: { server: { id: "badge" } },
  args: {
    label: "とても長い状態の名前で札の幅を超えるときの見え方を確認する札",
    color: "yellow",
  },
};
