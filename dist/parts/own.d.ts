/** 中身を持つ部品に中身の代わりに渡し、記法がこの前後で HTML を分ける文字列。Markdown に現れない制御文字だけで作る */
export declare const SLOT_MARKER = "\0mdmark-slot\0";
/** 部品の HTML の全ての開始タグに `data-mdmark-own="{nonce}"` を足す。閉じタグと文字はそのまま */
export declare function markOwn(html: string, nonce: string): string;
/** `SLOT_MARKER` の位置で部品の HTML を分ける（差し込み口が n 個なら n + 1 個に分かれる） */
export declare function splitSlots(html: string): string[];
