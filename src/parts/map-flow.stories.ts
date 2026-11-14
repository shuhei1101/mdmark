import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapFlow" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-flow" } },
  args: {},
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-flow" } },
  args: { entered: "lib" },
};

export const Collapsed: Story = {
  name: "Collapsed",
  parameters: { server: { id: "map-flow" } },
  args: { collapsed: '["read"]' },
};

export const SelectedOne: Story = {
  name: "SelectedOne",
  parameters: { server: { id: "map-flow" } },
  args: { selected: '["mount"]' },
};

export const SelectedTwo: Story = {
  name: "SelectedTwo",
  parameters: { server: { id: "map-flow" } },
  args: { selected: '["mount", "marker"]' },
};

export const Focused: Story = {
  name: "Focused",
  parameters: { server: { id: "map-flow" } },
  args: { focus: '{"nodes": ["layout", "route"], "wires": ["layout->route"]}' },
};

export const NodeFitWidth: Story = {
  name: "NodeFitWidth",
  parameters: { server: { id: "map-flow" } },
  args: { node_fit: "width", source: "long" },
};

export const WireReattached: Story = {
  name: "WireReattached",
  parameters: { server: { id: "map-flow" } },
  args: { ends: '{"to": "top"}' },
};

export const LinkedNode: Story = {
  name: "LinkedNode",
  parameters: { server: { id: "map-flow" } },
  args: { links: '{"mount": "https://example.com/spec"}' },
};

export const GroupNote: Story = {
  name: "GroupNote",
  parameters: { server: { id: "map-flow" } },
  args: { notes: '{"lib": "記法を読み取る部分"}' },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-flow" } },
  args: {},
};
