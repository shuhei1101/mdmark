import type { MdmarkChartDefinition, MdmarkDiagramIo, MdmarkDiagramLine, MdmarkErDefinition, MdmarkErTable, MdmarkFlowDefinition, MdmarkSequenceDefinition } from "../diagram/definition.ts";
/** 線の種類ごとの破線・太さ・矢じり・凡例の名前。色は CSS の変数で当てる */
export declare const LINE_STYLES: Readonly<Record<MdmarkDiagramLine, {
    dash: string;
    width: number;
    head: "filled" | "open";
    label: string;
}>>;
/** 凡例の項目 */
export type DiagramLegendItem = {
    /** 見本の種類: ノードの種類・線の種類・`series-{n}`・`frame`・`lane`・`jump`・`info`・`underline` */
    sample: string;
    /** 意味 */
    label: string;
};
/** 図の枠の引数 */
export type DiagramFrame = {
    /** 中の図の種類 */
    kind: "flow" | "sequence" | "chart" | "er" | "mermaid";
    /** 題名 */
    title: string;
    /** 範囲（種類 `mermaid` では持たず、題に出さない） */
    scope?: string;
    /** 更新日（種類 `mermaid` では持たず、題に出さない） */
    updated?: string;
    /** 凡例の項目 */
    legend: DiagramLegendItem[];
    /** 今の倍率（定義の大きさを 1 とする） */
    zoom?: number;
    /** 全体が収まる倍率（倍率のボタンはこれを 100% として出す。省くと 1） */
    fit?: number;
    /** 全画面のモーダルの中に描くか */
    modal?: boolean;
    /** 表示する枠の右下にリサイズハンドルを置くか（既定 `true`。モーダルの中には置かない） */
    resizable?: boolean;
    /** 拡大して動かしたときにグループのタイトルを上端に留めるか（既定 `true`） */
    stickyTitles?: boolean;
    /** 開いたときの倍率の下限（`figure` の `data-fit-min` に入れる） */
    fitMin?: number;
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
    /** 用語の下線を引いたノードの文字があるか */
    terms: boolean;
};
/** 用語から意味を引く関数。意味が無い用語は `undefined` */
export type TermLookup = (word: string) => string | undefined;
/** ツールチップの引数 */
export type DiagramTip = {
    /** ツールチップの `id` */
    id: string;
    /** 線の詳細か、ノードの入力・処理・出力か、文だけか（ノードの `hint`・埋め込んだ HTML の `data-hint`） */
    kind: "wire" | "io" | "hint" | "table" | "item";
    /** 持ち主の名前。ツールチップの題に出す */
    label: string;
    /** グラフの項目の値の文（`item` のとき） */
    value?: string;
    /** 線の詳細 */
    tip?: string;
    /** ノードの入力・処理・出力 */
    io?: MdmarkDiagramIo;
    /** ノードの `hint` か `data-hint` の文。`io` と一緒に持つときは入力・処理・出力の後に出す */
    hint?: string;
    /** ER 図のテーブル。題を `{論理名}（{物理名}）` にし、概要と、`desc` を持つ列の名前と説明を並べる */
    table?: MdmarkErTable;
    /** 持ち主を引く名前（線の `id`・`node:{ノードの id}`・`term:{語}`）。省くと題 */
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
/** ER 図を描く: テーブルを置き、関係の線と両端の多重度の記号を svg に描き、ラベルを縦の線の中ほどに置く */
export declare function renderEr(definition: MdmarkErDefinition, id: string, hints: boolean, lookup?: TermLookup): DiagramPart;
/** 図の定義 */
type LegendDefinition = MdmarkFlowDefinition | MdmarkSequenceDefinition | MdmarkChartDefinition | MdmarkErDefinition;
/** 凡例の項目: フロー図とシーケンス図は、図に 2 種類以上あるノード（相手）の種類と線の種類だけを並べ、枠・層・交差・印・下線は載せない。グラフは系列（円とドーナツは項目）、ER 図はテーブルの種類・列のマーカー・多重度を並べる */
export declare function legendFor(definition: LegendDefinition): DiagramLegendItem[];
/** 凡例の項目の並び（`ul` の中身）。`id` は線の見本が指す矢じりの `id` の頭 */
export declare function renderLegendItems(id: string, items: DiagramLegendItem[]): string;
/** 図の枠を描く: 題・ボタンの帯・表示する枠・ツールチップの中身・凡例を並べる */
export declare function renderDiagramFrame(frame: DiagramFrame, body: DiagramBody): string;
/** 図の種類 */
export type DiagramKind = Exclude<DiagramFrame["kind"], "mermaid">;
/** 図を描く: 種類ごとの中身を描き、凡例を決めて枠に差す。`hints` がオフ（既定はオン）なら、線の詳細・ノードの説明と入力・処理・出力のツールチップと印を置かない */
export declare function renderDiagram(options: {
    kind: DiagramKind;
    definition: LegendDefinition;
    /** ツールチップと矢じりの `id` の頭 */
    id: string;
    /** 用語から意味を引く関数 */
    lookup?: TermLookup;
    /** 機能 `hints` がオンか（既定 `true`） */
    hints?: boolean;
    /** 機能 `diagram-resize` がオンか（既定 `true`） */
    resizable?: boolean;
    zoom?: number;
    fit?: number;
    modal?: boolean;
}): string;
export {};
