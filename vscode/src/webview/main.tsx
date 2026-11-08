import { createRoot } from "react-dom/client";
import { App } from "./app/app.tsx";
import { readBoot, savedLineFrom } from "./features/preview/panel/boot.ts";
import { getVsCodeApi } from "./shared/adapters/vscode-api.ts";
import "./shared/styles/panel.css";

/** Webview の入口。描く先を包む要素から始め方と保存した状態を読み込み、その要素に React の木を描く。描く先を包む要素が無いページでは何もしない */
export const startPreview = (): void => {
  const root = document.getElementById("mdmark-preview");
  if (root === null) {
    return;
  }
  const boot = readBoot(root);
  const api = getVsCodeApi();
  const savedLine = savedLineFrom(api.getState?.());
  createRoot(root).render(
    <App
      boot={boot}
      api={api}
      {...(savedLine === undefined ? {} : { savedLine })}
    />,
  );
};

startPreview();
