import type { MdmarkAlias } from "../knowledge/aliases.ts";
/** コマンドのコピーのボタンの状態 */
export type TermTipCopyState = "idle" | "copied" | "failed";
/** コピーのボタンの状態ごとの文言とアイコン（コードブロックのコピーと同じ） */
export declare const COMMAND_COPY_STATES: {
    readonly idle: {
        readonly text: "コピー";
        readonly icon: "copy";
    };
    readonly copied: {
        readonly text: "コピーしました";
        readonly icon: "check";
    };
    readonly failed: {
        readonly text: "コピーできませんでした";
        readonly icon: "circle-alert";
    };
};
/** コピーのボタンの中に配置する、状態のアイコンと文言の HTML を返却する */
export declare function renderTermTipCopy(state: TermTipCopyState): string;
/** ツールチップの「関連文書」に並べる文書 1 つ */
export type TermTipDoc = {
    /** 文書のタイトル */
    title: string;
    /** 描く文書を基準にした相対パス */
    href: string;
    /** 索引の `description` */
    description?: string;
};
/** 本文の単語に破線の下線を付け、直後に「用語」の意味と「関連文書」のツールチップを配置する HTML を返却する。意味も関連文書も無ければ単語をそのまま返却する。`replacement` を指定すると、単語に波線のマーカーを引き、「代わりの用語」だけのツールチップを配置する（`meaning`・`docs` は使用しない） */
export declare function renderTermTip(props: {
    /** 下線を付ける本文の単語 */
    text: string;
    /** ツールチップの要素の `id` */
    id: string;
    /** 「用語」に出す意味。空なら「用語」の区分を出さない */
    meaning?: string;
    /** 「関連文書」に並べる文書。空なら「関連文書」の区分を出さない */
    docs?: TermTipDoc[];
    /** `text` がやめた言い方のときの代わりの用語。`meaning` が無ければ意味を配置しない */
    replacement?: {
        term: string;
        meaning?: string;
    };
    /** `text` が一致したエイリアス。指定すると種類ごとの区分を出し、`meaning`・`docs` は使用しない */
    alias?: MdmarkAlias;
    /** コマンドのコピーのボタンの状態（`mount` が付けた状態）。省くと `idle` */
    copy?: TermTipCopyState;
    /** 単語の下に開いた外観にするか。ストーリーが下に開いた状態を出すために使用し、`render` は指定しない */
    below?: boolean;
}): string;
