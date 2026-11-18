/** 脚注か注記か */
export type FootnoteKind = "footnote" | "annotation";
/** 図の要素の注記の持ち主（線の押せる帯・マーカーのボタン）の `id` の頭 */
export declare const NOTE_OWNER_PREFIX = "mdmark-note-owner-";
/** 注記の持ち主の `id`。要素の ID の空白は `_` にする */
export declare const noteOwnerId: (prefix: string, elementId: string) => string;
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
    /** 脚注か注記か */
    kind?: FootnoteKind;
    /** 文字を挟まずに脚注の番号か注記のマーカーの直後に続く参照か */
    afterRef?: boolean;
}): string;
/** 参照 1 つへ戻るリンクの行き先 */
export type FootnoteBackRef = {
    href: string;
    owner?: string;
};
/** 文書の末尾に配置する、閉じた脚注の一覧の HTML を返却する。項目が無ければ空文字。`html` は描いた HTML なのでエスケープしない */
export declare function renderFootnotes(options: {
    /** 脚注の項目（番号の順）。`refs` があれば `refCount` の代わりに戻るリンクの行き先にする */
    items: Array<{
        number: number;
        html: string;
        refCount: number;
        refs?: FootnoteBackRef[];
    }>;
    /** 開いた外観にするか */
    open?: boolean;
    /** 脚注の一覧か注記の一覧か */
    kind?: FootnoteKind;
}): string;
