import type { WebviewMessage } from "../../../messages.ts";

/** `setState` で保存し、再作成した Webview が `getState` で読み込む値 */
export type PreviewState = {
  /** 見えている先頭の元の行番号（0 始まり）。整数に切り捨てず、小数部で行の途中の割合を持つ */
  line: number;
};

/** `acquireVsCodeApi()` が返却する API のうち、Webview が使用するもの */
export type VsCodeApi = {
  /** 拡張機能へ送信する */
  postMessage: (message: WebviewMessage) => void;
  /** 保存した状態を読み込む。持たない代役では行を戻さない */
  getState?: () => unknown;
  /** 状態を保存する。持たない代役では行を保存しない */
  setState?: (state: PreviewState) => void;
};

/** VS Code が Webview に指定する API の取得（2 回目の呼び出しは例外を投げる） */
declare const acquireVsCodeApi: () => VsCodeApi;

/** 最初に取得した API */
let cached: VsCodeApi | undefined;

/** `acquireVsCodeApi()` を初回だけ呼んで覚え、2 回目からは同じ値を返却する */
export const getVsCodeApi = (): VsCodeApi => {
  cached ??= acquireVsCodeApi();
  return cached;
};
