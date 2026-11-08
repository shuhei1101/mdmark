import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/TextColor" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Blue: Story = {
  name: "Blue",
  parameters: { server: { id: "text-color" } },
  args: {
    color: "blue",
    text: "バージョンを固定すると、利用側のページの外観が mdmark の更新で勝手に変わりません。",
  },
};

export const Red: Story = {
  name: "Red",
  parameters: { server: { id: "text-color" } },
  args: {
    color: "red",
    text: "最新のバージョンを指す URL は、更新のたびに外観が変わります。",
  },
};

export const WithLink: Story = {
  name: "WithLink",
  parameters: { server: { id: "text-color" } },
  args: {
    color: "green",
    text: "詳しくは [配布物を読み込む](#) を確認してください。",
  },
};

export const Dark: Story = {
  name: "Dark",
  parameters: { server: { id: "text-color" } },
  args: { color: "orange", text: "気をつける点", scheme: "dark" },
};
