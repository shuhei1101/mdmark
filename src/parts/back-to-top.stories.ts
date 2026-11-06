import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/BackToTop" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Shown: Story = {
  name: "Shown",
  parameters: { server: { id: "back-to-top" } },
  args: {},
};

export const Hidden: Story = {
  name: "Hidden",
  parameters: { server: { id: "back-to-top" } },
  args: { hidden: true },
};
