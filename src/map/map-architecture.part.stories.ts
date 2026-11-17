import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapArchitecture" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-architecture" } },
  args: {},
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-architecture" } },
  args: { entered: "app" },
};

export const GroupCollapsed: Story = {
  name: "GroupCollapsed",
  parameters: { server: { id: "map-architecture" } },
  args: { collapsed: '["app"]' },
};

export const ServiceSelected: Story = {
  name: "ServiceSelected",
  parameters: { server: { id: "map-architecture" } },
  args: { selected: '["api"]' },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-architecture" } },
  args: { frameWidth: "390px" },
};
