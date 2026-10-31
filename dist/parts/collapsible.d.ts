/** タブとステップを入れる折り畳みの HTML を返す。`body` は `SLOT_MARKER` を渡せる */
export declare function renderCollapsible(options: {
    /** 見出しの文字 */
    title: string;
    /** 既定で開くか */
    open: boolean;
    /** 中身の HTML */
    body: string;
}): string;
