// PoC: 部品の HTML 文字列を、今の描画のインターフェース（/render/{id}）から取って描く CSF のストーリーの共通部品
import type { Decorator } from "@storybook/react-vite";
import { useEffect, useRef } from "react";

/** /render/{id}?{引数} の HTML を描く */
export const ServerHtml = ({
  id,
  args,
}: {
  id: string;
  args: Record<string, unknown>;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(
      Object.entries(args).map(([key, value]) => [key, String(value)]),
    );
    void fetch(`/render/${id}?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${response.status}: ${await response.text()}`);
        }
        return response.text();
      })
      .then((html) => {
        if (ref.current !== null) {
          ref.current.innerHTML = html;
        }
      });
  }, [id, args]);
  return <div ref={ref} />;
};

/** parameters.server.id の部品を描くデコレーター */
export const serverHtml: Decorator = (_Story, context) => (
  <ServerHtml
    id={(context.parameters as { server: { id: string } }).server.id}
    args={context.args}
  />
);
