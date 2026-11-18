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
  args: { zoom: 1.25, panelOpen: true },
};

export const Max: Story = {
  name: "Max",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 5, panelOpen: true },
};

export const Min: Story = {
  name: "Min",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 0.25, panelOpen: true },
};

export const Narrow: Story = {
  name: "Narrow",
  parameters: { server: { id: "diagram-frame" } },
  args: { zoom: 0.6, fit: 0.48, panelOpen: true },
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

export const Mermaid: Story = {
  name: "Mermaid",
  parameters: { server: { id: "diagram-frame" } },
  args: { kind: "mermaid", title: "問い合わせの受付", legend: "[]" },
};

export const Map: Story = {
  name: "Map",
  parameters: { server: { id: "diagram-frame" } },
  args: { kind: "map", mapTools: true, panelOpen: true },
};

export const MapInGroup: Story = {
  name: "MapInGroup",
  parameters: { server: { id: "diagram-frame" } },
  args: { kind: "map", mapTools: true, entered: 0 },
};

export const PlainMap: Story = {
  name: "PlainMap",
  parameters: { server: { id: "diagram-frame" } },
  args: { kind: "map", title: "シーケンス図" },
};

export const SequenceHeadsStuck: Story = {
  name: "SequenceHeadsStuck",
  parameters: { server: { id: "diagram-frame" } },
  args: { kind: "map" },
};
