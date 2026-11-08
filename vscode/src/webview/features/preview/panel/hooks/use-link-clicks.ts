import { useEffect } from "react";
import type { VsCodeApi } from "../../../../shared/adapters/vscode-api.ts";

/** 押された要素 */
const targetOf = (event: Event): Element | undefined =>
  event.target instanceof Element ? event.target : undefined;

/** 押下の既定の動きと、`window` への伝播を止める（VS Code の Webview の外枠は `window` の `click` でもリンクを開く） */
const stop = (event: Event): void => {
  event.preventDefault();
  event.stopPropagation();
};

/** 本文のリンク・右側の目次のリンク・「既定のアプリで開く」の押下を振り分ける */
export const useLinkClicks = (api: VsCodeApi): void => {
  useEffect(() => {
    const onCapture = (event: MouseEvent): void => {
      const target = targetOf(event);
      // 再生できない動画・音声の「既定のアプリで開く」は、`href` を確認せずに記載したパスで開く
      const opener = target?.closest<HTMLElement>('[data-action="openAsset"]');
      if (opener) {
        stop(event);
        api.postMessage({ type: "openAsset", path: opener.dataset.path ?? "" });
        return;
      }
      const link = target?.closest("a[href]");
      // 右側の目次のリンクは右側の目次へ届け、下のバブリングで止める
      if (!link || link.closest(".mdmark-side-toc") !== null) {
        return;
      }
      stop(event);
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        // ページの中のリンクは、この中で移る
        document
          .getElementById(decodeURIComponent(href.slice(1)))
          ?.scrollIntoView();
        return;
      }
      api.postMessage({ type: "openLink", href });
    };
    // 右側の目次の操作がセクションを開いて移った後に、リンクの既定の動きと window への伝播を止める
    const onBubble = (event: MouseEvent): void => {
      if (targetOf(event)?.closest(".mdmark-side-toc a[href]")) {
        stop(event);
      }
    };
    document.addEventListener("click", onCapture, true);
    document.addEventListener("click", onBubble);
    return () => {
      document.removeEventListener("click", onCapture, true);
      document.removeEventListener("click", onBubble);
    };
  }, [api]);
};
