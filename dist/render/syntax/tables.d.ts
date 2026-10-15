import type { StateCore } from "markdown-it";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type TableFeature, type TableFilter, type TableKind } from "../../parts/table.ts";
import { FILTER_KINDS } from "../../table-logic.ts";
export { FILTER_KINDS };
/** 表の種類ごとの既定の機能 */
export declare const TABLE_KINDS: Readonly<Record<TableKind, readonly TableFeature[]>>;
/** 表の印を読んだ結果 */
export type TableSpec = {
    /** 種類。知らない種類は `default` */
    kind: TableKind;
    /** 種類の機能に `+機能`・`-機能` を当てたもの */
    features: TableFeature[];
    /** 絞り込む列。表に無い列名・知らない種類は入れない */
    filters: TableFilter[];
    /** 折り畳み。`closed` と `open` を両方書いたら `closed` */
    collapse: "none" | "closed" | "open";
    /** 読めなかった指定 */
    warnings: WarningItem[];
};
/** 表の印の引数と表の見出しから `TableSpec` を作る。印が無い表は `default` */
export declare function readTableSpec(args: MdmarkMarkArgs | undefined, headers: string[]): TableSpec;
/** 表に読み上げの名前と tabindex を付け、`table` がオンなら、表の印の範囲の表と囲まない表を表の部品の囲みに入れる */
export declare function decorateTables(state: StateCore): void;
