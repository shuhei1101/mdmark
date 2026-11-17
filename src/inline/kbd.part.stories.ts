import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Kbd" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Single: Story = {
  name: "Single",
  parameters: { server: { id: "kbd" } },
  args: { keys: '["Enter"]' },
};

export const Combo: Story = {
  name: "Combo",
  parameters: { server: { id: "kbd" } },
  args: { keys: '["Ctrl","Shift","P"]' },
};

export const PlusKey: Story = {
  name: "PlusKey",
  parameters: { server: { id: "kbd" } },
  args: { keys: '["Ctrl","+"]' },
};

export const Dark: Story = {
  name: "Dark",
  parameters: { server: { id: "kbd" } },
  args: { keys: '["Ctrl","C"]', scheme: "dark" },
};
