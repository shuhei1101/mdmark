import { useEffect, useEffectEvent } from "react";
import type { HostMessage } from "../../../../../messages.ts";

/** `data` が文字列の `type` を持つオブジェクトか（`window` の `message` には拡張機能以外が送るものも届く） */
const hasType = (data: unknown): data is HostMessage =>
  typeof data === "object" &&
  data !== null &&
  "type" in data &&
  typeof data.type === "string";

/** `window` の `message` を購読し、`type` を持つ `data` だけを最新の処理に `HostMessage` として渡す。後始末で購読を外す */
export const useHostMessages = (
  onMessage: (message: HostMessage) => void,
): void => {
  const handle = useEffectEvent((data: HostMessage) => {
    onMessage(data);
  });
  useEffect(() => {
    const listener = (event: MessageEvent<unknown>) => {
      if (hasType(event.data)) {
        handle(event.data);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
};
