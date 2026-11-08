import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Toc" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Nested: Story = {
  name: "Nested",
  parameters: { server: { id: "toc" } },
  args: {
    headings:
      '[{"level":2,"id":"導入","text":"導入"},{"level":3,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"}]',
  },
};

export const Flat: Story = {
  name: "Flat",
  parameters: { server: { id: "toc" } },
  args: {
    headings:
      '[{"level":2,"id":"導入","text":"導入"},{"level":2,"id":"使用方法","text":"使用方法"}]',
  },
};

export const LongHeading: Story = {
  name: "LongHeading",
  parameters: { server: { id: "toc" } },
  args: {
    headings:
      '[{"level":2,"id":"long","text":"とても長い見出しで目次の幅を超えて折り返すときの見え方を確認するための見出し"}]',
  },
};
