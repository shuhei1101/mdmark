import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Chart" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const TwoSeries: Story = {
  name: "TwoSeries",
  parameters: { server: { id: "chart" } },
};

export const FourSeries: Story = {
  name: "FourSeries",
  parameters: { server: { id: "chart" } },
  args: { series: 4 },
};

export const Invalid: Story = {
  name: "Invalid",
  parameters: { server: { id: "chart" } },
  args: { invalid: true },
};

export const Bar: Story = {
  name: "Bar",
  parameters: { server: { id: "chart" } },
  args: { type: "bar" },
};

export const BarFour: Story = {
  name: "BarFour",
  parameters: { server: { id: "chart" } },
  args: { type: "bar", series: 4 },
};

export const Pie: Story = {
  name: "Pie",
  parameters: { server: { id: "chart" } },
  args: { type: "pie" },
};

export const Scatter: Story = {
  name: "Scatter",
  parameters: { server: { id: "chart" } },
  args: { type: "scatter" },
};

export const SixSeries: Story = {
  name: "SixSeries",
  parameters: { server: { id: "chart" } },
  args: { sample: "reply-time-6" },
};

export const Area: Story = {
  name: "Area",
  parameters: { server: { id: "chart" } },
  args: { sample: "visits-area" },
};

export const StackedArea: Story = {
  name: "StackedArea",
  parameters: { server: { id: "chart" } },
  args: { sample: "visits-stacked-area" },
};

export const StackedBar: Story = {
  name: "StackedBar",
  parameters: { server: { id: "chart" } },
  args: { sample: "inquiry-stacked" },
};

export const HorizontalBar: Story = {
  name: "HorizontalBar",
  parameters: { server: { id: "chart" } },
  args: { sample: "inquiry-horizontal" },
};

export const Donut: Story = {
  name: "Donut",
  parameters: { server: { id: "chart" } },
  args: { sample: "reply-kind-donut" },
};

export const Radar: Story = {
  name: "Radar",
  parameters: { server: { id: "chart" } },
  args: { sample: "review-radar" },
};

export const Bubble: Story = {
  name: "Bubble",
  parameters: { server: { id: "chart" } },
  args: { sample: "inquiry-bubble" },
};

export const Combo: Story = {
  name: "Combo",
  parameters: { server: { id: "chart" } },
  args: { sample: "inquiry-combo" },
};

export const TooManySeries: Story = {
  name: "TooManySeries",
  parameters: { server: { id: "chart" } },
  args: { tooMany: true },
};

export const ItemFocused: Story = {
  name: "ItemFocused",
  parameters: { server: { id: "chart" } },
  args: { focusItem: true },
};
