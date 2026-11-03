import type { StateCore, Token } from "markdown-it";
import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
import { type TableFeature, type TableFilter, type TableKind, type TableTotal } from "../../parts/table.ts";
import { FILTER_KINDS } from "../../table-logic.ts";
import { type SyntaxWarning } from "./warnings.ts";
export { FILTER_KINDS };
/** 表の種類ごとの既定の機能 */
export declare const TABLE_KINDS: Readonly<Record<TableKind, readonly TableFeature[]>>;
/** 表の機能の名前。後ろの 5 つはどの種類の既定にも入らず、`+機能` を書いた表にだけ付く */
export declare const TABLE_FEATURES: readonly TableFeature[];
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
    /** 折り畳みの見出し（`title=` の値）。`collapse` が `none` のときと、値の無い `title=` では入れない */
    title?: string | undefined;
    /** 読めなかった指定 */
    warnings: WarningItem[];
    /** `hide=` で既定で隠す列の位置。`columns` の無い表・先頭の列・表に無い列名は入れない */
    hide: number[];
    /** `total=` で集計する列。`total` の無い表・表に無い列名・知らない計算は入れない */
    totals: TableTotal[];
};
/** 並びをコードにして `・` でつなぐ */
export declare function codes(values: readonly string[]): string;
/** `filter=` の値を、表の見出しの文字と照らして読む */
export declare function readFilters(value: string, headers: string[], warnings: WarningItem[]): TableFilter[];
/** 表の印の引数と表の見出しから `TableSpec` を作る。印が無い表は `default` */
export declare function readTableSpec(args: MdmarkMarkArgs | undefined, headers: string[]): TableSpec;
/** 先頭のセルの文字から行の ID を作る。見出しの ID と同じ規則で、`taken` にあれば `-1`・`-2` と番号を上げる。作れないときは `row` を元にする。返した ID を `taken` に足す */
export declare function rowIdOf(text: string, taken: Set<string>): string;
/** 表の指定の警告を、書き方の警告に渡す値にする: 項目の形のものは 1 つにまとめ、1 文のものは 1 つずつ */
export declare function warningsOf(mark: string, warnings: WarningItem[]): SyntaxWarning[];
/** 表の見出しの文字を集める */
export declare function headersOf(tokens: Token[], tableOpen: number): string[];
/** 表に読み上げの名前と tabindex を付け、`table` がオンなら、表の印の範囲の表と囲まない表を表の部品の囲みに入れる */
export declare function decorateTables(state: StateCore): void;
