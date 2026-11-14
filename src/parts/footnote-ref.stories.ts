import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/FootnoteRef" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "footnote-ref" } },
  args: { number: 1, bodies: '["CSS 変数と層の外の CSS で上書きする。"]' },
};

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    number: 1,
    bodies: '["CSS 変数と層の外の CSS で上書きする。"]',
    open: true,
  },
};

export const Below: Story = {
  name: "Below",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    number: 1,
    bodies: '["CSS 変数と層の外の CSS で上書きする。"]',
    below: true,
    open: true,
  },
};

export const WithLink: Story = {
  name: "WithLink",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    number: 1,
    bodies:
      '["明暗は OS の配色に合わせ、<a href=\\"../使い方/カスタマイズ/テーマを上書きする.md\\">テーマを選ぶ</a> の手順で固定できる。"]',
    open: true,
  },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    number: 1,
    bodies:
      '["既定のテーマは dev-swiss で、<code>colorTheme</code> で theme-paper・theme-slate・theme-contrast を選べる。", "印刷では、選んだテーマの明るい配色で出す。"]',
    open: true,
  },
};

export const TwoDigits: Story = {
  name: "TwoDigits",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    number: 12,
    refIndex: 1,
    bodies: '["同じ脚注の 2 回目の参照。"]',
    open: true,
  },
};

export const Annotation: Story = {
  name: "Annotation",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    kind: "annotation",
    number: 1,
    bodies: '["条件を満たさないときは次の工程へ進む。"]',
    open: true,
  },
};

export const AnnotationAfterRef: Story = {
  name: "AnnotationAfterRef",
  parameters: { server: { id: "footnote-ref" } },
  args: {
    kind: "annotation",
    number: 1,
    afterRef: true,
    bodies: '["古い記録は 30 日で消える。"]',
  },
};
