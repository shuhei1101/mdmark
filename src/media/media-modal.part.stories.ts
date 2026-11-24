import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Parts/MediaModal",
} satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Video: Story = {
  name: "Video",
  parameters: { server: { id: "media-modal" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    label: "素材 2",
    caption: "操作の画面",
    poster: "demo-poster.png",
  },
};

export const VideoNoCaption: Story = {
  name: "VideoNoCaption",
  parameters: { server: { id: "media-modal" } },
  args: { kind: "video", src: "demo.mp4", label: "素材 1" },
};

export const Audio: Story = {
  name: "Audio",
  parameters: { server: { id: "media-modal" } },
  args: {
    kind: "audio",
    src: "voice.mp3",
    label: "読み上げ",
    caption: "読み上げの見本",
  },
};

export const LongLabel: Story = {
  name: "LongLabel",
  parameters: { server: { id: "media-modal" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    label:
      "設定ファイルを読み込めないときに文書の先頭へ出すバーの操作を、最初から最後まで通した長い名前の素材",
    caption:
      "設定ファイルを読み込めないときに文書の先頭へバーを出し、設定ファイルを開くボタンから修正できることを示す画面の操作",
  },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "media-modal" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    label: "素材 2",
    caption: "操作の画面",
    frameWidth: "390px",
  },
};
