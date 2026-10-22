/** 箱の種類 */
export type MdmarkDiagramKind = "llm" | "dm" | "script" | "mcp" | "data" | "external";
/** 線の種類 */
export type MdmarkDiagramLine = "flow" | "read" | "write" | "reply" | "loop";
/** 箱の入力・処理・出力 */
export type MdmarkDiagramIo = {
    /** 入力 */
    in: string;
    /** 処理 */
    do: string;
    /** 出力 */
    out: string;
};
/** フロー図の箱 */
export type MdmarkDiagramNode = {
    /** 線が端に指す id */
    id: string;
    /** 箱の種類 */
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
    /** 入力・処理・出力。持つ箱に印を付ける */
    io?: MdmarkDiagramIo;
    /** 箱の右上の印に出す文。`io` と一緒に持つと、入力・処理・出力の後に出す */
    hint?: string;
};
/** フロー図の線 */
export type MdmarkDiagramWire = {
    /** 線の id */
    id: string;
    /** 元の箱の id */
    from: string;
    /** 先の箱の id */
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
    /** システムの枠 */
    frame?: {
        title: string;
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** 枠の中の層。層の箱の色をうっすら敷く */
    lanes?: Array<{
        label: string;
        kind: "llm" | "mcp" | "data";
        y: number;
        h: number;
    }>;
    /** 箱 */
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
export type MdmarkChartType = "line" | "bar" | "pie" | "scatter";
/** 縦の軸。`min`・`max`・`step` は 3 つとも書くか 3 つとも省き、省くとデータから切る */
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
    /** 横の軸。`line`・`bar` は `ticks` が必須、`scatter` は数値の軸で `ticks` を持たない。`pie` は持たない */
    x?: {
        label: string;
        ticks?: string[];
    };
    /** 縦の軸。`pie` は持たない */
    y?: MdmarkChartYAxis;
    /** 系列。`pie` 以外で 1〜4 つ。`line`・`bar` の `points` の数は `x.ticks` と同じ、`scatter` は `[x, y]` の組 */
    series?: Array<{
        name: string;
        points: number[] | Array<[number, number]>;
    }>;
    /** `pie` の項目。1〜4 つで、`value` は 0 より大きい */
    items?: Array<{
        name: string;
        value: number;
    }>;
    /** `pie` の凡例の値に付ける単位 */
    unit?: string;
};
/** 操作できる部品の定義 */
export type MdmarkParamDefinition = {
    /** 部品の題 */
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
    /** グラフの題と軸（折れ線） */
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
/** 読めた定義の種類 */
export type MdmarkDefinition = MdmarkFlowDefinition | MdmarkSequenceDefinition | MdmarkChartDefinition | MdmarkParamDefinition;
/** 定義を読んだ結果 */
export type DefinitionResult = {
    /** 読めたか */
    ok: boolean;
    /** 読めた定義 */
    definition?: MdmarkDefinition | undefined;
    /** 読めない箇所と直し方の文。読めたときは空 */
    problems: string[];
};
/** 図の部品の印の名前 */
export type DiagramDirective = "flow" | "sequence" | "chart" | "param";
/** 図の部品の印の名前と、書き方の警告に出す図の種類の名前・呼び名 */
export declare const DIAGRAM_DIRECTIVES: Readonly<Record<DiagramDirective, {
    name: string;
    call: string;
}>>;
/** 定義の JSON を読む。読めないときは、読めた最後の行・その行の文字・足りない記号を返す */
export declare function parseDefinitionJson(text: string): {
    ok: true;
    value: unknown;
} | {
    ok: false;
    line: number;
    after: string;
    missing: string;
};
/** 印の範囲の `json` のコードブロックを読み、種類ごとの形を確かめる。読めない箇所は書き方の警告の文にして返す */
export declare function readDefinition(directive: DiagramDirective, blocks: string[]): DefinitionResult;
/** 読めない定義の書き方の警告の本文と項目。読めない箇所が 2 つ以上あるときは、1 つ目を本文に書き、残りを項目に並べる */
export declare function definitionWarning(directive: DiagramDirective, problems: string[]): {
    message: string;
    items: Array<{
        label: string;
        message: string;
    }>;
};
