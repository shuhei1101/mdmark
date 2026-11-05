import type { Meta, StoryObj } from "@storybook/react-vite";
import { serverHtml } from "./server-html.tsx";

const meta = { title: "Parts/Table", decorators: [serverHtml], render: () => <></> } satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

export const Data: Story = {
  parameters: { server: { id: "table" } },
  args: {"kind": "data", "features": "[\"sort\",\"pin\",\"filter\"]", "columns": "[\"記法\",\"機能名\",\"増分（KB）\"]", "rows": "[[\"表の操作\",\"table\",\"6.2\"],[\"注意書き\",\"callout\",\"1.4\"],[\"タブ\",\"tabs\",\"2.1\"]]"},
};
