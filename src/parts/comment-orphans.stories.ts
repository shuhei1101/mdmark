import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CommentOrphans" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "comment-orphans" } },
  args: {
    comments:
      '[{"quote":"テーマの変数","body":"ここは <b>太字</b> にしたい"},{"quote":"角丸は 6px","body":"角丸は 6px のままでよいと思います。"}]',
    id: "story-orphans",
  },
};

export const Empty: Story = {
  name: "Empty",
  parameters: { server: { id: "comment-orphans" } },
  args: { comments: "[]", id: "story-orphans" },
};
