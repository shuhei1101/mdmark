import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/DiagramFrame" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Fit: Story = {
  name: "Fit",
  parameters: { server: { id: "diagram-frame" } },
};

export const Zoomed: Story = {
  name: "Zoomed",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 1.25 },
};

export const Max: Story = {
  name: "Max",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 3 },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 0.6, fit: 0.48 },
};

export const Fullscreen: Story = {
  name: "Fullscreen",
  parameters: { server: { id: "diagram-frame" } },
  args: { modal: true },
};

export const InFramedSurface: Story = {
  name: "InFramedSurface",
  parameters: { server: { id: "diagram-frame" } },
  args: { surface: true },
};

export const InFramedSurfaceFullscreen: Story = {
  name: "InFramedSurfaceFullscreen",
  parameters: { server: { id: "diagram-frame" } },
  args: { modal: true, surface: true },
};

export const Resized: Story = {
  name: "Resized",
  parameters: { server: { id: "diagram-frame" } },
  args: { height: 240 },
};

export const ResizeHandleFocused: Story = {
  name: "ResizeHandleFocused",
  parameters: { server: { id: "diagram-frame" } },
  args: { focusResize: true },
};

export const ResizeOff: Story = {
  name: "ResizeOff",
  parameters: { server: { id: "diagram-frame" } },
  args: { resizable: false },
};

export const NoLegendItems: Story = {
  name: "NoLegendItems",
  parameters: { server: { id: "diagram-frame" } },
  args: { legend: "[]" },
};

export const Mermaid: Story = {
  name: "Mermaid",
  parameters: { server: { id: "diagram-frame" } },
  args: { kind: "mermaid", title: "問い合わせの受付", legend: "[]" },
};

export const TouchActive: Story = {
  name: "TouchActive",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 1.25, touchActive: true },
};
