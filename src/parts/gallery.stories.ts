import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Gallery" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const ThreeColumns: Story = {
  name: "ThreeColumns",
  parameters: { server: { id: "gallery" } },
  args: { cols: 3 },
};

export const TwoColumns: Story = {
  name: "TwoColumns",
  parameters: { server: { id: "gallery" } },
  args: { cols: 2 },
};

export const NarrowTwo: Story = {
  name: "NarrowTwo",
  parameters: { server: { id: "gallery" } },
  args: { cols: 3, frameWidth: "30rem" },
};

export const NarrowOne: Story = {
  name: "NarrowOne",
  parameters: { server: { id: "gallery" } },
  args: { cols: 3, frameWidth: "18rem" },
};

export const Numbered: Story = {
  name: "Numbered",
  parameters: { server: { id: "gallery" } },
  args: { cols: 2, numbered: true },
};
