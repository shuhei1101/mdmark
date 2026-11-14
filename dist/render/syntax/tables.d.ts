import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { ColorName } from "../../parts/colors.ts";
import { type TableFeature, type TableKind, type TableTotal } from "../../parts/table.ts";
import { type ColumnLines, FILTER_KINDS, type FilterKind } from "../../table-logic.ts";
import type { MarkOptions } from "../mark-options.ts";
import { type SyntaxWarning } from "./warnings.ts";
export { FILTER_KINDS };
/** 表の種類ごとの既定の機能 */
export declare const TABLE_KINDS: Readonly<Record<TableKind, readonly TableFeature[]>>;
/** 表の機能の名前。後ろの 6 つはどの種類の既定にも入らず、`+機能` を記載した表にだけ付く */
export declare const TABLE_FEATURES: readonly TableFeature[];
/** 表のマーカーを読み込んだ結果 */
export type TableSpec = {
    /** 種類（省くと `default`） */
    kind: TableKind;
    /** 種類の機能に、`features` と列の設定の機能を適用したもの */
    features: TableFeature[];
    /** 絞り込む列。表に無い列名は入れない。`type` を省いた列は `kind` を持たない */
    filters: Array<{
        column: number;
        kind?: FilterKind;
    }>;
    /** 折り畳み */
    collapse: "none" | "closed" | "open";
    /** 折り畳みの見出し（`collapse.title`） */
    title?: string | undefined;
    /** 表に照らして読み込めなかった設定 */
    warnings: WarningItem[];
    /** 既定で隠す列の位置。先頭の列と表に無い列名は入れない */
    hide: number[];
    /** 集計する列と計算 */
    totals: TableTotal[];
    /** `thead` にする表の先頭の行の数（既定 1） */
    headRows: number;
    /** `<th scope="row">` にする本文の各行の先頭の列の数（既定 0） */
    rowHeader: number;
    /** 留める列の位置（小さい順）。`pin` の無い表・`true` の列が無いときは入れない */
    pin?: number[] | undefined;
    /** 既定で留める列から除く列の位置（`pinned` の `false`） */
    unpinned: number[];
    /** 列の幅 */
    widths: Array<{
        column: number;
        mode: "auto" | "nowrap";
        min?: number;
        max?: number;
    }>;
    /** 真偽値を ✓ と空欄で出す列の位置 */
    check: number[];
    /** `columns.{列名}.sort` を記載した列と値（`sort` の機能を持たない表では入れない） */
    sorts: Array<{
        column: number;
        sort: boolean;
    }>;
    /** 階層にするキーの列の位置 */
    tree?: number | undefined;
    /** 型の列の位置 */
    treeType?: number | undefined;
    /** 必須の列の位置 */
    treeRequired?: number | undefined;
    /** 既定の列の位置 */
    treeDefault?: number | undefined;
    /** YAML の見本にするタブの範囲の見出し */
    example?: string | undefined;
};
/** 表の色の指定を読み込んだ結果 */
export type TableColors = {
    /** 強調する列の位置と色。色を省いた列は `blue` */
    highlight: Array<{
        column: number;
        color: ColorName;
    }>;
    /** 本文の行ごとの色。色を付けない行は `null` */
    rows: Array<ColorName | null>;
    /** 読み込めなかった指定 */
    warnings: WarningItem[];
};
/** 並びをコードにして `・` でつなぐ */
export declare function codes(values: readonly string[]): string;
/** 表のマーカーの設定と表の見出しから `TableSpec` を作る。マーカーが無い表は `default` */
export declare function readTableSpec(options: MarkOptions | undefined, headers: string[], rowCount: number): TableSpec;
/** 表のマーカーの `columns.{列名}.highlight` と `rows.colors` を、表の見出しと本文の行のセルの文字で照らして読み込む */
export declare function readTableColors(options: MarkOptions | undefined, headers: string[], cells: string[][]): TableColors;
/** 先頭のセルの文字から行の ID を作る。見出しの ID と同じ規則で、`taken` にあれば `-1`・`-2` と番号を上げる。作れないときは `row` を元にする。返却した ID を `taken` に追加する */
export declare function rowIdOf(text: string, taken: Set<string>): string;
/** 表の指定の警告を、記載の警告に指定する値にする: 項目の構造のものは 1 つにまとめ、1 文のものは 1 つずつ */
export declare function warningsOf(mark: string, warnings: WarningItem[]): SyntaxWarning[];
/** 表の最下段の見出しと本文のセルを列ごとに集め、改行で分けた行と短い値だけのセルかを返却する */
export declare function columnLinesOf(tokens: Token[], tableOpen: number): ColumnLines[];
/** 表の本文の各行のセルの文字を集める */
export declare function bodyCellsOf(tokens: Token[], tableOpen: number): string[][];
/** 表の見出しの文字を集める。見出しが多段なら最下段の行の文字 */
export declare function headersOf(tokens: Token[], tableOpen: number): string[];
/** 表にスクリーンリーダー向けの名前と tabindex を付け、`table` がオンなら、表のマーカーの範囲の表と囲まない表を表の部品の囲みに入れる */
export declare function decorateTables(state: StateCore): void;
