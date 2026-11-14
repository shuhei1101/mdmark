import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiagramTooltip" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "diagram-tooltip" } },
};

export const Wire: Story = {
  name: "Wire",
  parameters: { server: { id: "diagram-tooltip" } },
  args: { kind: "wire", open: true },
};

export const Term: Story = {
  name: "Term",
  parameters: { server: { id: "diagram-tooltip" } },
  args: { term: true, open: true },
};

export const Hint: Story = {
  name: "Hint",
  parameters: { server: { id: "diagram-tooltip" } },
  args: { kind: "hint", open: true },
};

export const Table: Story = {
  name: "Table",
  parameters: { server: { id: "diagram-tooltip" } },
  args: { kind: "table", open: true },
};

export const Item: Story = {
  name: "Item",
  parameters: { server: { id: "diagram-tooltip" } },
  args: { kind: "item", open: true },
};

export const GroupHint: Story = {
  name: "GroupHint",
  parameters: { server: { id: "diagram-tooltip" } },
  args: { kind: "hint", group: true, open: true },
};

export const Annotation: Story = {
  name: "Annotation",
  parameters: { server: { id: "diagram-tooltip" } },
  args: {
    kind: "hint",
    hint: "入力の値を判定の条件と比べる",
    annotations:
      '[{"number":1,"html":"条件を満たさないときは次の工程へ進む。"}]',
    open: true,
  },
};

export const AnnotationOnlyWire: Story = {
  name: "AnnotationOnlyWire",
  parameters: { server: { id: "diagram-tooltip" } },
  args: {
    kind: "wire",
    annotations:
      '[{"number":1,"html":"条件を満たさないときは次の工程へ進む。"}]',
    open: true,
  },
};
