import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapMindmap" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-mindmap" } },
  args: {},
};

export const Collapsed: Story = {
  name: "Collapsed",
  parameters: { server: { id: "map-mindmap" } },
  args: { collapsed: '["体制"]' },
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-mindmap" } },
  args: { entered: "体制" },
};

export const Selected: Story = {
  name: "Selected",
  parameters: { server: { id: "map-mindmap" } },
  args: { selected: "体制" },
};

export const PlainSelected: Story = {
  name: "PlainSelected",
  parameters: { server: { id: "map-mindmap" } },
  args: { selected: "利用者を増やす" },
};

export const Colored: Story = {
  name: "Colored",
  parameters: { server: { id: "map-mindmap" } },
  args: { layout: "colored" },
};

export const Walked: Story = {
  name: "Walked",
  parameters: { server: { id: "map-mindmap" } },
  args: { entered: "体制", focus: '{"nodes": ["人手が足りない"]}' },
};

export const HintsOff: Story = {
  name: "HintsOff",
  parameters: { server: { id: "map-mindmap" } },
  args: { hints: false },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-mindmap" } },
  args: { frameWidth: "390px" },
};
