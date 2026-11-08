import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Hint" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Block: Story = {
  name: "Block",
  parameters: { server: { id: "hint" } },
  args: { placement: "block" },
};

export const BlockOpen: Story = {
  name: "BlockOpen",
  parameters: { server: { id: "hint" } },
  args: { placement: "block", open: true },
};

export const Inline: Story = {
  name: "Inline",
  parameters: { server: { id: "hint" } },
  args: { placement: "inline" },
};

export const InlineOpen: Story = {
  name: "InlineOpen",
  parameters: { server: { id: "hint" } },
  args: { placement: "inline", open: true },
};

export const Colored: Story = {
  name: "Colored",
  parameters: { server: { id: "hint" } },
  args: { placement: "block", colored: true },
};
