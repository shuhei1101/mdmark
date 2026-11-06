import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Lightbox" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Middle: Story = {
  name: "Middle",
  parameters: { server: { id: "lightbox" } },
  args: {
    src: "step-2.svg",
    alt: "手順 2 の画面",
    caption: "幅 240px",
    index: 3,
    total: 15,
  },
};

export const First: Story = {
  name: "First",
  parameters: { server: { id: "lightbox" } },
  args: { src: "step-1.svg", alt: "手順 1 の画面", index: 1, total: 15 },
};

export const Last: Story = {
  name: "Last",
  parameters: { server: { id: "lightbox" } },
  args: { src: "step-4.svg", alt: "手順 4 の画面", index: 15, total: 15 },
};

export const Single: Story = {
  name: "Single",
  parameters: { server: { id: "lightbox" } },
  args: {
    src: "step-3.svg",
    alt: "手順 3 の画面",
    caption: "中央に置いた画面",
    index: 1,
    total: 1,
  },
};

export const Zoomed: Story = {
  name: "Zoomed",
  parameters: { server: { id: "lightbox" } },
  args: {
    src: "step-2.svg",
    alt: "手順 2 の画面",
    caption: "幅 240px",
    index: 3,
    total: 15,
    zoom: 2.5,
  },
};

export const Max: Story = {
  name: "Max",
  parameters: { server: { id: "lightbox" } },
  args: {
    src: "step-2.svg",
    alt: "手順 2 の画面",
    index: 3,
    total: 15,
    zoom: 3,
  },
};

export const LongCaption: Story = {
  name: "LongCaption",
  parameters: { server: { id: "lightbox" } },
  args: {
    src: "step-1.svg",
    alt: "手順 1 の画面",
    caption:
      "設定ファイルを読めないときに文書の先頭へ帯を出し、設定ファイルを開くボタンから直せることを示す画面。帯は文書と一緒にスクロールする",
    index: 2,
    total: 4,
  },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "lightbox" } },
  args: {
    src: "step-2.svg",
    alt: "手順 2 の画面",
    index: 3,
    total: 15,
    frameWidth: "390px",
  },
};
