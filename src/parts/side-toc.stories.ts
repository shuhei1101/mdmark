import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/SideToc" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const HoverRail: Story = {
  name: "HoverRail",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"手引き","text":"手引き"},{"level":2,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"},{"level":3,"id":"注意","text":"注意"}]',
  },
};

export const HoverShown: Story = {
  name: "HoverShown",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"手引き","text":"手引き"},{"level":2,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"},{"level":3,"id":"注意","text":"注意"}]',
    open: true,
    current: "使用方法",
  },
};

export const HoverPinned: Story = {
  name: "HoverPinned",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"手引き","text":"手引き"},{"level":2,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"},{"level":3,"id":"注意","text":"注意"}]',
    pinned: true,
    current: "使用方法",
  },
};

export const FixedClosed: Story = {
  name: "FixedClosed",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"手引き","text":"手引き"},{"level":2,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"},{"level":3,"id":"注意","text":"注意"}]',
    mode: "fixed",
  },
};

export const FixedOpen: Story = {
  name: "FixedOpen",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"手引き","text":"手引き"},{"level":2,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"},{"level":3,"id":"注意","text":"注意"}]',
    mode: "fixed",
    open: true,
    current: "前提",
  },
};

export const WithoutSections: Story = {
  name: "WithoutSections",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"手引き","text":"手引き"},{"level":2,"id":"前提","text":"前提"},{"level":2,"id":"使用方法","text":"使用方法"},{"level":3,"id":"注意","text":"注意"}]',
    mode: "fixed",
    open: true,
    sections: false,
  },
};

export const LongHeading: Story = {
  name: "LongHeading",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":2,"id":"long","text":"読み込みに失敗したときに通知ブロックが出る箇所と、ほかの本文の扱い"},{"level":3,"id":"long-2","text":"社内のネットワークから jsDelivr へ出られないときに書き出した 1 枚の HTML を使用する手順"}]',
    mode: "fixed",
    open: true,
  },
};

export const HoverChanged: Story = {
  name: "HoverChanged",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"doc","text":"文書","changed":true},{"level":2,"id":"premise","text":"前提"},{"level":2,"id":"steps","text":"手順","changed":true},{"level":3,"id":"steps-1","text":"準備"},{"level":2,"id":"added","text":"追加した節","changed":true}]',
    open: true,
    current: "steps",
  },
};

export const FixedChanged: Story = {
  name: "FixedChanged",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":1,"id":"doc","text":"文書","changed":true},{"level":2,"id":"premise","text":"前提"},{"level":2,"id":"steps","text":"手順","changed":true},{"level":3,"id":"steps-1","text":"準備"},{"level":2,"id":"added","text":"追加した節","changed":true}]',
    mode: "fixed",
    open: true,
  },
};

export const LongHeadingChanged: Story = {
  name: "LongHeadingChanged",
  parameters: { server: { id: "side-toc" } },
  args: {
    headings:
      '[{"level":2,"id":"long","text":"読み込みに失敗したときに通知ブロックが出る箇所と、ほかの本文の扱い","changed":true}]',
    mode: "fixed",
    open: true,
  },
};
