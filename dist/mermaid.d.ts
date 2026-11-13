import type { ResolvedConfig, TooltipPlacement } from "./config.ts";
import type { SyntaxImport } from "./highlight.ts";
/** `import()` で読み込んだ mermaid の ES モジュールが既定のエクスポートで持つ構造 */
export type MermaidModule = {
    /** ページの中で 1 つの mermaid の設定を置き換える */
    initialize: (config: Record<string, unknown>) => void;
    /** ソースを SVG の文字列にする。解釈できないソースは例外で拒否する */
    render: (id: string, source: string) => Promise<{
        svg: string;
    }>;
};
/** ガントチャートを描く幅の下限（px）。目盛りの日付が重ならない幅 */
export declare const MERMAID_GANTT_MIN_WIDTH = 720;
/** mermaid の図を開いたときの倍率の下限。これより縮めると小さい文字が読み込めないため、収まらない分は枠の中で動かす */
export declare const MERMAID_MIN_FIT = 0.75;
/** `setEmbeddedMermaid` が入れる、同じスクリプトにまとめた mermaid のモジュール。`undefined` なら `mermaid.url` から読み込む。ページの中の全ての `mount` に有効になる */
export declare let embeddedMermaid: {
    default?: unknown;
} | undefined;
/** 埋めた mermaid のモジュールを置き換える。`undefined` で `mermaid.url` から読み込む構造に戻す */
export declare const setEmbeddedMermaid: (module: {
    default?: unknown;
} | undefined) => void;
/** `scope` の中に試しの要素を配置して CSS 変数の計算済みの色を読み込み、sRGB の hex にする。`rgb()`・`rgba()` は値を読み込み、ほかの記載方法は canvas で変換する */
export declare const cssColorToHex: (options: {
    scope: HTMLElement;
    name: string;
}) => string;
/** テーマ `mdmark` なら描く先の CSS 変数から mermaid の `base` テーマの変数を作り、設定の `themeVariables` と固定の変数を重ねる */
export declare const mermaidThemeVariables: (options: {
    scope: HTMLElement;
    config: ResolvedConfig["mermaid"];
}) => Record<string, string | boolean>;
/** SVG の `g.actor-man` の棒人間を、子の属性から求めたノードの中央の lucide の `user` のアイコンに替える */
export declare const replaceMermaidActors: (svg: SVGSVGElement) => void;
/** 1 つのソースを、今の配色と（暗い配色なら）明るい配色のテーマで描き、図の枠の HTML を返却する。解釈できなければ例外のメッセージの 1 行目を返却する */
export declare const drawMermaidDiagram: (options: {
    mermaid: MermaidModule;
    source: string;
    root: HTMLElement;
    scope: HTMLElement;
    config: ResolvedConfig["mermaid"];
    id: string;
    frameId: string;
    /** 表示する枠の右下にリサイズハンドルを配置するか（既定 `true`） */
    resizable?: boolean;
}) => Promise<{
    html: string;
} | {
    error: string;
}>;
/** `root` の中の mermaid のコードブロックを読み込み中のブロックに替えて mermaid を読み込み、図の枠に置き換えて図の操作を付ける。配色の明暗が変わったら再描画する */
export declare const attachMermaid: (options: {
    root: HTMLElement;
    scope: HTMLElement;
    config: ResolvedConfig;
    mountId: number;
    isCurrent: () => boolean;
    modules: Map<string, Promise<{
        default?: unknown;
    }>>;
    placement: TooltipPlacement;
    importModule?: SyntaxImport;
}) => {
    ready: Promise<void>;
    detach: () => void;
};
