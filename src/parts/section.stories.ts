import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Section" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "section" } },
  args: { level: 2, id: "概要", title: "概要" },
};

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "section" } },
  args: { level: 2, id: "補足", title: "補足", open: false },
};

export const Level4: Story = {
  name: "Level4",
  parameters: { server: { id: "section" } },
  args: { level: 4, id: "細目", title: "細目" },
};

export const LongTitle: Story = {
  name: "LongTitle",
  parameters: { server: { id: "section" } },
  args: {
    level: 2,
    id: "long",
    title:
      "とても長い見出しで文書の幅を超えて折り返すときの開閉のマーカーとアンカーの位置を確認する",
  },
};

export const Unmounted: Story = {
  name: "Unmounted",
  parameters: { server: { id: "section" } },
  args: { level: 2, id: "補足", title: "補足", toggle: false, open: false },
};

export const Level1: Story = {
  name: "Level1",
  parameters: { server: { id: "section" } },
  args: { level: 1, id: "はじめに", title: "はじめに" },
};
