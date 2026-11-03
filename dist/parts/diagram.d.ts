import type { MdmarkChartDefinition, MdmarkDiagramIo, MdmarkDiagramLine, MdmarkFlowDefinition, MdmarkSequenceDefinition } from "../diagram/definition.ts";
/** 線の種類ごとの破線・太さ・矢じり・凡例の名前。色は CSS の変数で当てる */
export declare const LINE_STYLES: Readonly<Record<MdmarkDiagramLine, {
    dash: string;
    width: number;
    head: "filled" | "open";
    label: string;
}>>;
/** 凡例の項目 */
export type DiagramLegendItem = {
    /** 見本の種類: 箱の種類・線の種類・`series-{n}`・`frame`・`lane`・`jump`・`info`・`underline` */
    sample: string;
    /** 意味 */
    label: string;
};
/** 図の枠の引数 */
export type DiagramFrame = {
    /** 中の図の種類 */
    kind: "flow" | "sequence" | "chart";
    /** 題名 */
    title: string;
    /** 範囲 */
    scope: string;
    /** 更新日 */
    updated: string;
    /** 凡例の項目 */
    legend: DiagramLegendItem[];
    /** 今の倍率 */
    zoom?: number;
    /** 全画面のモーダルの中に描くか */
    modal?: boolean;
    /** ツールチップと矢じりの `id` の頭 */
    id: string;
};
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
/** `renderFlow`・`renderSequence`・`renderChart` の戻り値: 図の中身と、凡例に載せる図の特徴 */
export type DiagramPart = DiagramBody & {
    /** 横の線が縦の線を飛び越える点があるか */
    jumps: boolean;
    /** 用語の下線を引いた箱の文字があるか */
    terms: boolean;
};
/** 用語から意味を引く関数。意味が無い用語は `undefined` */
export type TermLookup = (word: string) => string | undefined;
/** ツールチップの引数 */
export type DiagramTip = {
    /** ツールチップの `id` */
    id: string;
    /** 線の詳細か、箱の入力・処理・出力か、文だけか（箱の `hint`・埋め込んだ HTML の `data-hint`） */
    kind: "wire" | "io" | "hint";
    /** 持ち主の名前。ツールチップの題に出す */
    label: string;
    /** 線の詳細 */
    tip?: string;
    /** 箱の入力・処理・出力 */
    io?: MdmarkDiagramIo;
    /** 箱の `hint` か `data-hint` の文。`io` と一緒に持つときは入力・処理・出力の後に出す */
    hint?: string;
    /** 持ち主を引く名前（線の `id`・`node:{箱の id}`・`term:{語}`）。省くと題 */
    owner?: string;
    /** 開いているか */
    open?: boolean;
};
/** 図のツールチップを描く。文だけの `hint` は、行内の要素の後ろにも置けるよう `span` で出す */
export declare function renderDiagramTip(tip: DiagramTip): string;
/** フロー図を描く */
export declare function renderFlow(definition: MdmarkFlowDefinition, id: string, hints: boolean, lookup?: TermLookup): DiagramPart;
/** シーケンス図を描く */
export declare function renderSequence(definition: MdmarkSequenceDefinition, id: string, lookup?: TermLookup, hints?: boolean): DiagramPart;
/** グラフを種類（折れ線・棒・円・散布図）ごとに描く。定義は `readDefinition` が形を確かめたもの。`id` は塗りの模様の `pattern` の `id` の頭 */
export declare function renderChart(definition: MdmarkChartDefinition, id: string): DiagramPart;
/** 図の定義 */
type LegendDefinition = MdmarkFlowDefinition | MdmarkSequenceDefinition | MdmarkChartDefinition;
/** 凡例の項目: 定義に出る箱の種類・線の種類・系列だけを並べ、図にあるときだけ枠・層・交差・印・下線を加える。`hints` がオフ（既定はオン）なら、ヒントの印と線の詳細の下線は図にない */
export declare function legendFor(definition: LegendDefinition, drawn: {
    jumps: boolean;
    terms: boolean;
    hints?: boolean;
}): DiagramLegendItem[];
/** 凡例の項目の並び（`ul` の中身）。`id` は線の見本が指す矢じりの `id` の頭 */
export declare function renderLegendItems(id: string, items: DiagramLegendItem[]): string;
/** 図の枠を描く: 題・ボタンの帯・表示する枠・ツールチップの中身・凡例を並べる */
export declare function renderDiagramFrame(frame: DiagramFrame, body: DiagramBody): string;
/** 図の種類 */
export type DiagramKind = DiagramFrame["kind"];
/** 図を描く: 種類ごとの中身を描き、凡例を決めて枠に差す。`hints` がオフ（既定はオン）なら、線の詳細・箱の説明と入力・処理・出力のツールチップと印を置かない */
export declare function renderDiagram(options: {
    kind: DiagramKind;
    definition: LegendDefinition;
    /** ツールチップと矢じりの `id` の頭 */
    id: string;
    /** 用語から意味を引く関数 */
    lookup?: TermLookup;
    /** 機能 `hints` がオンか（既定 `true`） */
    hints?: boolean;
    zoom?: number;
    modal?: boolean;
}): string;
export {};
