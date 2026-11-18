/** 添付の種類 */
export type AttachmentKind = "pdf" | "doc" | "sheet" | "slide" | "archive" | "text";
/** リンクと添付のカードの HTML を返却する */
export declare function renderCard(options: {
    /** リンクか添付か */
    kind: "link" | "file";
    /** リンク先 */
    href: string;
    /** タイトル */
    title: string;
    /** 添付の種類（`file` のとき） */
    fileKind?: AttachmentKind;
}): string;
