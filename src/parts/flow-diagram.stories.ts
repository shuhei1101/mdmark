import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/FlowDiagram" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "flow-diagram" } },
};

export const LongNames: Story = {
  name: "LongNames",
  parameters: { server: { id: "flow-diagram" } },
  args: { longNames: true },
};

export const Judgement: Story = {
  name: "Judgement",
  parameters: { server: { id: "flow-diagram" } },
  args: { judgement: "default" },
};

export const JudgementLong: Story = {
  name: "JudgementLong",
  parameters: { server: { id: "flow-diagram" } },
  args: { judgement: "long" },
};

export const UnknownKind: Story = {
  name: "UnknownKind",
  parameters: { server: { id: "flow-diagram" } },
  args: { unknownKind: true },
};

export const Invalid: Story = {
  name: "Invalid",
  parameters: { server: { id: "flow-diagram" } },
  args: { invalid: true },
};

export const JudgementAuto: Story = {
  name: "JudgementAuto",
  parameters: { server: { id: "flow-diagram" } },
  args: { judgement: "auto" },
};

export const LinkedNodes: Story = {
  name: "LinkedNodes",
  parameters: { server: { id: "flow-diagram" } },
  args: { links: "allowed" },
};

export const LinkedNodeHoverFocus: Story = {
  name: "LinkedNodeHoverFocus",
  parameters: { server: { id: "flow-diagram" } },
  args: { links: "hover-focus" },
};

export const LinkNotAllowed: Story = {
  name: "LinkNotAllowed",
  parameters: { server: { id: "flow-diagram" } },
  args: { links: "blocked" },
};

export const GroupHints: Story = {
  name: "GroupHints",
  parameters: { server: { id: "flow-diagram" } },
  args: { groups: true },
};

export const TitlesStuck: Story = {
  name: "TitlesStuck",
  parameters: { server: { id: "flow-diagram" } },
  args: { groups: true, stuck: true, zoom: 1.5 },
};
