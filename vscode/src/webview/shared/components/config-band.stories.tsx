import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ConfigBand } from "./config-band.tsx";

const meta = {
  title: "VSCode/ConfigBand",
  component: ConfigBand,
  args: { onOpenConfig: fn() },
} satisfies Meta<typeof ConfigBand>;
export default meta;

/** ストーリー: 部品設計『設定ファイルを読めない帯』の状態 */
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: { path: "mdmark.config.yaml", line: 4 },
};

export const NarrowLongPath: Story = {
  name: "NarrowLongPath",
  args: {
    path: "docs/settings/mdmark/mdmark.config.workspace-shared.yaml",
    line: 12,
  },
};
