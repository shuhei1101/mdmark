import type { Decorator } from "@storybook/react-vite";
import "../vscode/src/webview/shared/styles/panel.css";

/** 配色 */
type Scheme = "light" | "dark";

/** VS Code が Webview の html に渡す色の仮の値（Light Modern と Dark Modern） */
export const VSCODE_THEME_COLORS = {
  light: {
    "--vscode-font-family": "system-ui, sans-serif",
    "--vscode-editor-background": "#ffffff",
    "--vscode-editor-foreground": "#3b3b3b",
    "--vscode-editorWidget-background": "#f8f8f8",
    "--vscode-descriptionForeground": "#3b3b3b",
    "--vscode-button-background": "#005fb8",
    "--vscode-button-foreground": "#ffffff",
    "--vscode-button-hoverBackground": "#0258a8",
    "--vscode-button-secondaryBackground": "#e5e5e5",
    "--vscode-button-secondaryHoverBackground": "#cccccc",
    "--vscode-inputValidation-warningBackground": "#f6f5d2",
    "--vscode-inputValidation-warningBorder": "#b89500",
    "--vscode-widget-border": "#e5e5e5",
    "--vscode-focusBorder": "#005fb8",
  },
  dark: {
    "--vscode-font-family": "system-ui, sans-serif",
    "--vscode-editor-background": "#1f1f1f",
    "--vscode-editor-foreground": "#cccccc",
    "--vscode-editorWidget-background": "#202020",
    "--vscode-descriptionForeground": "#9d9d9d",
    "--vscode-button-background": "#0078d4",
    "--vscode-button-foreground": "#ffffff",
    "--vscode-button-hoverBackground": "#026ec1",
    "--vscode-button-secondaryBackground": "#313131",
    "--vscode-button-secondaryHoverBackground": "#3c3c3c",
    "--vscode-inputValidation-warningBackground": "#352a05",
    "--vscode-inputValidation-warningBorder": "#b89500",
    "--vscode-widget-border": "#313131",
    "--vscode-focusBorder": "#0078d4",
  },
} as const satisfies Record<Scheme, Record<`--vscode-${string}`, string>>;

/** `VSCode/` で始まるストーリーで、`globals.scheme` の `--vscode-*` を `:root` に与え、`body` に VS Code の配色の class を付ける */
export const withVsCodeTheme: Decorator = (Story, context) => {
  if (!context.title.startsWith("VSCode/")) {
    return <Story />;
  }
  const scheme: Scheme = context.globals.scheme === "dark" ? "dark" : "light";
  const html = document.documentElement;
  for (const [name, value] of Object.entries(VSCODE_THEME_COLORS[scheme])) {
    html.style.setProperty(name, value);
  }
  html.style.setProperty(
    "background",
    VSCODE_THEME_COLORS[scheme]["--vscode-editor-background"],
  );
  document.body.classList.toggle("vscode-light", scheme === "light");
  document.body.classList.toggle("vscode-dark", scheme === "dark");
  return <Story />;
};
