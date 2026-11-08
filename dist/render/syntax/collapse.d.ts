import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
/** 折り畳みに入れるかと、既定の開閉 */
export type CollapseMode = "none" | "closed" | "open";
/** 表・タブ・ステップの印から `closed`・`open`・`title=` を読んだ結果 */
export type CollapseSpec = {
    /** 折り畳みに入れるかと既定の開閉。`closed` と `open` を両方書いたら `closed` */
    collapse: CollapseMode;
    /** 折り畳みの見出し（`title=` の値）。`collapse` が `none` のときと、値の無い `title=` では入れない */
    title?: string | undefined;
    /** 読めなかった指定 */
    items: WarningItem[];
    /** `title=` の値の空白の後ろの単語。`closed`・`open` と、`+`・`-` で始まる語は入れない。呼ぶ側が知らない指定として読み飛ばす前にこの単語と比べ、同じなら `titleTailItem` の警告にする */
    titleTail?: string | undefined;
    /** `closed`・`open`・`title=` を除いた残りの引数 */
    rest: MdmarkMarkArgs;
};
/** 印の引数の文字から、`title=値` の直後に空白を挟んで続く `キー=値` でない単語（空白を含む題の続き）を返す */
export declare function titleTailOf(text: string): string | undefined;
/** `title=` の値の空白の後ろの単語の警告の項目 */
export declare function titleTailItem(word: string): WarningItem;
/** 表・タブ・ステップの印の引数から `closed`・`open`・`title=` を読む。`text` は印の引数の文字で、`title=` の値の空白の後ろの単語を `titleTail` にする */
export declare function readCollapse(args: MdmarkMarkArgs, text?: string): CollapseSpec;
