import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapC4" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-c4" } },
  args: {},
};

export const BoundaryCollapsed: Story = {
  name: "BoundaryCollapsed",
  parameters: { server: { id: "map-c4" } },
  args: { collapsed: '["shop"]' },
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-c4" } },
  args: { entered: "shop" },
};

export const ElementSelected: Story = {
  name: "ElementSelected",
  parameters: { server: { id: "map-c4" } },
  args: { selected: '["store", "stock"]' },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-c4" } },
  args: { frameWidth: "390px" },
};

export const Container: Story = {
  name: "Container",
  parameters: { server: { id: "map-c4" } },
  args: { kind: "container" },
};

export const Component: Story = {
  name: "Component",
  parameters: { server: { id: "map-c4" } },
  args: { kind: "component" },
};

export const Dynamic: Story = {
  name: "Dynamic",
  parameters: { server: { id: "map-c4" } },
  args: { kind: "dynamic" },
};

export const Deployment: Story = {
  name: "Deployment",
  parameters: { server: { id: "map-c4" } },
  args: { kind: "deployment" },
};

export const DeploymentCollapsed: Story = {
  name: "DeploymentCollapsed",
  parameters: { server: { id: "map-c4" } },
  args: { kind: "deployment", collapsed: '["region"]' },
};

export const DynamicPlaying: Story = {
  name: "DynamicPlaying",
  parameters: { server: { id: "map-c4" } },
  args: {
    kind: "dynamic-play",
    collapsed: '["store"]',
    focus: '{"nodes": ["web", "api"], "wires": ["r2"]}',
    packets: '[{"wire": "r2", "direction": "forward"}]',
  },
};

export const DynamicPlayingBoundary: Story = {
  name: "DynamicPlayingBoundary",
  parameters: { server: { id: "map-c4" } },
  args: {
    kind: "dynamic-play",
    collapsed: '["store"]',
    focus: '{"nodes": ["api", "store"], "wires": ["r4"]}',
    packets: '[{"wire": "r4", "direction": "forward"}]',
  },
};

export const DynamicPlayingBiRel: Story = {
  name: "DynamicPlayingBiRel",
  parameters: { server: { id: "map-c4" } },
  args: {
    kind: "dynamic-play",
    collapsed: '["store"]',
    focus: '{"nodes": ["web", "customer"], "wires": ["r5"]}',
    packets: '[{"wire": "r5", "direction": "both"}]',
  },
};
