/** 使う側が `opts.config` に渡す設定。他のキーを持っていても読まない */
export type MdmarkConfig = {
    /** 機能のオン・オフの既定 */
    features?: Record<string, boolean>;
    /** 印の名前からモジュールの URL を引く対応表 */
    libraries?: Record<string, string>;
    /** ツールチップの設定。`placement` は持ち主の上と下のどちらに先に出すか（`top` / `bottom`）。知らない値も受けて `resolveConfig` が `top` にするため、型は `string` */
    tooltips?: {
        placement?: string;
    };
    /** 色分けのライブラリの設定。`url` は highlight.js の `es/` フォルダの URL（末尾 `/`） */
    syntax?: {
        url?: string;
    };
    /** 右側の目次の設定。`mode` は出し方（`hover` / `fixed`）。知らない値も受けて `resolveConfig` が `hover` にするため、型は `string` */
    "side-toc"?: {
        mode?: string;
    };
    /** 配色のテーマの名前（`COLOR_THEMES` のどれか）。知らない値も受けて `resolveConfig` が `DEFAULT_COLOR_THEME` にするため、型は `string` */
    colorTheme?: string;
};
/** ツールチップを持ち主の上と下のどちらに先に出すか。`top` は上に出し、上に収まらないときだけ下に出す。`bottom` は下に出し、下に収まらず上に収まるときだけ上に出す */
export type TooltipPlacement = "top" | "bottom";
/** 右側の目次の出し方。`hover` は右端の線を出し、指すかフォーカスで目次を重ねて出す。`fixed` は目次を出すボタンでサイドバーを開閉する */
export type SideTocMode = "hover" | "fixed";
/** mdmark に入れた配色のテーマの名前 */
export type ColorTheme = "dev-swiss" | "theme-paper" | "theme-slate" | "theme-contrast";
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
    /** 設定の `tooltips.placement` が `bottom` のときだけ `bottom`、それ以外は `top` */
    tooltips: {
        placement: TooltipPlacement;
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
};
/** mdmark に入れた配色のテーマの名前の並び。`resolveConfig`・CLI の点検と書き出しの警告が照らす */
export declare const COLOR_THEMES: readonly ColorTheme[];
/** 設定に `colorTheme` が無いか知らない名前のときのテーマ。配色の値は `src/index.css` の `:root` の既定のまま */
export declare const DEFAULT_COLOR_THEME: ColorTheme;
/** この版が知っている機能とその既定 */
export declare const DEFAULT_FEATURES: Record<string, boolean>;
/** 設定の `syntax.url` が無いときに読む highlight.js の `es/` フォルダの URL。バージョンを固定する */
export declare const DEFAULT_SYNTAX_URL = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";
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
