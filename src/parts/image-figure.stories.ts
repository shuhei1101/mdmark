import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/ImageFigure" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Caption: Story = {
  name: "Caption",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "screen-light.svg",
    alt: "プレビューを開いた画面",
    caption: "プレビューを開いた画面",
  },
};

export const NoCaption: Story = {
  name: "NoCaption",
  parameters: { server: { id: "image-figure" } },
  args: { src: "step-1.svg", alt: "手順 1 の画面" },
};

export const WidthPx: Story = {
  name: "WidthPx",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-2.svg",
    alt: "手順 2 の画面",
    caption: "幅 240px",
    width: "240px",
  },
};

export const WidthPercent: Story = {
  name: "WidthPercent",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-3.svg",
    alt: "手順 3 の画面",
    caption: "本文の幅の 50%",
    width: "50%",
  },
};

export const AlignLeft: Story = {
  name: "AlignLeft",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-1.svg",
    alt: "左に置いた画面",
    caption: "左に置いた画面",
    width: "200px",
    align: "left",
  },
};

export const AlignRight: Story = {
  name: "AlignRight",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-2.svg",
    alt: "右に置いた画面",
    caption: "右に置いた画面",
    width: "200px",
    align: "right",
  },
};

export const AlignCenter: Story = {
  name: "AlignCenter",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-3.svg",
    alt: "中央に置いた画面",
    caption: "中央に置いた画面",
    width: "240px",
    align: "center",
  },
};

export const NoLightbox: Story = {
  name: "NoLightbox",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-4.svg",
    alt: "拡大しない画面",
    caption: "拡大しない画面",
    lightbox: false,
  },
};

export const OnlyLight: Story = {
  name: "OnlyLight",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "screen-light.svg#only-light",
    alt: "明るい配色のときの画面",
    caption: "プレビューの画面（明るい配色）",
    only: "light",
  },
};

export const OnlyDark: Story = {
  name: "OnlyDark",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "screen-dark.svg#only-dark",
    alt: "暗い配色のときの画面",
    caption: "プレビューの画面（暗い配色）",
    only: "dark",
    scheme: "dark",
  },
};

export const SubFigure: Story = {
  name: "SubFigure",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "screen-dark.svg",
    alt: "暗い配色の画面",
    caption: "暗い配色",
    id: "fig-schemes-b",
    label: "図 2b",
  },
};

export const LongCaption: Story = {
  name: "LongCaption",
  parameters: { server: { id: "image-figure" } },
  args: {
    src: "step-2.svg",
    alt: "手順 2 の画面",
    caption:
      "設定ファイルを読めないときに文書の先頭へ帯を出し、設定ファイルを開くボタンから直せることを示す画面",
    width: "240px",
  },
};
