import type { StateCore } from "markdown-it";
import { type AttachmentKind } from "../../parts/card.ts";
/** 添付の拡張子（小文字）から添付の種類を参照する */
export declare const ATTACHMENT_KINDS: Readonly<Record<string, AttachmentKind>>;
/** カードの指定 */
export type CardSpec = {
    /** カードの種類 */
    kind: "link" | "file";
    /** リンク先 */
    href: string;
    /** タイトル。`link` で URL をそのまま記載したときはスキームを除いた URL */
    title: string;
    /** `file` のときの種類 */
    fileKind?: AttachmentKind | undefined;
};
/** リンク先の拡張子が添付の種類にあれば `file`、`http`・`https` の URL なら `link` のカードの指定を返却する。カードにしないリンクは `undefined` */
export declare function cardOf(href: string, text: string, autolinked: boolean): CardSpec | undefined;
/** `cards` がオンなら、リンク 1 つだけの段落のうちカードになるものを、リンクと添付のカードに置き換える */
export declare function buildCards(state: StateCore): void;
