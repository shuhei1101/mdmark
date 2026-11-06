import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/InlineIcon" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Bundled: Story = {
  name: "Bundled",
  parameters: { server: { id: "inline-icon" } },
  args: { name: "check", node: '[["path",{"d":"M20 6 9 17l-5-5"}]]' },
};

export const InHeading: Story = {
  name: "InHeading",
  parameters: { server: { id: "inline-icon" } },
  args: {
    name: "flag",
    node: '[["path",{"d":"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"}]]',
    heading: true,
  },
};

export const Pending: Story = {
  name: "Pending",
  parameters: { server: { id: "inline-icon" } },
  args: { name: "sailboat" },
};
