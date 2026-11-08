import { iconSvg } from "./icons.ts";

/** 番号のリンクとツールチップのタイトルの頭の文言 */
const FOOTNOTE_LABEL = "脚注";

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
}): string {
  const { number, refIndex = 0, bodies, below = false } = options;
  const tipId = `mdmark-fn-tip-${number}-${refIndex}`;
  const label = `${FOOTNOTE_LABEL} ${number}`;
  // 中身がリンクを持つときは中へ Tab で移れる group、持たないときはスクリーンリーダーの説明の tooltip にする
  const linked = hasLink(bodies);
  const pointer = linked
    ? `aria-details="${tipId}"`
    : `aria-describedby="${tipId}"`;
  const role = linked ? `role="group" aria-label="${label}"` : 'role="tooltip"';
  const classes = below ? "mdmark-fn-ref is-below" : "mdmark-fn-ref";
  const items = bodies
    .map((body) => `${FOOTNOTE_BODY_OPEN}${body}</span>`)
    .join("");
  return `<sup class="${classes}"><a class="mdmark-fn-link" id="mdmark-fnref-${number}-${refIndex}" href="#mdmark-fn-${number}" ${pointer}><span class="mdmark-visually-hidden">${FOOTNOTE_LABEL} </span>${number}</a><span class="mdmark-fn-tip" id="${tipId}" ${role}><span class="mdmark-fn-tip-title">${label}</span>${items}</span></sup>`;
}

/** 参照 1 つへ戻るリンクの HTML を返却する */
function renderBackLink(options: {
  number: number;
  index: number;
  count: number;
}): string {
  const { number, index, count } = options;
  const several = count > 1;
  const label = several
    ? `本文の${FOOTNOTE_LABEL} ${number} の ${index + 1} つ目の参照へ戻る`
    : `本文の${FOOTNOTE_LABEL} ${number} へ戻る`;
  const letter = several ? (BACK_LETTERS[index] ?? String(index + 1)) : "";
  return `<a class="mdmark-fn-back" href="#mdmark-fnref-${number}-${index}" aria-label="${label}">${iconSvg("corner-up-left")}${letter}</a>`;
}

/** 文書の末尾に配置する、閉じた脚注の一覧の HTML を返却する。項目が無ければ空文字。`html` は描いた HTML なのでエスケープしない */
export function renderFootnotes(options: {
  /** 脚注の項目（番号の順） */
  items: Array<{ number: number; html: string; refCount: number }>;
  /** 開いた外観にするか */
  open?: boolean;
}): string {
  const { items, open = false } = options;
  if (items.length === 0) {
    return "";
  }
  const lis = items
    .map(({ number, html, refCount }) => {
      const backs = Array.from({ length: refCount }, (_, index) =>
        renderBackLink({ number, index, count: refCount }),
      ).join("");
      // 戻るリンクは最後の段落の末尾に配置し、段落が無ければ中身の末尾に配置する
      const at = html.lastIndexOf("</p>");
      const body =
        at < 0
          ? `${html} ${backs}`
          : `${html.slice(0, at)} ${backs}${html.slice(at)}`;
      return `<li class="mdmark-fn-item" id="mdmark-fn-${number}">${body}</li>`;
    })
    .join("");
  return `<details class="mdmark-footnotes"${open ? " open" : ""}><summary>${FOOTNOTE_LABEL}（${items.length} 件）</summary><ol class="mdmark-footnotes-list">${lis}</ol></details>`;
}
