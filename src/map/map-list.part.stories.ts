import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapList" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Flow: Story = {
  name: "Flow",
  parameters: { server: { id: "map-list" } },
  args: {},
};

export const WithChanges: Story = {
  name: "WithChanges",
  parameters: { server: { id: "map-list" } },
  args: { list: "changes" },
};

export const Sequence: Story = {
  name: "Sequence",
  parameters: { server: { id: "map-list" } },
  args: { list: "sequence" },
};

export const GroupCollapsed: Story = {
  name: "GroupCollapsed",
  parameters: { server: { id: "map-list" } },
  args: { collapsed: '["read"]', focused: "read" },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-list" } },
  args: { list: "changes", narrow: true },
};
