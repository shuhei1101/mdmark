import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Backlinks" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Two: Story = {
  name: "Two",
  parameters: { server: { id: "backlinks" } },
  args: {
    id: "backlinks-two",
    docs: '[{"title":"API","href":"../api.md"},{"title":"使い方","href":"../使い方/guide.md"}]',
  },
};

export const One: Story = {
  name: "One",
  parameters: { server: { id: "backlinks" } },
  args: { id: "backlinks-one", docs: '[{"title":"API","href":"../api.md"}]' },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "backlinks" } },
  args: {
    id: "backlinks-long",
    docs: '[{"title":"API","href":"../api.md"},{"title":"使い方","href":"../使い方/guide.md"},{"title":"CSS 変数と層の外の CSS で、描いた文書の見た目を変える手順と、印刷のときの見え方の違い","href":"../使い方/カスタマイズ/テーマを上書きする.md"},{"title":"設定の一覧","href":"../リファレンス/設定.md"},{"title":"非機能要件","href":"../非機能要件.md"}]',
  },
};
