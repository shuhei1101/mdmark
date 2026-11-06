import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiffMessage" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Same: Story = {
  name: "Same",
  parameters: { server: { id: "diff-message" } },
  args: { kind: "same" },
};

export const Single: Story = {
  name: "Single",
  parameters: { server: { id: "diff-message" } },
  args: { kind: "single" },
};

export const Loading: Story = {
  name: "Loading",
  parameters: { server: { id: "diff-message" } },
  args: { kind: "loading" },
};

export const LoadingSpinner: Story = {
  name: "LoadingSpinner",
  parameters: { server: { id: "diff-message" } },
  args: { kind: "loading", spinner: true },
};
