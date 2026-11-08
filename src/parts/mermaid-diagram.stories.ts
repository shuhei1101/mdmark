import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/MermaidDiagram" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く。`svg`・`printSvg` は `tests/fixtures/mermaid-svg/` の見本の名前 */
type Story = StoryObj<Record<string, unknown>>;

export const Flowchart: Story = {
  name: "Flowchart",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "flowchart", title: "問い合わせの受付" },
};

export const Sequence: Story = {
  name: "Sequence",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "sequence", title: "文書を描く" },
};

export const Class: Story = {
  name: "Class",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "class", title: "クラス図" },
};

export const State: Story = {
  name: "State",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "state", title: "状態遷移図" },
};

export const Er: Story = {
  name: "Er",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "er", title: "ER 図" },
};

export const Gantt: Story = {
  name: "Gantt",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "gantt", title: "ガントチャート" },
};

export const Pie: Story = {
  name: "Pie",
  parameters: { server: { id: "mermaid-diagram" } },
  args: { svg: "pie", title: "円グラフ" },
};

export const DarkWithPrint: Story = {
  name: "DarkWithPrint",
  parameters: { server: { id: "mermaid-diagram" } },
  args: {
    svg: "flowchart-dark",
    printSvg: "flowchart-print",
    title: "問い合わせの受付",
    scheme: "dark",
  },
};
