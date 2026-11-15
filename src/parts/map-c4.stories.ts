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
