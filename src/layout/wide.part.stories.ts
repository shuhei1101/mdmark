import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Wide" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Wide: Story = {
  name: "Wide",
  parameters: { server: { id: "wide" } },
  args: {
    html: "<table><thead><tr><th>項目</th><th>1 月</th><th>2 月</th><th>3 月</th><th>4 月</th><th>5 月</th><th>6 月</th><th>備考</th></tr></thead><tbody><tr><td>売上</td><td>1,200,000</td><td>1,350,000</td><td>1,410,000</td><td>1,280,000</td><td>1,520,000</td><td>1,610,000</td><td>前年比で増加した</td></tr></tbody></table>",
    toggle: true,
  },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "wide" } },
  args: {
    html: "<table><thead><tr><th>項目</th><th>1 月</th><th>2 月</th><th>3 月</th><th>4 月</th><th>5 月</th><th>6 月</th><th>備考</th></tr></thead><tbody><tr><td>売上</td><td>1,200,000</td><td>1,350,000</td><td>1,410,000</td><td>1,280,000</td><td>1,520,000</td><td>1,610,000</td><td>前年比で増加した</td></tr></tbody></table>",
    state: "narrow",
    toggle: true,
  },
};

export const NoToggle: Story = {
  name: "NoToggle",
  parameters: { server: { id: "wide" } },
  args: {
    html: "<table><thead><tr><th>項目</th><th>1 月</th><th>2 月</th><th>3 月</th><th>4 月</th><th>5 月</th><th>6 月</th><th>備考</th></tr></thead><tbody><tr><td>売上</td><td>1,200,000</td><td>1,350,000</td><td>1,410,000</td><td>1,280,000</td><td>1,520,000</td><td>1,610,000</td><td>前年比で増加した</td></tr></tbody></table>",
  },
};

export const SmallScreen: Story = {
  name: "SmallScreen",
  parameters: { server: { id: "wide" } },
  args: {
    html: "<table><thead><tr><th>項目</th><th>1 月</th><th>2 月</th><th>3 月</th><th>4 月</th><th>5 月</th><th>6 月</th><th>備考</th></tr></thead><tbody><tr><td>売上</td><td>1,200,000</td><td>1,350,000</td><td>1,410,000</td><td>1,280,000</td><td>1,520,000</td><td>1,610,000</td><td>前年比で増加した</td></tr></tbody></table>",
    toggle: true,
    frameWidth: "390px",
  },
};
