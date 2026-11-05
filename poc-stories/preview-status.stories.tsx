import type { Meta, StoryObj } from "@storybook/react-vite";
import { serverHtml } from "./server-html.tsx";

const meta = { title: "VSCode/PreviewStatus", decorators: [serverHtml], render: () => <></> } satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { server: { id: "preview-status" } },
  args: {"state": "loading"},
};

export const Offline: Story = {
  parameters: { server: { id: "preview-status" } },
  args: {"state": "offline", "version": "v0.7.0"},
};
