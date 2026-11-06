import { useRef, useState } from "react";
import type { HostMessage } from "../../../../messages.ts";
import type { VsCodeApi } from "../../../shared/adapters/vscode-api.ts";
import { ConfigBand } from "../../../shared/components/config-band.tsx";
import {
  PreviewStatus,
  type PreviewStatusState,
} from "../../../shared/components/preview-status.tsx";
import { applyAssetUrls, collectAssetPaths } from "./assets.ts";
import type { PreviewBoot } from "./boot.ts";
import type { DocumentView } from "./document-view.ts";
import { useDocumentView } from "./hooks/use-document-view.ts";
import { useHostMessages } from "./hooks/use-host-messages.ts";
import { useLinkClicks } from "./hooks/use-link-clicks.ts";
import { useLoadMdmark } from "./hooks/use-load-mdmark.ts";
import { useMediaErrors } from "./hooks/use-media-errors.ts";
import { saveLine, useScrollSync } from "./hooks/use-scroll-sync.ts";
import { loadMdmark, type Mdmark } from "./load-mdmark.ts";

/** 文書の代わりに出す状態の表示 */
type StatusView = { state: PreviewStatusState; version?: string };

/** プレビューの画面の props */
export type PanelScreenProps = {
  /** パネルの始め方 */
  boot: PreviewBoot;
  /** VS Code の Webview の API */
  api: VsCodeApi;
  /** 保存した行。最初の `render` でその行へ戻す */
  savedLine?: number;
  /** 配布物を読む関数（ストーリーと単体テストが代役を渡す） */
  load?: (url: string) => Promise<Mdmark>;
};

/** 配布物を読まずに出す状態が始め方にあるか */
const isUndecidable = (boot: PreviewBoot): boolean =>
  boot.status === "versionUndecidable" || boot.distJs === undefined;

/** 始め方の版を添えた状態の表示 */
const statusWithVersion = (
  state: PreviewStatusState,
  version: string | undefined,
): StatusView => (version === undefined ? { state } : { state, version });

/** `render` で描いた後、相対パスの画像・動画・音声を拡張機能に Webview の URL へ解決させる */
const requestAssets = (
  boot: PreviewBoot,
  api: VsCodeApi,
  assetsId: { current: number },
): void => {
  const paths = collectAssetPaths(boot.root);
  if (paths.length > 0) {
    assetsId.current += 1;
    api.postMessage({ type: "resolveAssets", id: assetsId.current, paths });
  }
};

/** テストのときだけ、調べた要素か axe の違反を同じ `id` で返す */
const answerTest = (
  view: DocumentView,
  api: VsCodeApi,
  message: Extract<HostMessage, { type: "inspect" | "axe" }>,
): Promise<void> =>
  message.type === "inspect"
    ? view.inspect(message.selector, message.play).then((elements) => {
        api.postMessage({ type: "inspected", id: message.id, elements });
      })
    : view.audit().then((violations) => {
        api.postMessage({ type: "axed", id: message.id, violations });
      });

/** 状態の表示・帯・描く先の要素を並べ、配布物の読み込み・拡張機能のメッセージ・スクロール・リンクをつなぐ */
export const PanelScreen = ({
  boot,
  api,
  savedLine,
  load = loadMdmark,
}: PanelScreenProps) => {
  const [status, setStatus] = useState<StatusView | undefined>(() =>
    isUndecidable(boot) ? { state: "versionUndecidable" } : undefined,
  );
  const [configErrorLine, setConfigErrorLine] = useState<number | undefined>();
  // メッセージの処理と読み込みの結果の処理で投げた例外。次の描画で投げて Error Boundary へ渡す
  const [failure, setFailure] = useState<{ error: unknown } | undefined>();
  if (failure !== undefined) {
    throw failure.error;
  }
  const { view, documentRef } = useDocumentView(
    savedLine === undefined
      ? { root: boot.root }
      : { root: boot.root, savedLine },
  );
  // 最初の `rendered` を送ったか、描けない理由を出したか
  const settled = useRef(isUndecidable(boot));
  // 最後に送った `resolveAssets` の番号
  const assetsId = useRef(0);

  /** 処理を呼び、投げた例外を Error Boundary へ渡す */
  const run = (handle: () => void): void => {
    try {
      handle();
    } catch (error) {
      setFailure({ error });
    }
  };

  /** 描く。差分のパネルで配布物が差分の色分けに対応しないときは、描かずに理由を出す */
  const render = (message: Extract<HostMessage, { type: "render" }>): void => {
    settled.current = true;
    if (message.previous !== undefined && !view.supportsDiff()) {
      setStatus(statusWithVersion("diffUnsupported", boot.version));
      api.postMessage({ type: "loadFailed", reason: "diffUnsupported" });
      return;
    }
    view.render(message);
    setStatus(undefined);
    api.postMessage({ type: "rendered" });
    saveLine(view, api);
    requestAssets(boot, api, assetsId);
  };

  const onMessage = (message: HostMessage): void => {
    switch (message.type) {
      case "render":
        render(message);
        return;
      case "assetsResolved":
        if (message.id === assetsId.current) {
          applyAssetUrls(boot.root, message.urls);
        }
        return;
      case "scrollToLine":
        view.scrollToLine(message.line);
        return;
      case "configError":
        setConfigErrorLine(message.line);
        return;
      case "configOk":
        setConfigErrorLine(undefined);
        return;
      case "inspect":
      case "axe":
        if (boot.test) {
          answerTest(view, api, message).catch((error: unknown) =>
            setFailure({ error }),
          );
        }
        return;
      default: {
        const unknown: never = message;
        throw new Error(`知らないメッセージ: ${JSON.stringify(unknown)}`);
      }
    }
  };

  useLinkClicks(api);
  useScrollSync({ view, api });
  useMediaErrors(boot.root);
  useHostMessages((message) => run(() => onMessage(message)));
  useLoadMdmark({
    distJs: isUndecidable(boot) ? undefined : boot.distJs,
    load,
    onLoaded: (mdmark) =>
      run(() => {
        view.useMdmark(mdmark);
        api.postMessage({ type: "ready" });
      }),
    onFailed: (reason) =>
      run(() => {
        settled.current = true;
        setStatus(statusWithVersion(reason, boot.version));
        api.postMessage({ type: "loadFailed", reason });
      }),
    onSlow: () => {
      // 1 秒未満で描き終えるときに読み込み中が一瞬だけ出ないよう、待ってから出す
      if (!settled.current) {
        setStatus({ state: "loading" });
      }
    },
  });

  return (
    <>
      {status !== undefined && (
        <PreviewStatus
          state={status.state}
          {...(status.version === undefined ? {} : { version: status.version })}
          onReload={() => api.postMessage({ type: "reload" })}
        />
      )}
      {configErrorLine !== undefined && (
        <ConfigBand
          path={boot.configPath}
          line={configErrorLine}
          onOpenConfig={() => api.postMessage({ type: "openConfig" })}
        />
      )}
      <div ref={documentRef} hidden={status !== undefined} />
    </>
  );
};
