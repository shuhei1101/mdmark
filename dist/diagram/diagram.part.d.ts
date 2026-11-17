import { type IconName } from "../shared/icons.part.ts";
import type { MdmarkChartDefinition, MdmarkFlowDefinition } from "./definition.ts";
/** 凡例の項目 */
export type DiagramLegendItem = {
    /** 見本の種類: `series-{n}`・`fill-{n}`・`point-{n}`・`bubble`・`info`・`underline` */
    sample: string;
    /** 意味 */
    label: string;
};
/** 図の枠の引数 */
export type DiagramFrame = {
    /** 中の図の種類 */
    kind: "chart" | "mermaid" | "map";
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
/** `renderFlow`・`renderChart` の戻り値: 図の中身と、凡例に記載する図の特徴 */
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
    /** 線の詳細か、文だけか（ノード・グループの説明・埋め込んだ HTML の `data-hint`）か、グラフの項目か */
    kind: "wire" | "hint" | "item";
    /** 持ち主の名前。ツールチップのタイトルに出す */
    label: string;
    /** グラフの項目の値の文（`item` のとき） */
    value?: string;
    /** 線の詳細 */
    tip?: string;
    /** ノード・グループの説明か `data-hint` の文 */
    hint?: string;
    /** 持ち主を参照する名前（線の `id`・`node:{ノードの id}`・`term:{単語}`）。省くとタイトル */
    owner?: string;
    /** 開いているか */
    open?: boolean;
    /** 持ち主が参照する注記（番号の順）。`html` は描いた HTML なのでエスケープしない */
    annotations?: DiagramAnnotation[] | undefined;
};
/** 図のツールチップに出す注記 1 つ */
export type DiagramAnnotation = {
    number: number;
    html: string;
};
/** 図の要素の ID ごとの注記と、持ち主の `id` の頭（`renderFlow` の引数） */
export type DiagramAnnotations = {
    items: Record<string, DiagramAnnotation[]>;
    ownerPrefix: string;
};
/** 説明と注記の有無から、マーカーのボタンのスクリーンリーダー向けの名前を返却する */
export declare function infoLabel(options: {
    name: string;
    described: boolean;
    annotated: boolean;
}): string;
/** 注記を持つ要素の持ち主の `id` 属性（注記を持たなければ空） */
export declare function ownerIdAttribute(annotations: DiagramAnnotations | undefined, elementId: string): string;
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
export declare function renderText(text: string, context: {
    tips: TipList;
    lookup: TermLookup | undefined;
    found: {
        terms: boolean;
    };
}): string;
/** 説明を持つグループのタイトルの右のマーカー（説明が無ければ空） */
export declare function groupInfo(options: {
    hint: string | undefined;
    label: string;
    owner: string;
    tips: TipList;
    /** グループの注記 */
    annotations?: DiagramAnnotation[] | undefined;
    /** 注記を持つときの持ち主の `id` */
    ownerId?: string | undefined;
}): string;
/** map の構成図のノードと線を描く */
export declare function renderFlow(definition: MdmarkFlowDefinition, id: string, options: {
    hints: boolean;
    lookup?: TermLookup;
    annotations?: DiagramAnnotations;
}): DiagramPart;
/** 図の定義 */
type LegendDefinition = MdmarkChartDefinition;
/** 凡例の項目: グラフは系列（円とドーナツは項目）を並べる */
export declare function legendFor(definition: LegendDefinition): DiagramLegendItem[];
/** 凡例の項目の並び（`ul` の中身）。`id` はグラフの塗りの模様の見本が指す `id` の頭 */
export declare function renderLegendItems(id: string, items: DiagramLegendItem[]): string;
/** 図の枠を描く: タイトル・ボタンの帯・表示する枠・ツールチップの中身・凡例を並べる */
export declare function renderDiagramFrame(frame: DiagramFrame, body: DiagramBody): string;
/** 図の種類 */
export type DiagramKind = Exclude<DiagramFrame["kind"], "mermaid" | "map">;
/** 図を描く: グラフの中身を描き、凡例を決めて枠に差す */
export declare function renderDiagram(options: {
    kind: DiagramKind;
    definition: LegendDefinition;
    /** ツールチップと矢じりの `id` の頭 */
    id: string;
    /** 機能 `diagram-resize` がオンか（既定 `true`） */
    resizable?: boolean;
    zoom?: number;
    fit?: number;
    modal?: boolean;
    /** 指で図を動かす操作中か（ストーリーの状態だけが指定する） */
    touchActive?: boolean;
}): string;
export {};
