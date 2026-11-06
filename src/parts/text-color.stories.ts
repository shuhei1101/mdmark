import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/TextColor" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Blue: Story = {
  name: "Blue",
  parameters: { server: { id: "text-color" } },
  args: {
    color: "blue",
    text: "版を固定すると、使う側のページの見た目が mdmark の更新で勝手に変わりません。",
  },
};

export const Red: Story = {
  name: "Red",
  parameters: { server: { id: "text-color" } },
  args: {
    color: "red",
    text: "最新の版を指す URL は、更新のたびに見た目が変わります。",
  },
};

export const WithLink: Story = {
  name: "WithLink",
  parameters: { server: { id: "text-color" } },
  args: {
    color: "green",
    text: "詳しくは [配布物を読み込む](#) を見てください。",
  },
};

export const Dark: Story = {
  name: "Dark",
  parameters: { server: { id: "text-color" } },
  args: { color: "orange", text: "気をつける点", scheme: "dark" },
};
