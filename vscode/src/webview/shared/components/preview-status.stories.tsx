import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { PreviewStatus } from "./preview-status.tsx";

const meta = {
  title: "VSCode/PreviewStatus",
  component: PreviewStatus,
  args: { onReload: fn() },
} satisfies Meta<typeof PreviewStatus>;
export default meta;

/** ストーリー: 部品設計『プレビューの状態の表示』の状態 */
type Story = StoryObj<typeof meta>;

export const Loading: Story = { name: "Loading", args: { state: "loading" } };

export const Offline: Story = {
  name: "Offline",
  args: { state: "offline", version: "v0.7.0" },
};

export const VersionMissing: Story = {
  name: "VersionMissing",
  args: { state: "versionMissing", version: "v9.9.9" },
};

export const VersionMissingLong: Story = {
  name: "VersionMissingLong",
  args: {
    state: "versionMissing",
    version: "v0.7.0-rc.1+build.20261023.feature-vscode-preview-extension",
  },
};

export const VersionUndecidable: Story = {
  name: "VersionUndecidable",
  args: { state: "versionUndecidable" },
};

export const DiffUnsupported: Story = {
  name: "DiffUnsupported",
  args: { state: "diffUnsupported", version: "v0.8.0" },
};

export const Unexpected: Story = {
  name: "Unexpected",
  args: { state: "unexpected" },
};
