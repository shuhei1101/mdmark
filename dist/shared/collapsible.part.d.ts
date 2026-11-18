/** タブとステップを入れる折り畳みの HTML を返却する。`body` は `SLOT_MARKER` を指定できる */
export declare function renderCollapsible(options: {
    /** 見出しの文字 */
    title: string;
    /** 既定で開くか */
    open: boolean;
    /** 中身の HTML */
    body: string;
    /** `mdmark-collapsible` の後ろに加える class */
    className?: string;
}): string;
