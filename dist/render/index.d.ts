import { type MdmarkConfig, type ResolvedConfig } from "../config.ts";
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
}): RenderedDocument;
/** 画面を持たずに Markdown を本文の HTML 文字列にする */
export declare function render(markdown: string, opts?: {
    config?: MdmarkConfig;
}): string;
