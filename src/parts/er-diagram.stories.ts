import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/ErDiagram" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "er-diagram" } },
};

export const Colors: Story = {
  name: "Colors",
  parameters: { server: { id: "er-diagram" } },
  args: { sample: "colors" },
};

export const Folded: Story = {
  name: "Folded",
  parameters: { server: { id: "er-diagram" } },
  args: { sample: "folded" },
};

export const Invalid: Story = {
  name: "Invalid",
  parameters: { server: { id: "er-diagram" } },
  args: { invalid: true },
};
