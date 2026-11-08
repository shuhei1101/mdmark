import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CommentMark" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "comment-mark" } },
  args: { text: "テーマの変数" },
};

export const Expanded: Story = {
  name: "Expanded",
  parameters: { server: { id: "comment-mark" } },
  args: { text: "テーマの変数", expanded: "true" },
};

export const Focused: Story = {
  name: "Focused",
  parameters: { server: { id: "comment-mark" } },
  args: { text: "テーマの変数", focused: "true" },
};
