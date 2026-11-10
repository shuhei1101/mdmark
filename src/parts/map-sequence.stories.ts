import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapSequence" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-sequence" } },
  args: {},
};

export const BlockCollapsed: Story = {
  name: "BlockCollapsed",
  parameters: { server: { id: "map-sequence" } },
  args: { collapsed: '["2"]' },
};

export const BlockEntered: Story = {
  name: "BlockEntered",
  parameters: { server: { id: "map-sequence" } },
  args: { entered: "1" },
};

export const ParticipantSelected: Story = {
  name: "ParticipantSelected",
  parameters: { server: { id: "map-sequence" } },
  args: { selected: '["mount"]' },
};

export const Playing: Story = {
  name: "Playing",
  parameters: { server: { id: "map-sequence" } },
  args: { focus: '{"message": 2}' },
};

export const Arrows: Story = {
  name: "Arrows",
  parameters: { server: { id: "map-sequence" } },
  args: { source: "arrows" },
};

export const TallParticipants: Story = {
  name: "TallParticipants",
  parameters: { server: { id: "map-sequence" } },
  args: { source: "tall" },
};

export const Reordering: Story = {
  name: "Reordering",
  parameters: { server: { id: "map-sequence" } },
  args: { order: '["user", "layout", "mount", "marker", "mermaid"]' },
};
