import { type ColorName } from "../parts/colors.ts";
/** ノードの種類（`start`・`question`・`action`・`result` は判定フローチャートの開始・質問・アクション・結果） */
export type MdmarkDiagramKind = "llm" | "dm" | "script" | "mcp" | "data" | "external" | "start" | "question" | "action" | "result";
/** 線の種類 */
export type MdmarkDiagramLine = "flow" | "read" | "write" | "reply" | "loop";
/** ノードの入力・処理・出力 */
export type MdmarkDiagramIo = {
    /** 入力 */
    in: string;
    /** 処理 */
    do: string;
    /** 出力 */
    out: string;
};
/** フロー図のノード */
export type MdmarkDiagramNode = {
    /** 線が端に指す id */
    id: string;
    /** ノードの種類 */
    kind: MdmarkDiagramKind;
    /** 左上の x（px） */
    x: number;
    /** 左上の y（px） */
    y: number;
    /** 幅（px） */
    w: number;
    /** 高さ（px） */
    h: number;
    /** 名前 */
    name: string;
    /** 種類の行に出す名前。省くと種類の既定の名前 */
    tag?: string;
    /** 補足 */
    sub?: string;
    /** 入力・処理・出力。持つノードにマーカーを付ける */
    io?: MdmarkDiagramIo;
    /** ノードの右上のマーカーに出す文。`io` と一緒に持つと、入力・処理・出力の後に出す */
    hint?: string;
    /** リンク先。`http`・`https`・`mailto` の URL か相対パス */
    href?: string;
    /** map の構成図が指定する、設定の map.kinds の種類（`kind` の既定の名前・アイコン・構造の代わりに使う） */
    style?: MdmarkNodeStyle;
};
/** map の構成図のノードの種類（種類の行の名前・Lucide のアイコンの名前・構造・色の名前） */
export type MdmarkNodeStyle = {
    label?: string | undefined;
    icon?: string | undefined;
    shape?: "rounded" | "rect" | "pill" | "double" | undefined;
    color?: string | undefined;
};
/** map の構成図の線の種類（模様・太さ・矢じり・色の名前） */
export type MdmarkWireStyle = {
    dash?: "solid" | "dashed" | "dotted" | "dash-dot" | "long-dash" | undefined;
    width?: "thin" | "normal" | "thick" | undefined;
    head?: "filled" | "open" | "none" | undefined;
    color?: string | undefined;
    /** 両端に矢じりを付けるか（`<-->`） */
    both?: boolean | undefined;
};
/** フロー図の線 */
export type MdmarkDiagramWire = {
    /** 線の id */
    id: string;
    /** 元のノードの id */
    from: string;
    /** 先のノードの id */
    to: string;
    /** 線の種類 */
    line: MdmarkDiagramLine;
    /** 縦横だけの折れ線の点 */
    points: Array<[number, number]>;
    /** 線のラベル */
    label?: string;
    /** ラベルの中心 */
    labelAt?: [number, number];
    /** ラベルの詳細。持つラベルにツールチップを付ける */
    tip?: string;
    /** map の構成図が指定する、設定の map.lines の線の種類（`line` の見た目の代わりに使う） */
    style?: MdmarkWireStyle;
};
/** フロー図の定義 */
export type MdmarkFlowDefinition = {
    /** 題名 */
    title: string;
    /** 範囲 */
    scope: string;
    /** 更新日（`YYYY-MM-DD`） */
    updated: string;
    /** 図の幅（px） */
    width: number;
    /** 図の高さ（px） */
    height: number;
    /** システムの枠。`hint` はタイトルの右のマーカーに出す文 */
    frame?: {
        title: string;
        x: number;
        y: number;
        w: number;
        h: number;
        hint?: string;
    };
    /** 枠の中の層。層のノードの色をうっすら敷く。`hint` はタイトルの右のマーカーに出す文 */
    lanes?: Array<{
        label: string;
        kind: "llm" | "mcp" | "data";
        y: number;
        h: number;
        hint?: string;
    }>;
    /** 拡大して動かしたときに、見えている枠と層のタイトルを表示する枠の上端に留めるか（省いたとき `true`） */
    stickyTitles?: boolean;
    /** ノード */
    nodes: MdmarkDiagramNode[];
    /** 線 */
    wires: MdmarkDiagramWire[];
};
/** シーケンス図の定義 */
export type MdmarkSequenceDefinition = {
    /** 題名 */
    title: string;
    /** 範囲 */
    scope: string;
    /** 更新日 */
    updated: string;
    /** 相手。左から右へ並べる順 */
    participants: Array<{
        id: string;
        kind: MdmarkDiagramNode["kind"];
        name: string;
        tag?: string;
    }>;
    /** メッセージ。時刻の順 */
    steps: Array<{
        from: string;
        to: string;
        label: string;
        reply?: boolean;
        tip?: string;
    }>;
    /** 最後のメッセージから最初へ戻る繰り返し */
    loop?: {
        label: string;
    };
};
/** グラフの種類 */
export type MdmarkChartType = "line" | "bar" | "pie" | "scatter" | "area" | "stacked-bar" | "stacked-area" | "horizontal-bar" | "donut" | "radar" | "bubble" | "combo";
/** グラフの系列 */
export type MdmarkChartSeries = {
    name: string;
    points: number[] | Array<[number, number]> | Array<[number, number, number]>;
    /** `combo` の系列の描き方。省くと `line` */
    as?: "line" | "bar";
    /** `combo` の系列が使用する縦の軸。省くと `y` */
    axis?: "y" | "y2";
};
/** 縦の軸。`min`・`max`・`step` は 3 つとも記載するか 3 つとも省き、省くとデータから切る */
export type MdmarkChartYAxis = {
    label: string;
    min?: number;
    max?: number;
    step?: number;
};
/** グラフの定義 */
export type MdmarkChartDefinition = {
    /** グラフの種類。省くと `line` */
    type?: MdmarkChartType;
    /** 題名 */
    title: string;
    /** 範囲 */
    scope: string;
    /** 更新日 */
    updated: string;
    /** 横の軸。`scatter`・`bubble` は数値の軸で `ticks` を持たず、`radar` は `ticks` を軸の名前にする。それ以外は `ticks` が必須（`horizontal-bar` は縦に並ぶ項目）。`pie`・`donut` は持たない */
    x?: {
        label: string;
        ticks?: string[];
    };
    /** 縦の軸。`pie`・`donut` は持たない */
    y?: MdmarkChartYAxis;
    /** `combo` の右の縦の軸 */
    y2?: MdmarkChartYAxis;
    /** `bubble` の円の面積が表す値の名前 */
    size?: {
        label: string;
    };
    /** 系列。`pie`・`donut` 以外で 1〜6 つ。`points` の数は `x.ticks` と同じ、`scatter` は `[x, y]`、`bubble` は `[x, y, size]` の組 */
    series?: MdmarkChartSeries[];
    /** `pie`・`donut` の項目。1〜6 つで、`value` は 0 より大きい */
    items?: Array<{
        name: string;
        value: number;
    }>;
    /** `pie`・`donut` の凡例の値と `donut` の中央の合計に付ける単位 */
    unit?: string;
};
/** 操作できる部品の定義 */
export type MdmarkParamDefinition = {
    /** 部品のタイトル */
    title: string;
    /** スライダー。`value` が既定の値 */
    knob: {
        key: string;
        label: string;
        min: number;
        max: number;
        step: number;
        value: number;
    };
    /** グラフのタイトルと軸（折れ線） */
    chart: {
        title: string;
        scope: string;
        updated: string;
        x: {
            label: string;
            ticks: string[];
        };
        y: {
            label: string;
            min: number;
            max: number;
            step: number;
        };
    };
    /** スライダーの値（文字にしたもの）ごとの点。`min` から `max` まで `step` ごとの全ての値を持つ */
    table: Record<string, number[]>;
};
/** ER 図のテーブルの種類 */
export type MdmarkErTableKind = "master" | "transaction";
/** ER 図の関係の端の多重度 */
export type MdmarkErCardinality = "1" | "0..1" | "1..n" | "0..n";
/** ER 図の列 */
export type MdmarkErColumn = {
    /** 列の名前 */
    name: string;
    /** 型 */
    type: string;
    /** 主キーか */
    pk?: boolean;
    /** 外部キーか */
    fk?: boolean;
    /** NOT NULL か */
    nn?: boolean;
    /** 説明。テーブルのツールチップに出す */
    desc?: string;
};
/** ER 図のテーブル */
export type MdmarkErTable = {
    /** 関係の `from`・`to` で指す名前 */
    id: string;
    /** 物理名 */
    name: string;
    /** 論理名 */
    label: string;
    /** 種類。見出しの札と既定の色を決める */
    kind?: MdmarkErTableKind;
    /** 色の名前。`kind` の既定の色より優先する */
    color?: ColorName;
    /** 概要。テーブルのツールチップに出す */
    desc?: string;
    /** 左端（px） */
    x: number;
    /** 上端（px） */
    y: number;
    /** 幅（px） */
    w: number;
    /** 主キーと外部キーの列だけを出した状態で開くか */
    folded?: boolean;
    /** 列。定義の順に並べる */
    columns: MdmarkErColumn[];
};
/** ER 図の関係 */
export type MdmarkErRelation = {
    /** 元のテーブルの `id` */
    from: string;
    /** 元のテーブルの列の `name` */
    fromColumn: string;
    /** 元の端の多重度 */
    fromCard: MdmarkErCardinality;
    /** 先のテーブルの `id` */
    to: string;
    /** 先のテーブルの列の `name` */
    toColumn: string;
    /** 先の端の多重度 */
    toCard: MdmarkErCardinality;
    /** 縦の線の中ほどに出すラベル */
    label?: string;
    /** 縦の線の x（px）。省くと両端の中間 */
    midX?: number;
};
/** ER 図の定義 */
export type MdmarkErDefinition = {
    /** 題名 */
    title: string;
    /** 範囲 */
    scope: string;
    /** 更新日 */
    updated: string;
    /** 図の幅（px）。高さはテーブルの位置と列の数から求める */
    width: number;
    /** テーブル */
    tables: MdmarkErTable[];
    /** 関係 */
    relations: MdmarkErRelation[];
};
/** 読み込めた定義の種類 */
export type MdmarkDefinition = MdmarkFlowDefinition | MdmarkSequenceDefinition | MdmarkChartDefinition | MdmarkParamDefinition | MdmarkErDefinition;
/** 定義を読み込んだ結果 */
export type DefinitionResult = {
    /** 読み込めたか */
    ok: boolean;
    /** 読み込めた定義 */
    definition?: MdmarkDefinition | undefined;
    /** 読み込めない箇所と修正方法の文。読み込めたときは空 */
    problems: string[];
};
/** 図の部品のマーカーの名前 */
export type DiagramDirective = "flow" | "sequence" | "chart" | "param" | "er";
/** 図の部品のマーカーの名前と、記載の警告に出す図の種類の名前・呼び名 */
export declare const DIAGRAM_DIRECTIVES: Readonly<Record<DiagramDirective, {
    name: string;
    call: string;
}>>;
/** 定義の JSON を読み込む。読み込めないときは、読み込めた最後の行・その行の文字・足りない記号を返却する */
export declare function parseDefinitionJson(text: string): {
    ok: true;
    value: unknown;
} | {
    ok: false;
    line: number;
    after: string;
    missing: string;
};
/** 座標を省けるノードの種類（判定フローチャート） */
export declare const JUDGEMENT_KINDS: readonly MdmarkDiagramKind[];
/** マーカーの範囲の `json` のコードブロックを読み込み、種類ごとの構造を確認する。読み込めない箇所は記載の警告の文にして返却する */
export declare function readDefinition(directive: DiagramDirective, blocks: string[]): DefinitionResult;
/** フロー図の定義の、本文のリンクと同じ許可に該当しないリンク先を持つノードを定義の順に返却する */
export declare function nodeLinkProblems(definition: MdmarkFlowDefinition): Array<{
    id: string;
    href: string;
}>;
/** 読み込めない定義の記載の警告の本文と項目。読み込めない箇所が 2 つ以上あるときは、1 つ目を本文に記載し、残りを項目に並べる */
export declare function definitionWarning(directive: DiagramDirective, problems: string[]): {
    message: string;
    items: Array<{
        label: string;
        message: string;
    }>;
};
