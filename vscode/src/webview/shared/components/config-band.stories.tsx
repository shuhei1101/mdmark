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

export const SettingsUnreadable: Story = {
  name: "SettingsUnreadable",
  args: { path: "~/.config/mdmark/settings.yaml", line: 3 },
};

export const NestedConfigUnreadable: Story = {
  name: "NestedConfigUnreadable",
  args: { path: "docs/mdmark.config.yaml", line: 7 },
};

export const NarrowLongPath: Story = {
  name: "NarrowLongPath",
  args: {
    path: "docs/settings/mdmark/mdmark.config.workspace-shared.yaml",
    line: 12,
  },
};
