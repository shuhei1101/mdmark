import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Callout" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Note: Story = {
  name: "Note",
  parameters: { server: { id: "callout" } },
  args: { kind: "note" },
};

export const Tip: Story = {
  name: "Tip",
  parameters: { server: { id: "callout" } },
  args: { kind: "tip" },
};

export const Important: Story = {
  name: "Important",
  parameters: { server: { id: "callout" } },
  args: { kind: "important" },
};

export const Warning: Story = {
  name: "Warning",
  parameters: { server: { id: "callout" } },
  args: { kind: "warning" },
};

export const Caution: Story = {
  name: "Caution",
  parameters: { server: { id: "callout" } },
  args: { kind: "caution" },
};

export const Collapsed: Story = {
  name: "Collapsed",
  parameters: { server: { id: "callout" } },
  args: { kind: "warning", collapsed: true },
};

export const CollapsedOpened: Story = {
  name: "CollapsedOpened",
  parameters: { server: { id: "callout" } },
  args: { kind: "warning", collapsed: true, open: true },
};

export const Long: Story = {
  name: "Long",
  parameters: { server: { id: "callout" } },
  args: {
    kind: "note",
    body: '<p>1 つ目の段落です。注意書きの中でも、本文と同じ間隔で段落が続きます。</p><p>2 つ目の段落です。長い文は枠の幅で折り返し、枠の中に収まります。長い文は枠の幅で折り返し、枠の中に収まります。</p><pre tabindex="0" aria-label="コード: ts"><code class="language-ts">const note = &quot;コードブロックも枠の中に収まる&quot;;</code></pre>',
  },
};

export const Titled: Story = {
  name: "Titled",
  parameters: { server: { id: "callout" } },
  args: { kind: "tip", title: "設定を先に確認する" },
};

export const TitledCollapsed: Story = {
  name: "TitledCollapsed",
  parameters: { server: { id: "callout" } },
  args: { kind: "warning", title: "古いバージョンの設定", collapsed: true },
};

export const OpenPlus: Story = {
  name: "OpenPlus",
  parameters: { server: { id: "callout" } },
  args: { kind: "warning", collapsed: true, open: true },
};

export const Nested: Story = {
  name: "Nested",
  parameters: { server: { id: "callout" } },
  args: { kind: "warning", title: "版を上げる前に", nested: true },
};
