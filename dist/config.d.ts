import type { MapKind, MapLine, ResolvedMapConfig } from "./map/spec.ts";
/** 利用側が `opts.config` に指定する設定。他のキーを持っていても読み込まない */
export type MdmarkConfig = {
    /** 機能のオン・オフの既定 */
    features?: Record<string, boolean>;
    /** マーカーの名前からモジュールの URL を参照する対応表 */
    libraries?: Record<string, string>;
    /** ツールチップの設定。`placement` は本文の用語などのツールチップ、`diagramPlacement` は図・ヒント・グラフの項目のツールチップを、持ち主の上と下のどちらに先に出すか（`top` / `bottom`）。知らない値も受けて `resolveConfig` が既定にするため、型は `string` */
    tooltips?: {
        placement?: string;
        diagramPlacement?: string;
    };
    /** 色分けのライブラリの設定。`url` は highlight.js の `es/` フォルダの URL（末尾 `/`） */
    syntax?: {
        url?: string;
    };
    /** 文書が指すファイルの探し方（CLI と VS Code 拡張機能だけが読み込む） */
    assets?: {
        root?: string;
    };
    /** 右側の目次の設定。`mode` は出し方（`hover` / `fixed`）。知らない値も受けて `resolveConfig` が `hover` にするため、型は `string` */
    "side-toc"?: {
        mode?: string;
    };
    /** 表の設定。`pin` はピン止めの動き（`each` / `through`）。知らない値も受けて `resolveConfig` が `each` にするため、型は `string` */
    table?: {
        pin?: string;
        long_column_min?: unknown;
    };
    /** 配色のテーマの名前（`COLOR_THEMES` のどれか）。知らない値も受けて `resolveConfig` が `DEFAULT_COLOR_THEME` にするため、型は `string` */
    colorTheme?: string;
    /** 配色の明暗（`COLOR_SCHEMES` のどれか）。知らない値も受けて `resolveConfig` が `DEFAULT_COLOR_SCHEME` にするため、型は `string` */
    colorScheme?: string;
    /** 部品の文言の設定。`paramCopy` は操作できる部品の今の値をコピーするボタンの文言。空文字も受けて `resolveConfig` が `DEFAULT_LABELS.paramCopy` にする */
    labels?: {
        paramCopy?: string;
    };
    /** 範囲のスクリプトの設定。`url` は範囲の `ts`・`js` を変換する @babel/standalone の ES モジュールの URL */
    "html-scripts"?: {
        url?: string;
    };
    /** mermaid の設定。`url` は mermaid の ES モジュールの URL、`theme` はテーマの名前（知らない値も受けて `resolveConfig` が `mdmark` にするため、型は `string`）、`themeVariables` はテーマの変数の上書き */
    mermaid?: {
        url?: string;
        theme?: string;
        themeVariables?: Record<string, unknown>;
    };
    /** map の図の設定。`node_fit` は名前の長いノードの広げ方、`url_state` は状態をクエリ文字列に保つか、`kinds` はクラス名ごとのノードの種類、`lines` は矢印と名前ごとの線の種類。知らない値も受けて `resolveConfig` が既定にする */
    map?: {
        node_fit?: string;
        url_state?: unknown;
        kinds?: Record<string, MapKind>;
        lines?: Record<string, MapLine>;
    };
};
/** mermaid の図のテーマの名前。`mdmark` は描く先の要素の CSS 変数から作る mdmark の外観のテーマ、ほかは mermaid のテーマの名前 */
export type MermaidTheme = "mdmark" | "default" | "neutral" | "dark" | "forest" | "base";
/** ツールチップを持ち主の上と下のどちらに先に出すか。`top` は上に出し、上に収まらないときだけ下に出す。`bottom` は下に出し、下に収まらず上に収まるときだけ上に出す */
export type TooltipPlacement = "top" | "bottom";
/** 右側の目次の出し方。`hover` は右端の線を出し、指すかフォーカスで目次を重ねて出す。`fixed` は目次を出すボタンでサイドバーを開閉する */
export type SideTocMode = "hover" | "fixed";
/** 表のピン止めの動き。`each` は押した列だけを留め、留めた列より左を表示している間は右端に、過ぎた後は左端に留める。`through` は押した列までを左端に留める */
export type TablePinMode = "each" | "through";
/** mdmark に入れた配色のテーマの名前 */
export type ColorTheme = "dev-swiss" | "theme-paper" | "theme-slate" | "theme-contrast";
/** 描いた文書の配色の明暗。`light`・`dark` は描く先の要素の class で祖先の class と OS の設定に勝たせ、`auto` は class を付けずに任せる */
export type ColorScheme = "light" | "dark" | "auto";
/** 文書の page のマーカーから読み込んだ、設定より優先する値。記載しなかったキーは持たない */
export type PageSettings = {
    /** `scheme=` の値 */
    scheme?: ColorScheme;
    /** `theme=` の値 */
    theme?: ColorTheme;
    /** `toc=` の値 */
    toc?: SideTocMode;
};
/** 対応表の行: マーカー 1 つのモジュールの URL と、図のマーカーか */
export type LibraryEntry = {
    /** モジュールの URL */
    url: string;
    /** 図のマーカーか。通知ブロックのタイトルを分ける */
    figure: boolean;
};
/** 全てのキーに値を持つ、内部で使用する設定 */
export type ResolvedConfig = {
    /** 機能のオン・オフ（キーはこのバージョンが知っている機能だけ） */
    features: Record<string, boolean>;
    /** 既定の対応表に設定の `libraries` を重ねたもの */
    libraries: Record<string, LibraryEntry>;
    /** `placement` は設定の `tooltips.placement` が `bottom` のときだけ `bottom`、それ以外は `top`。`diagramPlacement` は設定の `tooltips.diagramPlacement` が `top` のときだけ `top`、それ以外は `bottom` */
    tooltips: {
        placement: TooltipPlacement;
        diagramPlacement: TooltipPlacement;
    };
    /** 設定の `syntax.url` が文字列ならその値、それ以外は `DEFAULT_SYNTAX_URL` */
    syntax: {
        url: string;
    };
    /** 設定の `side-toc.mode` が `fixed` のときだけ `fixed`、それ以外は `hover` */
    sideToc: {
        mode: SideTocMode;
    };
    /** `pin` は設定の `table.pin` が `through` のときだけ `through`、それ以外は `each`。`longColumnMin` は設定の `table.long_column_min` が 0 より大きい有限の数ならその値、それ以外は `DEFAULT_LONG_COLUMN_MIN_EM` */
    table: {
        pin: TablePinMode;
        longColumnMin: number;
    };
    /** 設定の `colorTheme` が `COLOR_THEMES` にあればその値、それ以外は `DEFAULT_COLOR_THEME` */
    colorTheme: ColorTheme;
    /** 設定の `colorScheme` が `COLOR_SCHEMES` にあればその値、それ以外は `DEFAULT_COLOR_SCHEME` */
    colorScheme: ColorScheme;
    /** 設定の `labels.paramCopy` が空でない文字列ならその値、それ以外は `DEFAULT_LABELS.paramCopy` */
    labels: {
        paramCopy: string;
    };
    /** 範囲のスクリプトの変換のライブラリの URL（既定 `DEFAULT_HTML_SCRIPTS_URL`） */
    htmlScripts: {
        url: string;
    };
    /** mermaid の読み込み先・テーマ・値が文字列のテーマの変数の上書き */
    mermaid: {
        url: string;
        theme: MermaidTheme;
        themeVariables: Record<string, string>;
    };
    /** `resolveMapConfig` で既定を当てた設定の `map` */
    map: ResolvedMapConfig;
};
/** mdmark に入れた配色のテーマの名前の並び。`resolveConfig`・CLI の点検と書き出しの警告が照らす */
export declare const COLOR_THEMES: readonly ColorTheme[];
/** 設定に `colorTheme` が無いか知らない名前のときのテーマ。配色の値は `src/index.css` の `:root` の既定のまま */
export declare const DEFAULT_COLOR_THEME: ColorTheme;
/** 配色の明暗の値の並び。`resolveConfig`・page のマーカーの読み取り・CLI の点検が照らす */
export declare const COLOR_SCHEMES: readonly ColorScheme[];
/** 設定に `colorScheme` が無いか知らない値のときの明暗 */
export declare const DEFAULT_COLOR_SCHEME: ColorScheme;
/** 設定の `labels.paramCopy` が空でない文字列でないときの部品の文言 */
export declare const DEFAULT_LABELS: {
    paramCopy: string;
};
/** このバージョンが知っている機能とその既定 */
export declare const DEFAULT_FEATURES: Record<string, boolean>;
/** 設定の `syntax.url` が無いときに読み込む highlight.js の `es/` フォルダの URL。バージョンを固定する */
export declare const DEFAULT_SYNTAX_URL = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";
/** 設定の `html-scripts.url` が無いときに読み込む @babel/standalone の ES モジュールの URL。バージョンを固定する */
export declare const DEFAULT_HTML_SCRIPTS_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@8.1.1/+esm";
/** 設定の `mermaid.url` が無いときに読み込む mermaid の ES モジュールの URL。バージョンを固定する */
export declare const DEFAULT_MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";
/** `MermaidTheme` の値の並び。`resolveConfig` が照らす */
export declare const MERMAID_THEMES: readonly MermaidTheme[];
/** マーカーの名前から `LibraryEntry` を参照する既定の対応表 */
export declare const DEFAULT_LIBRARIES: Record<string, LibraryEntry>;
/** マーカーの名前と設定の `libraries` のキーが合うべき書式 */
export declare const MARK_NAME_PATTERN: RegExp;
/** 利用側の設定に既定を当て、型の合わない値を落とした設定を返却する */
export declare function resolveConfig(options: {
    /** 利用側の設定 */
    config?: MdmarkConfig;
    /** 既定の対応表（単体テストで差し替える） */
    defaultLibraries?: Record<string, LibraryEntry>;
}): ResolvedConfig;
/** map の図の、ノードの形状に記載できる値 */
export declare const MAP_SHAPES: readonly ["rounded", "rect", "pill", "double"];
/** map の図の、線の模様に記載できる値 */
export declare const MAP_DASHES: readonly ["solid", "dashed", "dotted", "dash-dot", "long-dash"];
/** map の図の、線の太さに記載できる値 */
export declare const MAP_WIDTHS: readonly ["thin", "normal", "thick"];
/** map の図の、線の矢じりに記載できる値 */
export declare const MAP_HEADS: readonly ["filled", "open", "none"];
/** 設定の map に既定を当て、知らない値を既定にする（キーごとの値のうち合わないものは捨てる） */
export declare const resolveMapConfig: (value: unknown) => ResolvedMapConfig;
/** 既定を適用した設定に、文書の page のマーカーの値を重ねた設定を返却する（指定された設定は書き換えない） */
export declare const applyPageSettings: (options: {
    /** 既定を適用した設定 */
    config: ResolvedConfig;
    /** `renderDocument` が返却したページの設定 */
    page: PageSettings;
}) => ResolvedConfig;
