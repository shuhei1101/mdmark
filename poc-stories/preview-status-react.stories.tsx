import type { Meta, StoryObj } from "@storybook/react-vite";
import { PreviewStatus } from "../vscode/src/webview/react/status.tsx";
import "../vscode/src/webview/react/preview.css";

const DARK_MODERN = {
  "--vscode-editor-background": "#1f1f1f",
  "--vscode-editor-foreground": "#cccccc",
  "--vscode-editorWidget-background": "#202020",
  "--vscode-descriptionForeground": "#9d9d9d",
  "--vscode-button-background": "#0078d4",
  "--vscode-button-foreground": "#ffffff",
  "--vscode-list-hoverBackground": "#2a2d2e",
  "--vscode-widget-border": "#313131",
  "--vscode-focusBorder": "#0078d4",
} as const;

const meta = {
  title: "VSCode/PreviewStatusReact",
  component: PreviewStatus,
  args: { onReload: () => undefined, version: "v0.7.0" },
  // VS Code の Dark Modern の色を、Webview が受け取る --vscode-* の値として :root に与える
  decorators: [
    (Story) => {
      for (const [name, value] of Object.entries(DARK_MODERN)) {
        document.documentElement.style.setProperty(name, value);
      }
      document.body.style.background = DARK_MODERN["--vscode-editor-background"];
      return <Story />;
    },
  ],
} satisfies Meta<typeof PreviewStatus>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = { args: { state: "loading" } };

export const Offline: Story = { args: { state: "offline" } };
