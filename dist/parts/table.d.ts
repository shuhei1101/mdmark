import type { TablePinMode } from "../config.ts";
import { type FilterKind, type FilterValue, type TotalCalc } from "../table-logic.ts";
import type { ColorName } from "./colors.ts";
/** 表の種類 */
export type TableKind = "default" | "data" | "plain";
/** 表の機能 */
export type TableFeature = "sort" | "pin" | "filter" | "resize" | "count" | "columns" | "reorder" | "total" | "copy" | "rowlink";
/** 集計する列 */
export type TableTotal = {
    /** 列の位置 */
    column: number;
    /** 計算 */
    calc: TotalCalc;
};
/** コピーのボタンの状態 */
export type CopyState = "idle" | "copied" | "failed";
/** コピーの形式 */
export type CopyFormat = "markdown" | "tsv";
/** 絞り込みを付ける列 */
export type TableFilter = {
    /** 列の位置 */
    column: number;
    /** 絞り込みの種類 */
    kind: FilterKind;
};
/** 表の部品の引数 */
export type TableOptions = {
    /** 表の種類（既定 `default`） */
    kind?: TableKind;
    /** 付ける機能 */
    features: string[];
    /** 列の見出しの HTML。`body` を指定するときは省く */
    columns?: string[];
    /** 行ごとのセルの HTML。`body` を指定するときは省く */
    rows?: string[][];
    /** 絞り込みを付ける列 */
    filters?: TableFilter[];
    /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
    collapse?: "none" | "closed" | "open";
    /** 折り畳みの見出し（既定は `表（{本文の行の数} 行）`） */
    title?: string | undefined;
    /** `rows` を省いたときの本文の行の数。折り畳みの見出しに使用する */
    rowCount?: number;
    /** 並べ替えた列と向き */
    sort?: {
        column: number;
        direction: "ascending" | "descending";
    };
    /** 表が幅からはみ出しているか。`true` のときだけピン止めのボタンを出す */
    overflow?: boolean;
    /** 留める列の位置（小さい順。省くと `rowHeader` の全ての列） */
    pinned?: number[];
    /** `pinned` のうち、表の見えている幅に収まらず留めない列の位置 */
    unpinned?: number[];
    /** ピン止めの動き（既定 `each`）。ボタンの名前と押した状態にする列が変わる */
    pinMode?: TablePinMode;
    /** 開いた絞り込みのドロワーの列の位置 */
    openFilter?: number;
    /** 適用している絞り込み */
    filterValues?: FilterValue[];
    /** 既定で隠す列の位置（`data-hide`。先頭の列は含まない） */
    hide?: number[];
    /** 今隠している列の位置（既定は `hide`） */
    hiddenColumns?: number[];
    /** 列の表示のメニューを開いているか */
    openColumns?: boolean;
    /** 集計する列（`data-total`） */
    totals?: TableTotal[];
    /** コピーのボタンの状態（既定 `idle`） */
    copyState?: CopyState;
    /** 本文の行ごとの `id`。行に `id` と行へのリンクを付ける */
    rowIds?: string[];
    /** URL の `#ID` が指す行の位置 */
    targetRow?: number;
    /** 出している集計の行の計算（既定は `totals` の全ての計算） */
    shownTotals?: TotalCalc[];
    /** 集計のメニューを開いているか */
    openTotals?: boolean;
    /** コピーの形式のメニューを開いているか */
    openCopy?: boolean;
    /** クリップボードに書き込めなかったときに手でコピーさせるパネルの中身 */
    copyFallback?: {
        format: CopyFormat;
        text: string;
    };
    /** `targetRow` の行の URL をコピーした結果 */
    rowLinkNotice?: "copied" | "failed";
    /** 長文の列の位置（`data-long`） */
    long?: number[] | undefined;
    /** 並べ替えを付けない列の位置（`data-no-sort`） */
    noSort?: number[] | undefined;
    /** `width.min`・`width.max` を記載した列（`data-width`。em の数） */
    widthRanges?: Array<{
        column: number;
        min?: number;
        max?: number;
    }> | undefined;
    /** `mount` が自動で決めた列の幅（見出しのセルの外側の幅の px） */
    autoWidths?: Array<{
        column: number;
        width: number;
    }>;
    /** 表の代わりに配置する HTML（`SLOT_MARKER` を指定できる） */
    body?: string;
    /** ドロワーの `id` の頭（既定 `mdmark-table`）。ビューの中の表のように、文書の中に表が 2 つ以上あるときに重ならない値を指定する */
    id?: string;
    /** 強調する列の位置と色 */
    highlight?: Array<{
        column: number;
        color: ColorName;
    }>;
    /** 本文の行ごとの色（色を付けない行は `null`） */
    rowColors?: Array<ColorName | null>;
    /** `columns.{列名}.pinned` の `true` の列の位置（小さい順。`data-pin` に半角の空白で区切って写す） */
    pin?: number[] | undefined;
    /** `columns.{列名}.pinned` の `false` の列の位置（既定で留める列から除く。`data-unpin` に半角の空白で区切って写す） */
    unpin?: number[] | undefined;
    /** 幅を指定した列と、その列の外側の幅（px） */
    widths?: Array<{
        column: number;
        width: number;
    }>;
    /** つまみをドラッグしている列の位置 */
    resizing?: number;
    /** 折り返さずに広く取る列の位置 */
    wide?: number[];
    /** 真偽値を ✓ と空欄で出す列の位置（`data-check`） */
    check?: number[];
    /** 階層にするキーの列の位置（`data-tree`） */
    tree?: number | undefined;
    /** 今の列の順（元の列の位置の並び。ストーリーで使用する） */
    order?: number[];
    /** ドラッグしている列と、落とす先の列と向き（ストーリーで使用する） */
    dragging?: {
        column: number;
        target: number;
        side: "before" | "after";
    };
    /** 階層の表の型の列の位置 */
    treeType?: number;
    /** 階層の表の必須の列の位置 */
    treeRequired?: number;
    /** 階層の表の既定の列の位置 */
    treeDefault?: number;
    /** 畳んだ行のパス（ストーリーで使用する） */
    collapsedPaths?: string[];
    /** キーの列の絞り込みの単語（ストーリーで使用する） */
    treeFilter?: string;
    /** 選んだ行のパス（ストーリーで使用する） */
    selectedPath?: string;
    /** 表の下に配置する YAML の見本（ストーリーで使用する） */
    example?: {
        heading: string;
        tabs: Array<{
            name: string;
            lines?: Array<{
                text: string;
                path?: string;
            }>;
        }>;
        active?: number;
        hidden?: boolean;
    };
    /** 見出しの行ごとのセル。指定すると `columns` の代わりに見出しの行をこの行の並びで描く */
    headRows?: TableHeadCell[][];
    /** 本文の各行で `<th scope="row">` にする先頭の列の数（既定 0） */
    rowHeader?: number;
    /** 表示している行の隣り合う同じ値を結合する列の位置（小さい順） */
    mergeColumns?: number[];
    /** 言語 `csv` のコードブロックから作った表の、記載したとおりの CSV */
    rawCsv?: string | undefined;
    /** 元の CSV を出しているか（既定 `false`） */
    rawShown?: boolean;
};
/** CSV の表の RAW のボタンを右端に配置する帯の HTML を返却する */
export declare const renderRawBar: (pressed: boolean) => string;
/** CSV の表の RAW のボタンの HTML を返却する */
export declare const renderRawToggle: (pressed: boolean) => string;
/** 多段の見出しのセル */
export type TableHeadCell = {
    /** セルの HTML */
    html: string;
    /** セルの左端の列の位置 */
    column: number;
    /** 覆う行の数（既定 1） */
    rowspan?: number;
    /** 覆う列の数（既定 1） */
    colspan?: number;
};
/** 見出しのボタンとドロワーを作る引数 */
export type TableToolsOptions = {
    /** ドロワーの id の頭 */
    id: string;
    /** 列の位置 */
    column: number;
    /** 列名 */
    label: string;
    /** 機能 */
    features: string[];
    /** 並べ替えのボタンにするか（既定 `true`。`false` なら `features` に `sort` があっても列名を文字のままにする） */
    sortable?: boolean;
    /** 絞り込み（`select` は候補の値） */
    filter?: {
        kind: FilterKind;
        values: string[];
    } | undefined;
    /** 絞り込みを適用しているか */
    active?: boolean;
    /** ドロワーを開いているか */
    open?: boolean;
    /** 適用している絞り込み */
    value?: FilterValue | undefined;
    /** ピン止めのボタンを出すか（既定 `false`。`mount` が幅を測って決める） */
    pinVisible?: boolean;
    /** ピン止めのボタンを押した状態にするか */
    pinPressed?: boolean;
    /** ピン止めのボタンを、表の見えている幅に収まらず留まっていない状態にするか */
    pinUnpinned?: boolean;
    /** ピン止めの動き（既定 `each`）。ボタンの名前が変わる */
    pinMode?: TablePinMode;
};
/** 表の見えている幅に収まらず留まっていない列のピン止めのボタンの名前に付ける文言 */
export declare const PIN_UNPINNED_SUFFIX = "\uFF08\u8868\u306E\u5E45\u306B\u53CE\u307E\u3089\u306A\u3044\u305F\u3081\u7559\u307E\u3063\u3066\u3044\u307E\u305B\u3093\uFF09";
/** ピン止めのボタンの名前（`aria-label`）を返却する。留まっていない列は `PIN_UNPINNED_SUFFIX` を付ける */
export declare function pinButtonLabel(options: {
    /** 列名 */
    label: string;
    /** ピン止めの動き */
    mode: TablePinMode;
    /** 表の見えている幅に収まらず留まっていないか */
    unpinned: boolean;
}): string;
/** 列 1 つの見出しの中身（並べ替え・絞り込み・ピン止めのボタンと、`resize` のときは列の幅のつまみ）と、その列の絞り込みのドロワーの HTML を返却する */
export declare function renderTableTools(options: TableToolsOptions): {
    header: string;
    drawer: string;
};
/** コピーのボタンの状態ごとの文言とアイコン */
export declare const COPY_STATES: {
    readonly idle: {
        readonly label: "表をコピー";
        readonly icon: "copy";
    };
    readonly copied: {
        readonly label: "コピーしました";
        readonly icon: "check";
    };
    readonly failed: {
        readonly label: "コピーできませんでした";
        readonly icon: "circle-alert";
    };
};
/** コピーのボタンの中身（アイコンとスクリーンリーダー向けの名前）の HTML */
export declare function renderCopyButtonContent(state: CopyState): string;
/** コピーの形式の名前と用途 */
export declare const COPY_FORMATS: {
    readonly markdown: {
        readonly name: "Markdown の表";
        readonly note: "文書に貼るとそのまま表になる";
    };
    readonly tsv: {
        readonly name: "TSV";
        readonly note: "表計算ソフトに貼るとセルに分かれる";
    };
};
/** 表の上の帯（件数・テーブル設定・集計・コピーのボタン）と、テーブル設定のパネル・集計・コピーの形式のメニューの HTML を返却する。付けた機能が無ければ空 */
export declare function renderTableBar(options: {
    /** メニューの id の頭 */
    id: string;
    /** 付ける機能 */
    features: string[];
    /** 列名 */
    labels: string[];
    /** 表示している行の数 */
    shown: number;
    /** 全ての行の数 */
    total: number;
    /** 隠している列の位置 */
    hiddenColumns: number[];
    /** テーブル設定のパネルを開いているか（既定 `false`） */
    openColumns?: boolean;
    /** 今の列の順（既定は元の列の順） */
    order?: number[];
    /** 列ごとの結合した見出しの範囲（既定は全て範囲の外） */
    groups?: Array<string | undefined>;
    /** 結合した見出しの範囲ごとの見出しの文字 */
    groupLabels?: Record<string, string>;
    /** 留めている列の数（既定 0） */
    pinned?: number;
    /** ドラッグしている列と、落とす先の列と向き */
    dragging?: {
        column: number;
        target: number;
        side: "before" | "after";
    };
    /** コピーのボタンの状態（既定 `idle`） */
    copyState?: CopyState;
    /** 集計する計算 */
    totals?: TotalCalc[];
    /** 出している集計の行の計算（既定は `totals` の全て） */
    shownTotals?: TotalCalc[];
    /** 集計のメニューを開いているか（既定 `false`） */
    openTotals?: boolean;
    /** コピーの形式のメニューを開いているか（既定 `false`） */
    openCopy?: boolean;
}): {
    bar: string;
    menus: string;
};
/** 表の帯に配置する、テーブル設定のアイコンだけのボタンの HTML を返却する */
export declare function renderSettingsToggle(options: {
    /** パネルの id の頭 */
    id: string;
    /** 隠している列の数 */
    hidden: number;
    /** パネルを開いているか */
    open: boolean;
}): string;
/** テーブル設定のボタンの隠した列の数とスクリーンリーダー向けの名前を書き換える */
export declare function updateSettingsToggle(toggle: HTMLElement, hidden: number): void;
/** テーブル設定のパネル（タイトル・列名の一覧・案内）の HTML を返却する。`hidden` は付けない */
export declare function renderTableSettings(options: {
    /** パネルの id の頭 */
    id: string;
    /** 元の列の順の列名 */
    columns: string[];
    /** 今の列の順（元の列の位置の並び） */
    order: number[];
    /** 隠している列の位置 */
    hidden: number[];
    /** `columns`・`reorder` のうち付けた機能 */
    features: TableFeature[];
    /** 列ごとの結合した見出しの範囲 */
    groups: Array<string | undefined>;
    /** 結合した見出しの範囲ごとの見出しの文字 */
    groupLabels?: Record<string, string>;
    /** 留めている列の数 */
    pinned: number;
    /** ドラッグしている列と、落とす先の列と向き */
    dragging?: {
        column: number;
        target: number;
        side: "before" | "after";
    };
}): string;
/** 階層の表のキーのセルの中身（深さの数の縦線・末尾の名前・配列の `[]`・必須の *）の HTML を返却する */
export declare function renderTreeKeyCell(options: {
    /** `splitKeyPath` の末尾の名前 */
    name: string;
    /** 深さ */
    depth: number;
    /** 必須か */
    required: boolean;
}): string;
/** 型のセルの文字を、`a | b` の構造なら値ごとのチップ、それ以外はバッジにした HTML を返却する */
export declare function renderTypeCell(text: string): string;
/** 階層の行の開閉・パスのコピー・見本の表示を切り替えるボタンの HTML を返却する */
export declare function renderTreeTools(options: {
    /** 返却するボタン */
    kind: "toggle" | "copy" | "example";
    /** 行のパス */
    path?: string;
    /** 開いているか */
    expanded?: boolean;
    /** 見本の `id` */
    controls?: string;
}): string;
/** 集計の行（`<tfoot>`）の HTML を返却する。計算ごとに 1 行（`sum`・`avg`・`count` の順）で、列の数だけセルを持つ。先頭のセルに計算の名前、集計する列のセルに値を出し、隠している列のセルと出さない計算の行は隠す */
export declare function renderTotalRows(options: {
    /** 列の数 */
    columns: number;
    /** 集計する列と計算と整えた値 */
    totals: Array<TableTotal & {
        value: string;
    }>;
    /** 出す計算（既定は全て） */
    shown?: TotalCalc[];
    /** 隠している列の位置 */
    hiddenColumns: number[];
    /** 列名（`data-label`） */
    labels: string[];
}): string;
/** 手でコピーさせるパネルの形式。`tree` はファイルツリーの元の罫線のテキスト */
export type CopyPanelFormat = CopyFormat | "tree";
/** クリップボードに書き込めなかったときに、帯の直後へ配置する手でコピーさせるパネルの HTML を返却する */
export declare function renderCopyPanel(options: {
    /** タイトルの id の頭 */
    id: string;
    /** コピーの形式 */
    format: CopyPanelFormat;
    /** コピーする文字 */
    text: string;
}): string;
/** 行へのリンクのマーカーを持つ先頭のセルの HTML を返却する。`content` は先頭のセルの中身（`SLOT_MARKER` を指定して前後に分けられる）。`notice` を指定すると、URL をコピーした結果をマーカーの横の通知に出す */
export declare function renderRowLink(content: string, id: string, label: string, notice?: "copied" | "failed"): string;
/** 真偽値のセルの中身の HTML を返却する。`true` は ✓ のアイコン、`false` はスクリーンリーダー向けの `いいえ` */
export declare function renderCheckCell(value: "true" | "false"): string;
/** セルの文字が真偽値か */
export declare function isCheckValue(text: string): text is "true" | "false";
/** 表を囲む HTML を返却する。`body` を指定すると囲みだけを作り、指定しなければ `columns`・`rows` から表を作る */
export declare function renderTable(options: TableOptions): string;
