import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Media" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Video: Story = {
  name: "Video",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "プレビューを開く操作",
    caption: "プレビューを開く操作",
    poster: "demo-poster.png",
  },
};

export const VideoAutoplay: Story = {
  name: "VideoAutoplay",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "繰り返し再生する短い操作",
    caption: "繰り返し再生する短い操作",
    width: "320px",
    autoplay: true,
    loop: true,
  },
};

export const VideoNoCaption: Story = {
  name: "VideoNoCaption",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "操作の動画",
    poster: "demo-poster.png",
  },
};

export const Audio: Story = {
  name: "Audio",
  parameters: { server: { id: "media" } },
  args: {
    kind: "audio",
    src: "voice.mp3",
    alt: "読み上げの見本",
    caption: "読み上げの見本（3 秒）",
  },
};

export const VideoPrint: Story = {
  name: "VideoPrint",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "プレビューを開く操作",
    caption: "プレビューを開く操作",
    poster: "demo-poster.png",
  },
};
