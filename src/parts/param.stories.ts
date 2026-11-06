import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/ParamControl" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "param" } },
};

export const Changed: Story = {
  name: "Changed",
  parameters: { server: { id: "param" } },
  args: { value: 8 },
};

export const Copied: Story = {
  name: "Copied",
  parameters: { server: { id: "param" } },
  args: { value: 8, copy: "copied" },
};

export const Failed: Story = {
  name: "Failed",
  parameters: { server: { id: "param" } },
  args: { value: 8, copy: "failed" },
};

export const CustomCopyLabel: Story = {
  name: "CustomCopyLabel",
  parameters: { server: { id: "param" } },
  args: { copyLabel: "コピー" },
};
