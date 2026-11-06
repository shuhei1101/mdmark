import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CommentMarginMarker" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "comment-marker" } },
  args: { quote: "テーマの変数" },
};

export const Merged: Story = {
  name: "Merged",
  parameters: { server: { id: "comment-marker" } },
  args: { quote: "担当者", count: "2" },
};

export const Current: Story = {
  name: "Current",
  parameters: { server: { id: "comment-marker" } },
  args: { quote: "テーマの変数", current: "true" },
};

export const ClosedSection: Story = {
  name: "ClosedSection",
  parameters: { server: { id: "comment-marker" } },
  args: { quote: "閉じた箇所", closed: "section" },
};

export const ClosedTab: Story = {
  name: "ClosedTab",
  parameters: { server: { id: "comment-marker" } },
  args: { quote: "タブの箇所", closed: "tab" },
};

export const ClosedRow: Story = {
  name: "ClosedRow",
  parameters: { server: { id: "comment-marker" } },
  args: { quote: "行の箇所", closed: "row" },
};
