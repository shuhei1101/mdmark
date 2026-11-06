import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/EmbeddedHtml" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画の口（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  name: "Default",
  parameters: { server: { id: "embedded-html" } },
};

export const WithChart: Story = {
  name: "WithChart",
  parameters: { server: { id: "embedded-html" } },
  args: { chart: true },
};

export const Wide: Story = {
  name: "Wide",
  parameters: { server: { id: "embedded-html" } },
  args: { wide: true },
};

export const WithRangeCss: Story = {
  name: "WithRangeCss",
  parameters: { server: { id: "embedded-html" } },
  args: {
    scope: 0,
    css: ".box { background-color: var(--mdmark-color-accent-blue-bg) }",
    script: '{"lang":"ts","code":"export default (root: HTMLElement) => {}"}',
  },
};

export const RangeScriptOpened: Story = {
  name: "RangeScriptOpened",
  parameters: { server: { id: "embedded-html" } },
  args: {
    scope: 0,
    css: ".box { display: none } :scope.is-open .box { display: block }",
    opened: true,
  },
};
