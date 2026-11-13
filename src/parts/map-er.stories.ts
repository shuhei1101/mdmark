import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapEr" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

/** 「顧客」と「明細」を選んだときの、行が増える関連 */
const FANOUTS =
  '[{"wire": "r1", "from": "顧客", "to": "注文"}, {"wire": "r2", "from": "注文", "to": "明細"}, {"wire": "r3", "from": "商品", "to": "明細"}]';

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-er" } },
  args: {},
};

export const ColumnsCollapsed: Story = {
  name: "ColumnsCollapsed",
  parameters: { server: { id: "map-er" } },
  args: { collapsed: '["注文"]' },
};

export const GroupCollapsed: Story = {
  name: "GroupCollapsed",
  parameters: { server: { id: "map-er" } },
  args: { collapsed: '["記録"]' },
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-er" } },
  args: { entered: "記録" },
};

export const TableSelected: Story = {
  name: "TableSelected",
  parameters: { server: { id: "map-er" } },
  args: { selected: '["明細"]' },
};

export const PathSelected: Story = {
  name: "PathSelected",
  parameters: { server: { id: "map-er" } },
  args: { selected: '["顧客", "明細"]', fanouts: FANOUTS },
};

export const FanoutTip: Story = {
  name: "FanoutTip",
  parameters: { server: { id: "map-er" } },
  args: { selected: '["顧客", "明細"]', fanouts: FANOUTS },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-er" } },
  args: { frameWidth: "390px" },
};
