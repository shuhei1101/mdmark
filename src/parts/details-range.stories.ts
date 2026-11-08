import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DetailsRange" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "details-range" } },
  args: { title: "補足の手順", html: "<p>中身の段落</p>" },
};

export const Open: Story = {
  name: "Open",
  parameters: { server: { id: "details-range" } },
  args: { title: "実行の例", html: "<p>中身の段落</p>", open: true },
};
