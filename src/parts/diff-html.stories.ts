import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffHtml" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Source: Story = {
  name: "Source",
  parameters: { server: { id: "diff-html" } },
  args: { sample: "table" },
};

export const PreviewSide: Story = {
  name: "PreviewSide",
  parameters: { server: { id: "diff-html" } },
  args: { sample: "table", view: "rendered", sides: "side" },
};

export const PreviewStack: Story = {
  name: "PreviewStack",
  parameters: { server: { id: "diff-html" } },
  args: { sample: "table", view: "rendered", sides: "stack" },
};

export const OneSide: Story = {
  name: "OneSide",
  parameters: { server: { id: "diff-html" } },
  args: { sample: "added", view: "rendered", sides: "side" },
};

export const Unchanged: Story = {
  name: "Unchanged",
  parameters: { server: { id: "diff-html" } },
  args: { sample: "unchanged" },
};

export const ScriptDropped: Story = {
  name: "ScriptDropped",
  parameters: { server: { id: "diff-html" } },
  args: { sample: "script", view: "rendered", sides: "side" },
};
