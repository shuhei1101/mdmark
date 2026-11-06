import { ErrorBoundary } from "react-error-boundary";
import type { PreviewBoot } from "../features/preview/panel/boot.ts";
import { PanelScreen } from "../features/preview/panel/panel-screen.tsx";
import type { VsCodeApi } from "../shared/adapters/vscode-api.ts";
import { PreviewStatus } from "../shared/components/preview-status.tsx";

/** Webview のアプリの props */
export type AppProps = {
  /** パネルの始め方 */
  boot: PreviewBoot;
  /** VS Code の Webview の API */
  api: VsCodeApi;
  /** 保存した行 */
  savedLine?: number;
};

/** 画面を Error Boundary で包む。描画中の例外は描画の失敗と「リロード」を出す（リロードで拡張機能が HTML を入れ直す） */
export const App = ({ boot, api, savedLine }: AppProps) => (
  <ErrorBoundary
    fallbackRender={() => (
      <PreviewStatus
        state="unexpected"
        onReload={() => api.postMessage({ type: "reload" })}
      />
    )}
    onError={(error) => console.error("プレビューの描画に失敗した", error)}
  >
    <PanelScreen
      boot={boot}
      api={api}
      {...(savedLine === undefined ? {} : { savedLine })}
    />
  </ErrorBoundary>
);
