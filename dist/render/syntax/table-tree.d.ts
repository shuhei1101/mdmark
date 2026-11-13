import type { StateCore } from "markdown-it";
import type { TableSpec } from "./tables.ts";
/** 階層の表の `table_open` の `meta` に `decorateTables` が配置する、表の指定と表のマーカーの文字 */
export type TreeTableMeta = {
    treeSpec?: TableSpec;
    treeMark?: string;
};
/** `tree` の表の本文の各行にパスと深さを付け、表に無い親の行を差し込み、キー・型・必須・既定の列のセルを替える */
export declare function decorateTreeTable(options: {
    /** markdown-it の状態 */
    state: StateCore;
    /** 表の `table_open` の位置 */
    start: number;
    /** 表の `table_close` の位置 */
    end: number;
    /** `readTableSpec` の結果（`tree` を持つ） */
    spec: TableSpec;
}): void;
/** コアルール。`example` を持つ階層の表ごとに、見出しの直下のタブの範囲を表の直後の見本に移し、表と見本を `div.mdmark-tree-layout` で囲む */
export declare function linkTreeExamples(state: StateCore): void;
