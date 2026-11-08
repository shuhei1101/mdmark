import type { WebviewMessage } from "../../messages.ts";
import type { PreviewState, VsCodeApi } from "../shared/adapters/vscode-api.ts";

/** 送信したメッセージと保存した状態を記録する VS Code の API の代役 */
export type FakeVsCodeApi = VsCodeApi & {
  /** 送信したメッセージ（送信した順） */
  posted: WebviewMessage[];
  /** 保存した状態（保存した順） */
  states: PreviewState[];
};

/** 送信したメッセージと保存した状態を記録し、`getState` が指定した初期の状態を返却する代役を作る */
export const createFakeVsCodeApi = (
  options: {
    /** `getState` が返却する状態 */
    state?: unknown;
    /** 送信したときの処理（ストーリーは `ready` を受けて拡張機能のメッセージを返却する） */
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
