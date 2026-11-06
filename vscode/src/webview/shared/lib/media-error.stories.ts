import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "VSCode/MediaError" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Audio: Story = {
  name: "Audio",
  parameters: { server: { id: "media-error" } },
  args: { kind: "audio", format: "m4a", path: "meeting.m4a" },
};

export const Video: Story = {
  name: "Video",
  parameters: { server: { id: "media-error" } },
  args: { kind: "video", format: "webm", path: "media/demo.webm" },
};

export const LongPath: Story = {
  name: "LongPath",
  parameters: { server: { id: "media-error" } },
  args: {
    kind: "video",
    format: "webm",
    path: "media/screen-recording-2026-11-01-very-long-file-name.webm",
  },
};
