import { type MdmarkConfig } from "../config.ts";
import type { MdmarkIndex } from "../knowledge/index-shape.ts";
import { type PureBlock } from "./pure-blocks.logic.ts";
/** `opts.figure` が受ける `chart`・`param`・埋め込んだ HTML 1 つ */
export type MdmarkFigure = {
    /** 図の種類 */
    kind: "chart" | "param" | "html";
    /** 文書の中で何番目の図か（1 から） */
    index: number;
    /** `render` がその図の範囲に返却する HTML。埋め込んだ HTML は範囲のスクリプトを除いた HTML */
    html: string;
    /** `chart`・`param` のタイトル */
    title: string | undefined;
    /** `chart`・`param` の凡例の系列の名前。埋め込んだ HTML は空 */
    legend: string[];
};
/** 図を Markdown にする関数。`undefined` を返却した図は取り除く */
export type FigureToMarkdown = (figure: MdmarkFigure) => string | undefined | Promise<string | undefined>;
/** `toPureMarkdown` の `opts` */
export type PureMarkdownOptions = {
    /** 設定。`features` だけを使用する */
    config?: MdmarkConfig | undefined;
    /** 索引 */
    index?: MdmarkIndex | undefined;
    /** 文書の ID */
    docId?: string | undefined;
    /** 取り込む文書の表。キーは文書のフォルダからのパス */
    includes?: Record<string, string> | undefined;
    /** 図を Markdown にする関数 */
    figure?: FigureToMarkdown | undefined;
};
/** `toPureMarkdown` の戻り値 */
export type PureMarkdownResult = {
    /** 純粋な Markdown */
    markdown: string;
    /** 取り除いた中身と元の行番号の文 */
    warnings: string[];
};
/** 図の範囲の Markdown を `render` で HTML にし、`chart`・`param` は定義からタイトルと凡例を取り出す */
export declare function figureOf(options: {
    /** 図の範囲（`splitPureBlocks` の `figure` のブロック） */
    block: PureBlock;
    /** 文書の中で何番目の図か（1 から） */
    index: number;
    /** 設定 */
    config?: MdmarkConfig | undefined;
}): {
    figure: MdmarkFigure;
    warnings: string[];
};
/** 引数を検査し、文書をブロックに分けて変換し、図と拡張のフックの戻り値を入れた純粋な Markdown と警告を返却する */
export declare function toPureMarkdown(markdown: string, opts?: PureMarkdownOptions): Promise<PureMarkdownResult>;
