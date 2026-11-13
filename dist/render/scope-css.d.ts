/** 範囲の `css` の各規則を、範囲の根の要素 `.mdmark-html[data-html-scope="{scope}"]` の中だけに該当する CSS にする */
export declare function scopeCss(options: {
    /** 範囲の `css` のコードブロックの中身 */
    css: string;
    /** 範囲の通し番号 */
    scope: number;
}): string;
