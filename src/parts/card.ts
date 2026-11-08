import { escapeHtml } from "./escape.ts";

/** 添付の種類 */
export type AttachmentKind =
  | "pdf"
  | "doc"
  | "sheet"
  | "slide"
  | "archive"
  | "text";

/** リンク先のパス（クエリとフラグメントを除く）の最後の部分 */
function fileNameOf(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";
  return path.slice(path.lastIndexOf("/") + 1);
}

/** リンクと添付のカードの HTML を返す */
export function renderCard(options: {
  /** リンクか添付か */
  kind: "link" | "file";
  /** リンク先 */
  href: string;
  /** タイトル */
  title: string;
  /** 添付の種類（`file` のとき） */
  fileKind?: AttachmentKind;
}): string {
  const { kind, href, title, fileKind } = options;
  const name = fileNameOf(href);
  const domain =
    kind === "link"
      ? new URL(href).host
      : name.slice(name.lastIndexOf(".") + 1).toUpperCase();
  const url = kind === "link" ? href : name;
  const fileAttribute =
    kind === "file" && fileKind !== undefined
      ? ` data-file-kind="${fileKind}"`
      : "";
  return `<a class="mdmark-card" data-card="${kind}"${fileAttribute} href="${escapeHtml(href)}"><span class="mdmark-card-icon" aria-hidden="true"></span><span class="mdmark-card-title">${escapeHtml(title)}</span><span class="mdmark-card-meta"><span class="mdmark-card-domain">${escapeHtml(domain)}</span><span class="mdmark-card-url">${escapeHtml(url)}</span></span></a>`;
}
