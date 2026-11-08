import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Figure" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const ImageWithCaption: Story = {
  name: "ImageWithCaption",
  parameters: { server: { id: "figure" } },
  args: { kind: "image", id: "arch", number: 1, caption: "全体の構成" },
};

export const Image: Story = {
  name: "Image",
  parameters: { server: { id: "figure" } },
  args: { kind: "image", id: "flow", number: 2 },
};

export const Table: Story = {
  name: "Table",
  parameters: { server: { id: "figure" } },
  args: { kind: "table", id: "list", number: 1 },
};

export const Gallery: Story = {
  name: "Gallery",
  parameters: { server: { id: "figure" } },
  args: {
    kind: "image",
    id: "schemes",
    number: 2,
    caption: "配色ごとのプレビュー",
    body: "gallery",
  },
};
