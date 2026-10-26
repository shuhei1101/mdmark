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
};
/** ツールチップを持ち主の上と下のどちらに先に出すか。`top` は上に出し、上に収まらないときだけ下に出す。`bottom` は下に出し、下に収まらず上に収まるときだけ上に出す */
export type TooltipPlacement = "top" | "bottom";
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
};
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
