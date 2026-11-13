import type { WarningItem } from "../../extensions.ts";
import type { MarkOptions } from "../mark-options.ts";
/** 折り畳みに入れるかと、既定の開閉 */
export type CollapseMode = "none" | "closed" | "open";
/** 表・タブ・ステップのマーカーの `collapse` を読み込んだ結果 */
export type CollapseSpec = {
    /** 折り畳みに入れるかと既定の開閉 */
    collapse: CollapseMode;
    /** 折り畳みの見出し（`collapse.title`）。折り畳まないときと空の文字では入れない */
    title?: string | undefined;
};
/** 今の書き方のマーカーの引数の文字から、`title=値` の直後に空白を挟んで続く `キー=値` でない単語（空白を含むタイトルの続き）を返却する */
export declare function titleTailOf(text: string): string | undefined;
/** `title=` の値の空白の後ろの単語の警告の項目 */
export declare function titleTailItem(word: string): WarningItem;
/** 表・タブ・ステップのマーカーの設定の `collapse`（共通のオブジェクトの折り畳み）を読み込む */
export declare function readCollapse(options: MarkOptions): CollapseSpec;
