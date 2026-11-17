import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/RowDetail" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
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
