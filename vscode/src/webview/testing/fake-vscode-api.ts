import type { WebviewMessage } from "../../messages.ts";
import type { PreviewState } from "../features/preview/panel/boot.ts";
import type { VsCodeApi } from "../shared/adapters/vscode-api.ts";

/** 送ったメッセージと保存した状態を記録する VS Code の API の代役 */
export type FakeVsCodeApi = VsCodeApi & {
  /** 送ったメッセージ（送った順） */
  posted: WebviewMessage[];
  /** 保存した状態（保存した順） */
  states: PreviewState[];
};

/** 送ったメッセージと保存した状態を記録し、`getState` が渡した初期の状態を返す代役を作る */
export const createFakeVsCodeApi = (
  options: {
    /** `getState` が返す状態 */
    state?: unknown;
    /** 送ったときの処理（ストーリーは `ready` を受けて拡張機能のメッセージを返す） */
    onPost?: (message: WebviewMessage) => void;
  } = {},
): FakeVsCodeApi => {
  const posted: WebviewMessage[] = [];
  const states: PreviewState[] = [];
  return {
    posted,
    states,
    postMessage: (message) => {
      posted.push(message);
      options.onPost?.(message);
    },
    getState: () => options.state,
    setState: (state) => {
      states.push(state);
    },
  };
};
