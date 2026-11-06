import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffMinimap" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Top: Story = {
  name: "Top",
  parameters: { server: { id: "diff-minimap" } },
  args: {
    marks:
      '[{"kind":"del","top":0.02,"height":0.01},{"kind":"add","top":0.03,"height":0.01},{"kind":"del","top":0.41,"height":0.02},{"kind":"add","top":0.68,"height":0.01},{"kind":"del","top":0.93,"height":0.01},{"kind":"add","top":0.94,"height":0.01}]',
    view: '{"top":0,"height":0.18}',
  },
};

export const Middle: Story = {
  name: "Middle",
  parameters: { server: { id: "diff-minimap" } },
  args: {
    marks:
      '[{"kind":"del","top":0.02,"height":0.01},{"kind":"add","top":0.03,"height":0.01},{"kind":"del","top":0.41,"height":0.02},{"kind":"add","top":0.68,"height":0.01},{"kind":"del","top":0.93,"height":0.01},{"kind":"add","top":0.94,"height":0.01}]',
    view: '{"top":0.41,"height":0.18}',
  },
};
