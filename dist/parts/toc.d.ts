/** 目次に載せる見出し */
export type TocHeading = {
    /** 見出しの階層 */
    level: 2 | 3;
    /** 見出しの ID */
    id: string;
    /** 見出しの文字 */
    text: string;
};
/** 目次の HTML を返す。h3 は直前の h2 の入れ子にする */
export declare function renderToc(options: {
    /** 文書の h2・h3 */
    headings: TocHeading[];
}): string;
