import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 脚注か注記か */
export type FootnoteKind = "footnote" | "annotation";

/** 種類ごとの文言と `id` の頭 */
const KINDS = {
  footnote: {
    label: "脚注",
    refId: "mdmark-fnref-",
    tipId: "mdmark-fn-tip-",
    itemId: "mdmark-fn-",
    refClass: "",
    listClass: "",
  },
  annotation: {
    label: "注記",
    refId: "mdmark-noteref-",
    tipId: "mdmark-note-tip-",
    itemId: "mdmark-note-",
    refClass: " mdmark-note-ref",
    listClass: " mdmark-notes",
  },
} as const satisfies Record<FootnoteKind, Record<string, string>>;

/** 図の要素の注記の持ち主（線の押せる帯・マーカーのボタン）の `id` の頭 */
export const NOTE_OWNER_PREFIX = "mdmark-note-owner-";

/** 注記の持ち主の `id`。要素の ID の空白は `_` にする */
export const noteOwnerId = (prefix: string, elementId: string): string =>
  `${prefix}${elementId.replace(/\s/g, "_")}`;

/** ツールチップの中身の段落 1 つを包む開始タグ（記法が、中身の前後で mdmark が出した要素を見分けるのに使用する） */
export const FOOTNOTE_BODY_OPEN = '<span class="mdmark-fn-tip-body">';

/** 戻るリンクが 2 つ以上あるときに添える文字（26 を超えたら番号にする） */
const BACK_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** 中身がリンク（`a` 要素）を持つか */
function hasLink(bodies: string[]): boolean {
  return bodies.some((body) => /<a\s/i.test(body));
}

/** 本文の脚注の番号と、隣のツールチップの HTML を返却する。`bodies` は描いた HTML なのでエスケープしない */
export function renderFootnoteRef(options: {
  /** 脚注の番号 */
  number: number;
  /** その脚注の何回目の参照か（0 から） */
  refIndex?: number;
  /** 脚注の中身の段落ごとの行内の HTML */
  bodies: string[];
  /** 番号の下に開いた外観にするか */
  below?: boolean;
  /** 脚注か注記か */
  kind?: FootnoteKind;
  /** 文字を挟まずに脚注の番号か注記のマーカーの直後に続く参照か */
  afterRef?: boolean;
}): string {
  const {
    number,
    refIndex = 0,
    bodies,
    below = false,
    kind = "footnote",
    afterRef = false,
  } = options;
  const names = KINDS[kind];
  const tipId = `${names.tipId}${number}-${refIndex}`;
  const label = `${names.label} ${number}`;
  // 中身がリンクを持つときは中へ Tab で移れる group、持たないときはスクリーンリーダーの説明の tooltip にする
  const linked = hasLink(bodies);
  const pointer = linked
    ? `aria-details="${tipId}"`
    : `aria-describedby="${tipId}"`;
  const role = linked ? `role="group" aria-label="${label}"` : 'role="tooltip"';
  const classes = `mdmark-fn-ref${names.refClass}${below ? " is-below" : ""}${afterRef ? " is-after-ref" : ""}`;
  const items = bodies
    .map((body) => `${FOOTNOTE_BODY_OPEN}${body}</span>`)
    .join("");
  return `<sup class="${classes}"><a class="mdmark-fn-link" id="${names.refId}${number}-${refIndex}" href="#${names.itemId}${number}" ${pointer}><span class="mdmark-visually-hidden">${names.label} </span>${number}</a><span class="mdmark-fn-tip" id="${tipId}" ${role}><span class="mdmark-fn-tip-title">${label}</span>${items}</span></sup>`;
}

/** 参照 1 つへ戻るリンクの行き先 */
export type FootnoteBackRef = { href: string; owner?: string };

/** 参照 1 つへ戻るリンクの HTML を返却する */
function renderBackLink(options: {
  label: string;
  number: number;
  index: number;
  count: number;
  ref: FootnoteBackRef;
}): string {
  const { label: name, number, index, count, ref } = options;
  const several = count > 1;
  const label = several
    ? `本文の${name} ${number} の ${index + 1} つ目の参照へ戻る`
    : `本文の${name} ${number} へ戻る`;
  const letter = several ? (BACK_LETTERS[index] ?? String(index + 1)) : "";
  const owner =
    ref.owner === undefined
      ? ""
      : ` data-note-owner="${escapeHtml(ref.owner)}"`;
  return `<a class="mdmark-fn-back" href="${escapeHtml(ref.href)}"${owner} aria-label="${label}">${iconSvg("corner-up-left")}${letter}</a>`;
}

/** 文書の末尾に配置する、閉じた脚注の一覧の HTML を返却する。項目が無ければ空文字。`html` は描いた HTML なのでエスケープしない */
export function renderFootnotes(options: {
  /** 脚注の項目（番号の順）。`refs` があれば `refCount` の代わりに戻るリンクの行き先にする */
  items: Array<{
    number: number;
    html: string;
    refCount: number;
    refs?: FootnoteBackRef[];
  }>;
  /** 開いた外観にするか */
  open?: boolean;
  /** 脚注の一覧か注記の一覧か */
  kind?: FootnoteKind;
}): string {
  const { items, open = false, kind = "footnote" } = options;
  const names = KINDS[kind];
  if (items.length === 0) {
    return "";
  }
  const lis = items
    .map(({ number, html, refCount, refs }) => {
      const targets =
        refs ??
        Array.from({ length: refCount }, (_, index) => ({
          href: `#${names.refId}${number}-${index}`,
        }));
      const backs = targets
        .map((ref, index) =>
          renderBackLink({
            label: names.label,
            number,
            index,
            count: targets.length,
            ref,
          }),
        )
        .join("");
      // 戻るリンクは最後の段落の末尾に配置し、段落が無ければ中身の末尾に配置する
      const at = html.lastIndexOf("</p>");
      const body =
        at < 0
          ? `${html} ${backs}`
          : `${html.slice(0, at)} ${backs}${html.slice(at)}`;
      return `<li class="mdmark-fn-item" id="${names.itemId}${number}">${body}</li>`;
    })
    .join("");
  return `<details class="mdmark-footnotes${names.listClass}"${open ? " open" : ""}><summary>${names.label}（${items.length} 件）</summary><ol class="mdmark-footnotes-list">${lis}</ol></details>`;
}
