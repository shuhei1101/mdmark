import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Notice" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Figure: Story = {
  name: "Figure",
  parameters: { server: { id: "notice" } },
  args: { name: "chart", figure: true },
};

export const Block: Story = {
  name: "Block",
  parameters: { server: { id: "notice" } },
  args: { name: "tabs", figure: false },
};

export const LongName: Story = {
  name: "LongName",
  parameters: { server: { id: "notice" } },
  args: {
    name: "sequence-diagram-with-very-long-component-name",
    figure: true,
  },
};

export const Extension: Story = {
  name: "Extension",
  parameters: { server: { id: "notice" } },
  args: { name: "greet", figure: true, source: "extension" },
};

export const DiffRevisions: Story = {
  name: "DiffRevisions",
  parameters: { server: { id: "notice" } },
  args: { name: "guide", source: "diff-revisions" },
};

export const DiffContent: Story = {
  name: "DiffContent",
  parameters: { server: { id: "notice" } },
  args: { name: "2026/10/18 09:12 初版（佐藤）", source: "diff-content" },
};

export const DiffBlocks: Story = {
  name: "DiffBlocks",
  parameters: { server: { id: "notice" } },
  args: { name: "guide", source: "diff-blocks" },
};

export const Icons: Story = {
  name: "Icons",
  parameters: { server: { id: "notice" } },
  args: { name: "lucide", source: "icons" },
};
