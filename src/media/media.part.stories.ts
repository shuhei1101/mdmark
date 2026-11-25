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

export const VideoResizable: Story = {
  name: "VideoResizable",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材の確認",
    caption: "素材の確認",
    poster: "demo-poster.png",
    resizable: true,
  },
};

export const VideoResizableHover: Story = {
  name: "VideoResizableHover",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材の確認",
    poster: "demo-poster.png",
    resizeState: "hover",
    resizable: true,
  },
};

export const VideoResizableFocus: Story = {
  name: "VideoResizableFocus",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材の確認",
    poster: "demo-poster.png",
    resizeState: "focus",
    resizable: true,
  },
};

export const VideoResizeMenu: Story = {
  name: "VideoResizeMenu",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材の確認",
    poster: "demo-poster.png",
    resizeState: "menu",
    resizable: true,
  },
};

export const VideoResizableNarrow: Story = {
  name: "VideoResizableNarrow",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材の確認",
    width: "160px",
    resizeState: "menu",
    resizable: true,
  },
};

export const VideoResizablePrint: Story = {
  name: "VideoResizablePrint",
  parameters: { server: { id: "media" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材の確認",
    caption: "素材の確認",
    poster: "demo-poster.png",
    resizable: true,
  },
};

export const OpenButton: Story = {
  name: "OpenButton",
  parameters: { server: { id: "media-opener" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材 1",
    opener: "button",
    inline: true,
  },
};

export const OpenButtonAudio: Story = {
  name: "OpenButtonAudio",
  parameters: { server: { id: "media-opener" } },
  args: {
    kind: "audio",
    src: "voice.mp3",
    alt: "読み上げ",
    opener: "button",
    inline: true,
  },
};

export const OpenButtonCaption: Story = {
  name: "OpenButtonCaption",
  parameters: { server: { id: "media-opener" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "操作の様子",
    caption: "保存までの操作",
    opener: "button",
    inline: false,
  },
};

export const OpenButtonLongLabel: Story = {
  name: "OpenButtonLongLabel",
  parameters: { server: { id: "media-opener" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "設定ファイルを読み込めないときに文書の先頭へ出すバーの操作を、最初から最後まで通した長い名前の素材",
    opener: "button",
    inline: true,
  },
};

export const OpenThumbnail: Story = {
  name: "OpenThumbnail",
  parameters: { server: { id: "media-opener" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "素材 2",
    poster: "demo-poster.png",
    opener: "thumbnail",
    inline: true,
  },
};

export const OpenButtonPrint: Story = {
  name: "OpenButtonPrint",
  parameters: { server: { id: "media-opener" } },
  args: {
    kind: "video",
    src: "demo.mp4",
    alt: "操作の様子",
    caption: "保存までの操作",
    opener: "button",
    inline: false,
  },
};
