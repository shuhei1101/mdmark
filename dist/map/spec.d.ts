/** map の書き方の誤りの項目の種類（点検のずれの種類と同じ名前） */
export type MapProblemKind = "map_invalid" | "map_unknown_ref" | "map_unknown_key" | "map_invalid_value" | "map_unknown_icon" | "map_unknown_class" | "map_unknown_line";
/** 読み取りと点検が返す、書き方の誤り 1 件 */
export type MapProblem = {
    kind: MapProblemKind;
    /** 範囲の中の行（読み取ったソースの 0 から）。範囲の全体を指すときは無い */
    line?: number | undefined;
    /** 書き方の警告と点検の内容に出す 1 文（直し方を含む） */
    message: string;
};
/** ノードの形状 */
export type MapShape = "rounded" | "rect" | "pill" | "double";
/** 設定の map.kinds の 1 つの値 */
export type MapKind = {
    label?: string | undefined;
    icon?: string | undefined;
    shape?: MapShape | undefined;
    color?: string | undefined;
};
/** 設定の map.lines の 1 つの値 */
export type MapLine = {
    dash?: "solid" | "dashed" | "dotted" | "dash-dot" | "long-dash" | undefined;
    width?: "thin" | "normal" | "thick" | undefined;
    head?: "filled" | "open" | "none" | undefined;
    color?: string | undefined;
};
/** 既定を当てた設定の map */
export type ResolvedMapConfig = {
    node_fit: "height" | "width";
    url_state: boolean;
    kinds: Record<string, MapKind>;
    lines: Record<string, MapLine>;
};
/** マーカーの引数（A-128 の構成の JSON のオブジェクト） */
export type MapArgs = {
    title?: string | undefined;
    focus?: string | undefined;
    play?: "autoplay" | undefined;
    interval: number;
    collapse?: {
        open: boolean;
        title: string | undefined;
    } | undefined;
};
/** マーカーの JSON のオブジェクトで読むキー */
export declare const MAP_ARG_KEYS: readonly ["title", "focus", "play", "interval", "collapse"];
/** マーカーに interval が無いか型が合わないときの、自動で進める間隔（秒） */
export declare const DEFAULT_MAP_INTERVAL = 2;
/** マーカーの引数の文字を JSON のオブジェクトとして読み、知っているキーだけを MapArgs にする */
export declare const parseMapArgs: (source: string) => {
    args: MapArgs;
    normalized: string;
    problems: MapProblem[];
    unknownKeys: string[];
};
