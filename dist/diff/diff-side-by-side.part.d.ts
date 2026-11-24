/** 左右に並べる差分の 1 行（向かい合う 1 組のブロック）。`before`・`after` はブロックを描いた HTML */
export type SideBySideRow = {
    kind: "same" | "change" | "add" | "del";
    before?: string;
    after?: string;
};
/** 部品設計『左右に並べる差分』の HTML 文字列を返却する。広い幅の 2 列と狭い幅の 1 列の 2 つの並びを描き、CSS がどちらかを隠す */
export declare function renderDiffSideBySide(options: {
    before: {
        label: string;
    };
    after: {
        label: string;
    };
    rows: SideBySideRow[];
    /** 列の見出しの `id` の頭（差分の場所の `id`） */
    idPrefix: string;
}): string;
