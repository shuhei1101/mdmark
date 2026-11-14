import type { MdmarkChartDefinition, MdmarkErDefinition, MdmarkErTable, MdmarkFlowDefinition } from "../diagram/definition.ts";
import { type IconName } from "./icons.ts";
/** 凡例の項目 */
export type DiagramLegendItem = {
    /** 見本の種類: `series-{n}`・`fill-{n}`・`point-{n}`・`bubble`・ER 図の `er-*`・`info`・`underline` */
    sample: string;
    /** 意味 */
    label: string;
};
/** 図の枠の引数 */
export type DiagramFrame = {
    /** 中の図の種類 */
    kind: "chart" | "er" | "mermaid" | "map";
    /** 題名 */
    title: string;
    /** 範囲（種類 `mermaid` では持たず、タイトルに出さない） */
    scope?: string;
    /** 更新日（種類 `mermaid` では持たず、タイトルに出さない） */
    updated?: string;
    /** 凡例の項目 */
    legend: DiagramLegendItem[];
    /** 今の倍率（定義の大きさを 1 とする） */
    zoom?: number;
    /** 全体が収まる倍率（倍率のボタンはこれを 100% として出す。省くと 1） */
    fit?: number;
    /** 全画面のモーダルの中に描くか */
    modal?: boolean;
    /** 表示する枠の右下にリサイズハンドルを配置するか（既定 `true`。モーダルの中には配置しない） */
    resizable?: boolean;
    /** 開いたときの倍率の下限（`figure` の `data-fit-min` に入れる） */
    fitMin?: number;
    /** 置き場所の幅いっぱいに広げるか（`figure` に `data-wide="true"`。map の図） */
    wide?: boolean;
    /** 指で図を動かす操作中か（表示するノードに `data-touch-active` を付ける。ストーリーの状態だけが指定する） */
    touchActive?: boolean;
    /** 右上の帯の先頭に並べるボタン（map の図）。`name` は `MAP_TOOL_ICONS` のキー */
    tools?: Array<{
        name: string;
        label: string;
        disabled?: boolean;
    }>;
    /** ツールチップと矢じりの `id` の頭 */
    id: string;
};
/** map の図の右上の帯の先頭のボタンのアイコン */
export declare const MAP_TOOL_ICONS: Readonly<Record<string, IconName>>;
/** 図の中身 */
export type DiagramBody = {
    /** 図の HTML */
    html: string;
    /** 図の幅（px） */
    width: number;
    /** 図の高さ（px） */
    height: number;
    /** ツールチップの HTML */
    tips: string;
};
/** `renderFlow`・`renderEr`・`renderChart` の戻り値: 図の中身と、凡例に記載する図の特徴 */
export type DiagramPart = DiagramBody & {
    /** 横の線が縦の線を飛び越える点があるか */
    jumps: boolean;
    /** 用語の下線を付けたノードの文字があるか */
    terms: boolean;
};
/** 用語から意味を参照する関数。意味が無い用語は `undefined` */
export type TermLookup = (word: string) => string | undefined;
/** ツールチップの引数 */
export type DiagramTip = {
    /** ツールチップの `id` */
    id: string;
    /** 線の詳細か、文だけか（ノード・グループの説明・埋め込んだ HTML の `data-hint`）か、ER 図のテーブルか、グラフの項目か */
    kind: "wire" | "hint" | "table" | "item";
    /** 持ち主の名前。ツールチップのタイトルに出す */
    label: string;
    /** グラフの項目の値の文（`item` のとき） */
    value?: string;
    /** 線の詳細 */
    tip?: string;
    /** ノード・グループの説明か `data-hint` の文 */
    hint?: string;
    /** ER 図のテーブル。タイトルを `{論理名}（{物理名}）` にし、概要と、`desc` を持つ列の名前と説明を並べる */
    table?: MdmarkErTable;
    /** 持ち主を参照する名前（線の `id`・`node:{ノードの id}`・`term:{単語}`）。省くとタイトル */
    owner?: string;
    /** 開いているか */
    open?: boolean;
};
/** 図のツールチップを描く。文だけの `hint` は、行内の要素の後ろにも配置できるよう `span` で出す */
export declare function renderDiagramTip(tip: DiagramTip): string;
/** 図の中のツールチップを集める入れ物 */
export type TipList = {
    /** ツールチップを追加して `id` を返却する */
    add: (tip: Omit<DiagramTip, "id">) => string;
    /** 追加したツールチップの HTML */
    html: () => string;
};
/** `id` の頭から通し番号の `id` を振るツールチップの入れ物を作る */
export declare function createTips(prefix: string): TipList;
/** 定義の文字の `{{単語}}` を、意味のある用語なら下線とツールチップの持ち主にし、それ以外は単語だけにして、文字を逃がして返却する */
export declare function renderText(text: string, tips: TipList, lookup: TermLookup | undefined, found: {
    terms: boolean;
}): string;
/** 説明を持つグループのタイトルの右のマーカー（説明が無ければ空） */
export declare function groupInfo(options: {
    hint: string | undefined;
    label: string;
    owner: string;
    tips: TipList;
}): string;
/** map の構成図のノードと線を描く */
export declare function renderFlow(definition: MdmarkFlowDefinition, id: string, hints: boolean, lookup?: TermLookup): DiagramPart;
/** ER 図を描く: テーブルを配置し、関係の線と両端の多重度の記号を svg に描き、ラベルを縦の線の中ほどに配置する */
export declare function renderEr(definition: MdmarkErDefinition, id: string, hints: boolean, lookup?: TermLookup): DiagramPart;
/** 図の定義 */
type LegendDefinition = MdmarkChartDefinition | MdmarkErDefinition;
/** 凡例の項目: グラフは系列（円とドーナツは項目）、ER 図はテーブルの種類・列のマーカー・多重度を並べる */
export declare function legendFor(definition: LegendDefinition): DiagramLegendItem[];
/** 凡例の項目の並び（`ul` の中身）。`id` はグラフの塗りの模様の見本が指す `id` の頭 */
export declare function renderLegendItems(id: string, items: DiagramLegendItem[]): string;
/** 図の枠を描く: タイトル・ボタンの帯・表示する枠・ツールチップの中身・凡例を並べる */
export declare function renderDiagramFrame(frame: DiagramFrame, body: DiagramBody): string;
/** 図の種類 */
export type DiagramKind = Exclude<DiagramFrame["kind"], "mermaid" | "map">;
/** 図を描く: 種類ごとの中身を描き、凡例を決めて枠に差す。`hints` がオフ（既定はオン）なら、ER 図のテーブルの説明のツールチップとボタンを配置しない */
export declare function renderDiagram(options: {
    kind: DiagramKind;
    definition: LegendDefinition;
    /** ツールチップと矢じりの `id` の頭 */
    id: string;
    /** 用語から意味を参照する関数 */
    lookup?: TermLookup;
    /** 機能 `hints` がオンか（既定 `true`） */
    hints?: boolean;
    /** 機能 `diagram-resize` がオンか（既定 `true`） */
    resizable?: boolean;
    zoom?: number;
    fit?: number;
    modal?: boolean;
    /** 指で図を動かす操作中か（ストーリーの状態だけが指定する） */
    touchActive?: boolean;
}): string;
export {};
