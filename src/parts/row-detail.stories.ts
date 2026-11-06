import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/RowDetail" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "row-detail" } },
  args: { row: 1, columns: 3, label: "table" },
};

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "row-detail" } },
  args: { row: 1, columns: 3, label: "table", open: true },
};

export const OpenWithFoldedColumn: Story = {
  name: "OpenWithFoldedColumn",
  parameters: { server: { id: "row-detail" } },
  args: {
    row: "1",
    columns: "3",
    label: "table",
    open: "true",
    foldedColumn:
      '{"name":"説明","html":"並べ替え・ピン止め・絞り込みを付けた表を描く"}',
  },
};
