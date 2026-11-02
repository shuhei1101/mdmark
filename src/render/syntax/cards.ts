import type { StateCore, Token } from "markdown-it";
import { type AttachmentKind, renderCard } from "../../parts/card.ts";
import { featureOn, ownBlock } from "./tokens.ts";

/** 添付の拡張子（小文字）から添付の種類を引く */
export const ATTACHMENT_KINDS: Readonly<Record<string, AttachmentKind>> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  odt: "doc",
  rtf: "doc",
  xls: "sheet",
  xlsx: "sheet",
  ods: "sheet",
  csv: "sheet",
  tsv: "sheet",
  ppt: "slide",
  pptx: "slide",
  odp: "slide",
  key: "slide",
  zip: "archive",
  gz: "archive",
  tar: "archive",
  "7z": "archive",
  txt: "text",
};

/** カードにする URL のスキーム */
const WEB_URL_PATTERN = /^https?:\/\//i;

/** URL のまま書いたリンクのマークアップ */
const AUTOLINK_MARKUPS = ["linkify", "autolink"];

/** カードの指定 */
export type CardSpec = {
  /** カードの種類 */
  kind: "link" | "file";
  /** リンク先 */
  href: string;
  /** タイトル。`link` で URL をそのまま書いたときはスキームを除いた URL */
  title: string;
  /** `file` のときの種類 */
  fileKind?: AttachmentKind | undefined;
};

/** リンク先のパス（クエリとフラグメントを除く）の拡張子を小文字で返す */
function extensionOf(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? "";
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** リンク先の拡張子が添付の種類にあれば `file`、`http`・`https` の URL なら `link` のカードの指定を返す。カードにしないリンクは `undefined` */
export function cardOf(
  href: string,
  text: string,
  autolinked: boolean,
): CardSpec | undefined {
  if (href.startsWith("#")) {
    return undefined;
  }
  const fileKind = ATTACHMENT_KINDS[extensionOf(href)];
  if (fileKind !== undefined) {
    return { kind: "file", href, title: text, fileKind };
  }
  if (!WEB_URL_PATTERN.test(href) || extensionOf(href) === "md") {
    return undefined;
  }
  const title = autolinked ? text.replace(WEB_URL_PATTERN, "") : text;
  return { kind: "link", href, title };
}

/** 段落の行内の子が、前後の空白を除いてリンク 1 つだけなら、リンクの開きと書いた文字を返す */
function soleLinkOf(
  inline: Token | undefined,
): { open: Token; text: string } | undefined {
  const rest = (inline?.children ?? []).filter(
    (child) => !(child.type === "text" && child.content.trim() === ""),
  );
  const open = rest[0];
  const close = rest.at(-1);
  if (
    open?.type !== "link_open" ||
    close?.type !== "link_close" ||
    rest.length < 2
  ) {
    return undefined;
  }
  const inner = rest.slice(1, -1);
  if (!inner.every((child) => child.type === "text")) {
    return undefined;
  }
  return { open, text: inner.map((child) => child.content).join("") };
}

/** `cards` がオンなら、リンク 1 つだけの段落のうちカードになるものを、リンクと添付のカードに置き換える */
export function buildCards(state: StateCore): void {
  if (!featureOn(state, "cards")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as Token;
    const link =
      token.type === "paragraph_open"
        ? soleLinkOf(tokens[index + 1])
        : undefined;
    const autolinked = AUTOLINK_MARKUPS.includes(link?.open.markup ?? "");
    // スキームの無いドメインの自動リンクは、後で文字に戻すためカードにしない
    const spec =
      link && (!autolinked || WEB_URL_PATTERN.test(link.text))
        ? cardOf(String(link.open.attrGet("href") ?? ""), link.text, autolinked)
        : undefined;
    if (!spec) {
      out.push(token);
      continue;
    }
    out.push(ownBlock(state, renderCard(spec), token));
    index += 2;
  }
  state.tokens = out;
}
