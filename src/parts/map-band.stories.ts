import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapBand" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Idle: Story = {
  name: "Idle",
  parameters: { server: { id: "map-band" } },
  args: {},
};

export const Step: Story = {
  name: "Step",
  parameters: { server: { id: "map-band" } },
  args: { index: 1, title: "記法を読む", text: "1 行目\n2 行目\n3 行目" },
};

export const Auto: Story = {
  name: "Auto",
  parameters: { server: { id: "map-band" } },
  args: { index: 0, auto: true },
};

export const Playback: Story = {
  name: "Playback",
  parameters: { server: { id: "map-band" } },
  args: { mode: "playback", index: 2, total: 9, title: "mount を呼ぶ" },
};

export const StatePlayback: Story = {
  name: "StatePlayback",
  parameters: { server: { id: "map-band" } },
  args: {
    mode: "playback",
    unit: "transition",
    index: 5,
    total: 13,
    title: "判定 → 差し戻しの理由を確認する：差し戻し",
  },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-band" } },
  args: { index: 1, title: "長い手順のタイトルで、1 行目に収まらない" },
};
