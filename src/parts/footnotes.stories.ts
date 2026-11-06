import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Footnotes" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "footnotes" } },
  args: {
    items:
      '[{"number":1,"html":"<p>CSS 変数と層の外の CSS で上書きする。</p>","refCount":1},{"number":2,"html":"<p>file:// で開き、外への要求は 0 件。</p>","refCount":1}]',
  },
};

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "footnotes" } },
  args: {
    items:
      '[{"number":1,"html":"<p>CSS 変数と層の外の CSS で上書きする。</p>","refCount":1},{"number":2,"html":"<p>file:// で開き、外への要求は 0 件。</p>","refCount":1}]',
    open: true,
  },
};

export const ReferencedTwice: Story = {
  name: "ReferencedTwice",
  parameters: { server: { id: "footnotes" } },
  args: {
    items:
      '[{"number":1,"html":"<p>閉じの印を書き忘れると、範囲の上に警告が出る。</p>","refCount":2}]',
    open: true,
  },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "footnotes" } },
  args: {
    items:
      '[{"number":11,"html":"<p>既定のテーマは dev-swiss で、<code>colorTheme</code> で選べる。</p><p>明暗は OS の配色に合わせ、<a href=\\"../使い方/カスタマイズ/テーマを上書きする.md\\">テーマを選ぶ</a> の手順で固定できる。</p>","refCount":1},{"number":12,"html":"<p>短い補足。</p>","refCount":1}]',
    open: true,
  },
};
