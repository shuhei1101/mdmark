/** 使う側が `opts.config` に渡す設定。他のキーを持っていても読まない */
export type MdmarkConfig = {
    /** 機能のオン・オフの既定 */
    features?: Record<string, boolean>;
    /** 印の名前からモジュールの URL を引く対応表 */
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
    /** 文書が指すファイルの探し方（CLI と VS Code 拡張機能だけが読む） */
    assets?: {
        root?: string;
    };
    /** 右側の目次の設定。`mode` は出し方（`hover` / `fixed`）。知らない値も受けて `resolveConfig` が `hover` にするため、型は `string` */
    "side-toc"?: {
        mode?: string;
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
};
/** mermaid の図のテーマの名前。`mdmark` は描く先の要素の CSS 変数から作る mdmark の見た目のテーマ、ほかは mermaid のテーマの名前 */
export type MermaidTheme = "mdmark" | "default" | "neutral" | "dark" | "forest" | "base";
/** ツールチップを持ち主の上と下のどちらに先に出すか。`top` は上に出し、上に収まらないときだけ下に出す。`bottom` は下に出し、下に収まらず上に収まるときだけ上に出す */
export type TooltipPlacement = "top" | "bottom";
/** 右側の目次の出し方。`hover` は右端の線を出し、指すかフォーカスで目次を重ねて出す。`fixed` は目次を出すボタンでサイドバーを開閉する */
export type SideTocMode = "hover" | "fixed";
/** mdmark に入れた配色のテーマの名前 */
export type ColorTheme = "dev-swiss" | "theme-paper" | "theme-slate" | "theme-contrast";
/** 描いた文書の配色の明暗。`light`・`dark` は描く先の要素の class で祖先の class と OS の設定に勝たせ、`auto` は class を付けずに任せる */
export type ColorScheme = "light" | "dark" | "auto";
/** 文書の page の印から読んだ、設定より優先する値。書かなかったキーは持たない */
export type PageSettings = {
    /** `scheme=` の値 */
    scheme?: ColorScheme;
    /** `theme=` の値 */
    theme?: ColorTheme;
    /** `toc=` の値 */
    toc?: SideTocMode;
};
/** 対応表の行: 印 1 つのモジュールの URL と、図の印か */
export type LibraryEntry = {
    /** モジュールの URL */
    url: string;
    /** 図の印か。知らせの枠の題を分ける */
    figure: boolean;
};
/** 全てのキーに値を持つ、内部で使う設定 */
export type ResolvedConfig = {
    /** 機能のオン・オフ（キーはこの版が知っている機能だけ） */
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
};
/** mdmark に入れた配色のテーマの名前の並び。`resolveConfig`・CLI の点検と書き出しの警告が照らす */
export declare const COLOR_THEMES: readonly ColorTheme[];
/** 設定に `colorTheme` が無いか知らない名前のときのテーマ。配色の値は `src/index.css` の `:root` の既定のまま */
export declare const DEFAULT_COLOR_THEME: ColorTheme;
/** 配色の明暗の値の並び。`resolveConfig`・page の印の読み取り・CLI の点検が照らす */
export declare const COLOR_SCHEMES: readonly ColorScheme[];
/** 設定に `colorScheme` が無いか知らない値のときの明暗 */
export declare const DEFAULT_COLOR_SCHEME: ColorScheme;
/** 設定の `labels.paramCopy` が空でない文字列でないときの部品の文言 */
export declare const DEFAULT_LABELS: {
    paramCopy: string;
};
/** この版が知っている機能とその既定 */
export declare const DEFAULT_FEATURES: Record<string, boolean>;
/** 設定の `syntax.url` が無いときに読む highlight.js の `es/` フォルダの URL。バージョンを固定する */
export declare const DEFAULT_SYNTAX_URL = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";
/** 設定の `html-scripts.url` が無いときに読む @babel/standalone の ES モジュールの URL。バージョンを固定する */
export declare const DEFAULT_HTML_SCRIPTS_URL = "https://cdn.jsdelivr.net/npm/@babel/standalone@8.1.1/+esm";
/** 設定の `mermaid.url` が無いときに読む mermaid の ES モジュールの URL。バージョンを固定する */
export declare const DEFAULT_MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";
/** `MermaidTheme` の値の並び。`resolveConfig` が照らす */
export declare const MERMAID_THEMES: readonly MermaidTheme[];
/** 印の名前から `LibraryEntry` を引く既定の対応表 */
export declare const DEFAULT_LIBRARIES: Record<string, LibraryEntry>;
/** 印の名前と設定の `libraries` のキーが合うべき書式 */
export declare const MARK_NAME_PATTERN: RegExp;
/** 使う側の設定に既定を当て、型の合わない値を落とした設定を返す */
export declare function resolveConfig(options: {
    /** 使う側の設定 */
    config?: MdmarkConfig;
    /** 既定の対応表（単体テストで差し替える） */
    defaultLibraries?: Record<string, LibraryEntry>;
}): ResolvedConfig;
/** 既定を当てた設定に、文書の page の印の値を重ねた設定を返す（渡された設定は書き換えない） */
export declare const applyPageSettings: (options: {
    /** 既定を当てた設定 */
    config: ResolvedConfig;
    /** `renderDocument` が返したページの設定 */
    page: PageSettings;
}) => ResolvedConfig;
