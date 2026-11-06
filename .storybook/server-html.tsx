import type { Decorator } from "@storybook/react-vite";
import { useEffect, useRef, useState } from "react";

/** `/render/{id}?{引数}` の部品の HTML を描く。200 でなければ状態コードと本文で例外を投げ、Storybook のエラーにする */
export const ServerHtml = ({
  id,
  args,
}: {
  /** ストーリーの `parameters.server.id` */
  id: string;
  /** ストーリーの引数（server 形式と同じく文字列にして問い合わせの引数にする） */
  args: Record<string, unknown>;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // 取得の失敗。次の描画で投げる
  const [failure, setFailure] = useState<{ error: unknown } | undefined>();
  if (failure !== undefined) {
    throw failure.error;
  }
  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(args).map(([key, value]) => [key, String(value)]),
    );
    let active = true;
    fetch(`/render/${id}?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${response.status}: ${await response.text()}`);
        }
        return response.text();
      })
      .then(
        (html) => {
          if (active && ref.current !== null) {
            ref.current.innerHTML = html;
          }
        },
        (error: unknown) => {
          if (active) {
            setFailure({ error });
          }
        },
      );
    return () => {
      active = false;
    };
  }, [id, args]);
  return <div ref={ref} />;
};

/** `parameters.server.id` があれば、ストーリーの代わりに描画の口の HTML を描く。無ければストーリーをそのまま描く */
export const withServerHtml: Decorator = (Story, context) => {
  const server = (context.parameters as { server?: { id?: string } }).server;
  if (server?.id === undefined) {
    return <Story />;
  }
  return <ServerHtml id={server.id} args={context.args} />;
};
