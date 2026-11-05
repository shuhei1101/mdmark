import type { Meta, StoryObj } from "@storybook/react-vite";
import { serverHtml } from "./server-html.tsx";

const meta = { title: "Parts/Notice", decorators: [serverHtml], render: () => <></> } satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Figure: Story = {
  parameters: { server: { id: "notice" } },
  args: {"name": "chart", "figure": true},
};

export const Block: Story = {
  parameters: { server: { id: "notice" } },
  args: {"name": "tabs", "figure": false},
};
