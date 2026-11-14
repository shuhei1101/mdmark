/** 読者が開閉した部品の要素の開閉を、`partKey` の鍵から引く記録。`mount` ごとに 1 つ作る */
export type PartStates = Map<string, {
    open: boolean;
    marker: string;
}>;
/** `partKey` の種類ごとに、同じセクションの中の何番目かを数える部品の要素のセレクタ */
export declare const PART_SELECTORS: {
    readonly "row-detail": "table:has(tr.mdmark-row-detail)";
    readonly details: 'details[class="mdmark-collapsible"]';
    readonly callout: "details.markdown-alert";
    readonly er: 'figure.mdmark-diagram[data-diagram="er"]';
    readonly tree: "div.mdmark-tree";
    readonly code: "pre:has([data-fold-lines])";
    readonly "table-tree": "div.mdmark-table[data-tree]";
};
/** 部品の種類 */
export type PartKind = keyof typeof PART_SELECTORS;
/** 部品を囲むセクションの `id` と、そのセクションの中の同じ種類の部品の何番目かで、記録の鍵を作る */
export declare const partKey: (options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 部品の要素 */
    part: Element;
    /** 部品の種類 */
    kind: PartKind;
    /** 部品の中の要素の鍵 */
    inner?: string;
}) => string;
/** 記録の `marker` が今のマーカーと同じなら記録の開閉を、そうでなければマーカーのとおりの開閉を返却する */
export declare const startOpen: (options: {
    /** 部品の開閉の記録（無ければ記録を見ない） */
    states: PartStates | undefined;
    /** 記録の鍵 */
    key: string;
    /** 今のマーカーの値 */
    marker: string;
    /** マーカーのとおりの開閉 */
    markerOpen: boolean;
}) => boolean;
/** 読者が変えた後の開閉を記録する */
export declare const recordOpen: (options: {
    /** 部品の開閉の記録（無ければ何もしない） */
    states: PartStates | undefined;
    /** 記録の鍵 */
    key: string;
    /** 変えた後の開閉 */
    open: boolean;
    /** 今のマーカーの値 */
    marker: string;
}) => void;
/** details の範囲と折りたたみの注意書きを記録の開閉で始め、`summary` を押して変えた開閉を記録する。受け取りを取り除く関数を返却する */
export declare const attachDetailsStates: (options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 部品の開閉の記録 */
    states: PartStates;
}) => (() => void);
