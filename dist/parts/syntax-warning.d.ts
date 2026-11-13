import type { WarningItem } from "../extensions.ts";
/** 記法のマーカーや拡張の引数に読み込めない指定がある箇所に配置する、記載の警告の HTML を返却する */
export declare function renderSyntaxWarning(options: {
    /** 読み込めない指定を記載したマーカーの文字。空なら出さない */
    mark?: string;
    /** 何が読み込めず、どう修正し、どう描いたかの本文 */
    message: string;
    /** 読み込めない指定が複数あるときの項目（既定 `[]`） */
    items?: WarningItem[];
    /** 枠の `id`。ほかの要素が `aria-describedby` で指すときに指定する */
    id?: string;
}): string;
