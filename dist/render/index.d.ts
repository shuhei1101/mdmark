import { type MdmarkConfig, type ResolvedConfig } from "../config.ts";
import { type MdmarkIndex } from "../knowledge/index-shape.ts";
import type { MdmarkReferences } from "../knowledge/references.ts";
/** 本文の HTML と、文書の印で決まった機能のオン・オフ */
export type RenderedDocument = {
    /** 本文の HTML 文字列 */
    html: string;
    /** 文書の印を重ねて決まった機能のオン・オフ */
    features: Record<string, boolean>;
};
/** Markdown を本文の HTML にし、文書の印で決まった機能のオン・オフと一緒に返す */
export declare function renderDocument(options: {
    /** Markdown */
    markdown: string;
    /** 既定を当てた設定 */
    config: ResolvedConfig;
    /** 索引。形の合わない文書・用語は除いて使う */
    index?: MdmarkIndex | undefined;
    /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
    docId?: string | undefined;
    /** 参照の表 */
    references?: MdmarkReferences | undefined;
}): RenderedDocument;
/** 画面を持たずに Markdown を本文の HTML 文字列にする */
export declare function render(markdown: string, opts?: {
    config?: MdmarkConfig;
    index?: MdmarkIndex;
    docId?: string;
    /** 省くと、関連文書の一覧は索引の `related` だけから出し、他の文書の用語集の表の用語を照合しない */
    references?: MdmarkReferences;
}): string;
