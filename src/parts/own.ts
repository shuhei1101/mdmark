/** 中身を持つ部品に中身の代わりに渡し、記法がこの前後で HTML を分ける文字列。Markdown に現れない制御文字だけで作る */
export const SLOT_MARKER = "\u0000mdmark-slot\u0000";

/** 部品の HTML の全ての開始タグに `data-mdmark-own="{nonce}"` を足す。閉じタグと文字はそのまま */
export function markOwn(html: string, nonce: string): string {
  return html.replace(
    /<([a-zA-Z][a-zA-Z0-9-]*)/g,
    `<$1 data-mdmark-own="${nonce}"`,
  );
}

/** `SLOT_MARKER` の位置で部品の HTML を分ける（差し込み口が n 個なら n + 1 個に分かれる） */
export function splitSlots(html: string): string[] {
  return html.split(SLOT_MARKER);
}
