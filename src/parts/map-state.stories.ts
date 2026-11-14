import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MapState" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "map-state" } },
  args: {},
};

export const Playing: Story = {
  name: "Playing",
  parameters: { server: { id: "map-state" } },
  args: { focus: '{"nodes": ["判定", "s1"], "wires": ["t6"]}' },
};

export const SelfTransitionPlaying: Story = {
  name: "SelfTransitionPlaying",
  parameters: { server: { id: "map-state" } },
  args: { focus: '{"nodes": ["下書き"], "wires": ["t2"]}' },
};

export const StateSelected: Story = {
  name: "StateSelected",
  parameters: { server: { id: "map-state" } },
  args: { selected: '["確認待ち"]' },
};

export const Entered: Story = {
  name: "Entered",
  parameters: { server: { id: "map-state" } },
  args: { entered: "実行中" },
};

export const Collapsed: Story = {
  name: "Collapsed",
  parameters: { server: { id: "map-state" } },
  args: { collapsed: '["実行中"]' },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "map-state" } },
  args: { frameWidth: "390px" },
};
