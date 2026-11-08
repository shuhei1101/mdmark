import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffLines" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Normal: Story = {
  name: "Normal",
  parameters: { server: { id: "diff-lines" } },
  args: { sample: "normal" },
};

export const CharByChar: Story = {
  name: "CharByChar",
  parameters: { server: { id: "diff-lines" } },
  args: { sample: "char" },
};

export const LongLine: Story = {
  name: "LongLine",
  parameters: { server: { id: "diff-lines" } },
  args: { sample: "long" },
};

export const WithHtml: Story = {
  name: "WithHtml",
  parameters: { server: { id: "diff-lines" } },
  args: { sample: "html" },
};
