import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Gif" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Playing: Story = {
  name: "Playing",
  parameters: { server: { id: "gif" } },
  args: { src: "build.gif", alt: "ビルドの進み具合" },
};

export const Paused: Story = {
  name: "Paused",
  parameters: { server: { id: "gif" } },
  args: { src: "build.gif", alt: "ビルドの進み具合", paused: true },
};

export const NoLightbox: Story = {
  name: "NoLightbox",
  parameters: { server: { id: "gif" } },
  args: { src: "build.gif", alt: "ビルドの進み具合", lightbox: false },
};
