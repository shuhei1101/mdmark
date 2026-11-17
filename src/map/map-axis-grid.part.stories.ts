import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapAxisGrid" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

/** 描画のインターフェースの部品 */
const server = { server: { id: "map-axis-grid" } };

export const Gantt: Story = {
  name: "Gantt",
  parameters: server,
  args: { kind: "gantt" },
};

export const Timeline: Story = {
  name: "Timeline",
  parameters: server,
  args: { kind: "timeline" },
};

export const GitGraph: Story = {
  name: "GitGraph",
  parameters: server,
  args: { kind: "gitGraph" },
};

export const Journey: Story = {
  name: "Journey",
  parameters: server,
  args: { kind: "journey" },
};

export const Block: Story = {
  name: "Block",
  parameters: server,
  args: { kind: "block" },
};

export const GanttCollapsed: Story = {
  name: "GanttCollapsed",
  parameters: server,
  args: { kind: "gantt", collapsed: '["開発"]' },
};

export const TimelineCollapsed: Story = {
  name: "TimelineCollapsed",
  parameters: server,
  args: { kind: "timeline", collapsed: '["記法を作る"]' },
};

export const JourneyCollapsed: Story = {
  name: "JourneyCollapsed",
  parameters: server,
  args: { kind: "journey", collapsed: '["点検する"]' },
};

export const BlockCollapsed: Story = {
  name: "BlockCollapsed",
  parameters: server,
  args: { kind: "block", collapsed: '["core"]' },
};

export const GanttEntered: Story = {
  name: "GanttEntered",
  parameters: server,
  args: { kind: "gantt", entered: "s3" },
};

export const BlockEntered: Story = {
  name: "BlockEntered",
  parameters: server,
  args: { kind: "block", entered: "core" },
};

export const GanttSelected: Story = {
  name: "GanttSelected",
  parameters: server,
  args: { kind: "gantt", selected: '{"kind": "item", "key": "des"}' },
};

export const GitBranchSelected: Story = {
  name: "GitBranchSelected",
  parameters: server,
  args: { kind: "gitGraph", selected: '{"kind": "branch", "key": "feat"}' },
};

export const JourneyActorSelected: Story = {
  name: "JourneyActorSelected",
  parameters: server,
  args: { kind: "journey", selected: '{"kind": "actor", "key": "AI"}' },
};

export const Played: Story = {
  name: "Played",
  parameters: server,
  args: { kind: "gitGraph", focus: '{"nodes": ["c6"]}' },
};

export const Colored: Story = {
  name: "Colored",
  parameters: server,
  args: { kind: "gantt", layout: "colored" },
};

export const HintsOff: Story = {
  name: "HintsOff",
  parameters: server,
  args: { kind: "gantt", hints: false },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: server,
  args: { kind: "gantt", frameWidth: "390px" },
};
