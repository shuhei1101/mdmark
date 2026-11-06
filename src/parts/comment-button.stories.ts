import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CommentButton" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "comment-button" } },
};
