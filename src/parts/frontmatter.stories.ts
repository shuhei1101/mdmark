import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Frontmatter" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

/** 2 行のフロントマターの yaml のコードブロック */
const SHORT_BODY =
  '<pre><code class="language-yaml">title: 問い合わせの受付\ntags: [サポート, 手順]\n</code></pre>';

/** 入れ子のオブジェクトとリストを持つフロントマターの yaml のコードブロック */
const NESTED_BODY =
  '<pre><code class="language-yaml">title: 問い合わせの受付\nowner:\n  name: サポート担当\n  team: 窓口\nsteps:\n  - 受け付ける\n  - 振り分ける\n</code></pre>';

/** 区切りの無い長い値を持つフロントマターの yaml のコードブロック */
const LONG_BODY =
  '<pre><code class="language-yaml">source: https://example.com/support/handbook/inquiries/reception-and-routing-of-incoming-requests\n</code></pre>';

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "frontmatter" } },
  args: { body: SHORT_BODY },
};

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "frontmatter" } },
  args: { body: SHORT_BODY, open: true },
};

export const Nested: Story = {
  name: "Nested",
  parameters: { server: { id: "frontmatter" } },
  args: { body: NESTED_BODY, open: true },
};

export const LongValue: Story = {
  name: "LongValue",
  parameters: { server: { id: "frontmatter" } },
  args: { body: LONG_BODY, open: true },
};
