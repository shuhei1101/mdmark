import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapClass" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-class" } },
  args: {},
};

export const MembersCollapsed: Story = {
  name: "MembersCollapsed",
  parameters: { server: { id: "map-class" } },
  args: { collapsed: '["基本図形"]' },
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-class" } },
  args: { entered: "形状" },
};

export const NamespaceCollapsed: Story = {
  name: "NamespaceCollapsed",
  parameters: { server: { id: "map-class" } },
  args: { collapsed: '["形状"]' },
};

export const PathSelected: Story = {
  name: "PathSelected",
  parameters: { server: { id: "map-class" } },
  args: { selected: '["図面", "円"]' },
};

export const HintsOff: Story = {
  name: "HintsOff",
  parameters: { server: { id: "map-class" } },
  args: { hints: false },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-class" } },
  args: { frameWidth: "390px" },
};

export const LinkedClass: Story = {
  name: "LinkedClass",
  parameters: { server: { id: "map-class" } },
  args: { links: '{"図面": "https://example.com/drawing"}' },
};

export const LongMembers: Story = {
  name: "LongMembers",
  parameters: { server: { id: "map-class" } },
  args: { sample: "long" },
};

export const MeasuredName: Story = {
  name: "MeasuredName",
  parameters: { server: { id: "map-class" } },
  args: { sample: "measured" },
};
