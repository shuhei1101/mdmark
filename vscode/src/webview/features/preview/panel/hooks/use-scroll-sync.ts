import { useEffect } from "react";
import type { VsCodeApi } from "../../../../shared/adapters/vscode-api.ts";
import type { DocumentView } from "../document-view.ts";

/** 見えている先頭の位置を、再作成した Webview が読み込めるように保存する */
export const saveLine = (view: DocumentView, api: VsCodeApi): void => {
  const line = view.currentPosition();
  if (line !== undefined) {
    api.setState?.({ line });
  }
};

/** `scroll` を描画の 1 フレームごとに 1 回にまとめ、行が返ったときだけ `revealLine` を送信し、見えている先頭の位置を保存する */
export const useScrollSync = (options: {
  /** 描いた文書 */
  view: DocumentView;
  /** VS Code の Webview の API */
  api: VsCodeApi;
}): void => {
  const { view, api } = options;
  useEffect(() => {
    let queued = false;
    let frame = 0;
    const onScroll = (): void => {
      if (queued) {
        return;
      }
      queued = true;
      frame = requestAnimationFrame(() => {
        queued = false;
        const line = view.takeScroll();
        if (line !== undefined) {
          api.postMessage({ type: "revealLine", line });
        }
        saveLine(view, api);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [view, api]);
};
