/** 行のうち `data-col` を持つセルを、列の順 `order` に並べ直す（持たないセルとセルの置き場所は変えない） */
export declare function reorderRowCells(row: HTMLTableRowElement, order: number[]): void;
/** 表の帯のテーブル設定のパネルのつまみに、ドラッグ＆ドロップと ↑・↓ キーで列を動かす操作を付ける。列を動かしたら見出し・本文の行・集計の行のセルと一覧を並べ直し、`onReorder` に新しい列の順を渡す。受け取りを外す関数を返す */
export declare function attachTableSettings(options: {
    /** `div.mdmark-table` */
    wrapper: HTMLElement;
    /** 囲みの中の表 */
    table: HTMLTableElement;
    /** 列を動かした後に呼ぶ */
    onReorder: (order: number[]) => void;
}): () => void;
