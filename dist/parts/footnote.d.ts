/** ツールチップの中身の段落 1 つを包む開始タグ（記法が、中身の前後で mdmark が出した要素を見分けるのに使用する） */
export declare const FOOTNOTE_BODY_OPEN = "<span class=\"mdmark-fn-tip-body\">";
/** 本文の脚注の番号と、隣のツールチップの HTML を返却する。`bodies` は描いた HTML なのでエスケープしない */
export declare function renderFootnoteRef(options: {
    /** 脚注の番号 */
    number: number;
    /** その脚注の何回目の参照か（0 から） */
    refIndex?: number;
    /** 脚注の中身の段落ごとの行内の HTML */
    bodies: string[];
    /** 番号の下に開いた外観にするか */
    below?: boolean;
}): string;
/** 文書の末尾に配置する、閉じた脚注の一覧の HTML を返却する。項目が無ければ空文字。`html` は描いた HTML なのでエスケープしない */
export declare function renderFootnotes(options: {
    /** 脚注の項目（番号の順） */
    items: Array<{
        number: number;
        html: string;
        refCount: number;
    }>;
    /** 開いた外観にするか */
    open?: boolean;
}): string;
