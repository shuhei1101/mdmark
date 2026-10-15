import { escapeHtml } from "./escape.ts";

/** 図表の番号の題で囲んだ HTML を返す。画像は題を下、表は題を上に置く。`id` を省くと `id` を付けない */
export function renderFigure(options: {
  /** 囲むものの種類 */
  kind: "image" | "table";
  /** 印に書いた ID */
  id?: string;
  /** 文書の頭から種類ごとに数えた番号 */
  number: number;
  /** 画像の title（番号の後ろに置く） */
  caption?: string;
  /** 囲む画像か表の HTML（`SLOT_MARKER` を渡せる） */
  body: string;
}): string {
  const { kind, id, number, caption = "", body } = options;
  const idAttribute = id === undefined ? "" : ` id="fig-${escapeHtml(id)}"`;
  const label = kind === "image" ? "図" : "表";
  const text = kind === "image" ? escapeHtml(caption) : "";
  const figcaption = `<figcaption class="mdmark-figure-caption"><b>${label} ${number}</b>${text}</figcaption>`;
  const content =
    kind === "image" ? `${body}${figcaption}` : `${figcaption}${body}`;
  return `<figure class="mdmark-figure"${idAttribute}>${content}</figure>`;
}
