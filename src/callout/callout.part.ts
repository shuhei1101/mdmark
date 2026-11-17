/** 注意書きの種類 */
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";

/** 注意書きの種類（引用の 1 行目に記載できる。知らない種類は `note`） */
export const CALLOUT_KINDS: readonly CalloutKind[] = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
];

/** 種類ごとのタイトルの文言 */
const CALLOUT_TITLES: Record<CalloutKind, string> = {
  note: "補足",
  tip: "ヒント",
  important: "重要",
  warning: "警告",
  caution: "注意",
};

/** 注意書きの HTML を返却する */
export function renderCallout(options: {
  /** 種類 */
  kind: CalloutKind;
  /** 折り畳みか */
  collapsed?: boolean;
  /** 折り畳みが開いているか */
  open?: boolean;
  /** タイトルの行内の HTML（エスケープ済み）。指定すると種類の名前はスクリーンリーダーだけにする */
  title?: string | undefined;
  /** 本文の HTML（`SLOT_MARKER` を指定できる） */
  body: string;
}): string {
  const { kind, collapsed = false, open = false, body } = options;
  const title =
    options.title === undefined
      ? CALLOUT_TITLES[kind]
      : `<span class="mdmark-visually-hidden">${CALLOUT_TITLES[kind]}: </span>${options.title}`;
  const classes = `markdown-alert markdown-alert-${kind}`;
  if (collapsed) {
    return `<details class="${classes}"${open ? " open" : ""}><summary class="markdown-alert-title">${title}</summary>${body}</details>`;
  }
  return `<div class="${classes}"><p class="markdown-alert-title">${title}</p>${body}</div>`;
}
