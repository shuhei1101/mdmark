import type { MdmarkErCardinality, MdmarkErRelation, MdmarkErTable, MdmarkErTableKind } from "./definition.ts";
/** ER 図のテーブルの種類ごとの見出しの札の名前と、`color` を省いたときの色の名前 */
export declare const ER_TABLE_KINDS: Readonly<Record<MdmarkErTableKind, {
    label: string;
    color: "blue" | "orange";
}>>;
/** ER 図の関係の端の多重度と、凡例に出す名前 */
export declare const ER_CARDINALITIES: Readonly<Record<MdmarkErCardinality, string>>;
/** ER 図の列のマーカーの文字と、`abbr` の `title`・凡例の名前 */
export declare const ER_COLUMN_KEYS: Readonly<Record<"pk" | "fk" | "nn", {
    text: string;
    title: string;
}>>;
/** ER 図の寸法（px）。描いた文書の CSS の `.mdmark-diagram-er-*` と同じ値 */
export declare const ER_METRICS: {
    /** 見出しの高さ */
    readonly head: 44;
    /** 列の行の高さ */
    readonly row: 26;
    /** 畳んだときの `非表示 {数} 列` の行の高さ */
    readonly rest: 24;
    /** 枠と余白 */
    readonly frame: 4;
    /** 図の下の余白 */
    readonly bottom: 32;
};
/** 畳んだときも出す列（主キーか外部キー）か */
export declare function isKeyColumn(column: {
    pk?: boolean;
    fk?: boolean;
}): boolean;
/** ER 図のテーブルの高さ: 見出し・出している列の行・畳んだときの非表示の行・枠と余白を加算する */
export declare function erTableHeight(options: {
    table: MdmarkErTable;
    folded: boolean;
}): number;
/** 関係の線の経路: 元の列の行から先の列の行へ、横・縦・横の直角の線で結ぶ */
export declare function erRelationRoute(options: {
    relation: MdmarkErRelation;
    from: MdmarkErTable;
    to: MdmarkErTable;
    folded: (id: string) => boolean;
}): {
    d: string;
    start: {
        x: number;
        y: number;
        dir: 1 | -1;
    };
    end: {
        x: number;
        y: number;
        dir: 1 | -1;
    };
    label: {
        x: number;
        y: number;
    };
};
