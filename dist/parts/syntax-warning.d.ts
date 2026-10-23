import type { WarningItem } from "../extensions.ts";
/** 記法の印や拡張の引数に読めない指定がある箇所に置く、書き方の警告の HTML を返す */
export declare function renderSyntaxWarning(options: {
    /** 読めない指定を書いた印の文字。空なら出さない */
    mark?: string;
    /** 何が読めず、どう直し、どう描いたかの本文 */
    message: string;
    /** 読めない指定が複数あるときの項目（既定 `[]`） */
    items?: WarningItem[];
    /** 枠の `id`。ほかの要素が `aria-describedby` で指すときに渡す */
    id?: string;
}): string;
