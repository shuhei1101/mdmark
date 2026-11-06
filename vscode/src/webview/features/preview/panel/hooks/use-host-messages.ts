import { useEffect, useEffectEvent } from "react";
import type { HostMessage } from "../../../../../messages.ts";

/** `window` の `message` を購読し、最新の処理に `HostMessage` を渡す。後始末で購読を外す */
export const useHostMessages = (
  onMessage: (message: HostMessage) => void,
): void => {
  const handle = useEffectEvent((event: MessageEvent<HostMessage>) => {
    onMessage(event.data);
  });
  useEffect(() => {
    const listener = (event: MessageEvent<HostMessage>) => handle(event);
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
};
