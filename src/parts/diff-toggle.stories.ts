import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffToggle" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "diff-toggle" } },
  args: { controls: "mdmark-diff-panel-1", expanded: false },
};

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "diff-toggle" } },
  args: { controls: "mdmark-diff-panel-1", expanded: true },
};
