import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CommentForm" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Idle: Story = {
  name: "Idle",
  parameters: { server: { id: "comment-form" } },
  args: { quote: "テーマの変数", id: "story-comment" },
};

export const Typed: Story = {
  name: "Typed",
  parameters: { server: { id: "comment-form" } },
  args: {
    quote: "テーマの変数",
    body: "変数の名前を一覧にしてほしい",
    id: "story-comment",
  },
};

export const Saving: Story = {
  name: "Saving",
  parameters: { server: { id: "comment-form" } },
  args: {
    quote: "テーマの変数",
    body: "変数の名前を一覧にしてほしい",
    state: "saving",
    id: "story-comment",
  },
};

export const Empty: Story = {
  name: "Empty",
  parameters: { server: { id: "comment-form" } },
  args: { quote: "テーマの変数", state: "empty", id: "story-comment" },
};

export const Failed: Story = {
  name: "Failed",
  parameters: { server: { id: "comment-form" } },
  args: {
    quote: "テーマの変数",
    body: "変数の名前を一覧にしてほしい",
    state: "failed",
    id: "story-comment",
  },
};

export const LongQuote: Story = {
  name: "LongQuote",
  parameters: { server: { id: "comment-form" } },
  args: {
    quote:
      "使う側のページが自分の JavaScript からビューを描き、拡張のモジュールからも同じ関数を呼べるようにして、文書の印と同じ見た目で出す",
    id: "story-comment",
  },
};
