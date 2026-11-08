import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Tabs" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const First: Story = {
  name: "First",
  parameters: { server: { id: "tabs" } },
  args: { titles: '["macOS","Windows","Linux"]', selected: 0 },
};

export const Second: Story = {
  name: "Second",
  parameters: { server: { id: "tabs" } },
  args: { titles: '["macOS","Windows","Linux"]', selected: 1 },
};

export const Many: Story = {
  name: "Many",
  parameters: { server: { id: "tabs" } },
  args: {
    titles:
      '["macOS","Windows","Linux","FreeBSD","とても長いタブ名で並びの幅を超えるもの","Android","iOS"]',
    selected: 0,
  },
};

export const Unmounted: Story = {
  name: "Unmounted",
  parameters: { server: { id: "tabs" } },
  args: { titles: '["macOS","Windows"]' },
};

export const Grouped: Story = {
  name: "Grouped",
  parameters: { server: { id: "tabs" } },
  args: { titles: '["macOS","Windows","Linux"]', selected: 0, group: "os" },
};

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "tabs" } },
  args: { titles: '["uv","pip"]', selected: 0, collapse: "closed" },
};

export const OpenTitle: Story = {
  name: "OpenTitle",
  parameters: { server: { id: "tabs" } },
  args: {
    titles: '["macOS","Windows"]',
    selected: 0,
    collapse: "open",
    title: "入れ方",
  },
};

export const Nested: Story = {
  name: "Nested",
  parameters: { server: { id: "tabs" } },
  args: { titles: '["macOS","Windows"]', selected: 1, nested: true },
};

export const StrongTitle: Story = {
  name: "StrongTitle",
  parameters: { server: { id: "tabs" } },
  args: {
    titles:
      '["<strong>案 A</strong> SVG のまま","<strong>案 B</strong> Chart.js"]',
    selected: 0,
  },
};
