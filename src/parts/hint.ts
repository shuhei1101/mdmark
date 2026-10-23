import { renderDiagramTip } from "./diagram.ts";
import { escapeHtml } from "./escape.ts";

/** 印の付け方: ブロックの要素は右上の印、行内の要素は要素そのもの */
export type HintPlacement = "block" | "inline";

/** 行内の要素（`data-hint` に破線の下線を引き、要素そのものがツールチップの持ち主になる） */
const INLINE_TAGS = new Set([
  "span",
  "a",
  "abbr",
  "b",
  "strong",
  "em",
  "i",
  "code",
  "small",
  "mark",
  "sub",
  "sup",
  "time",
  "kbd",
  "q",
  "s",
  "u",
]);

/** 中身を持たない要素。右上の印を入れられないので、行内の要素として扱う */
const VOID_TAGS = new Set(["img", "br", "hr", "input", "wbr"]);

/** 要素に足す属性と、閉じタグの前と要素の後ろに置く HTML */
export type HintMarkup = {
  /** 印の付け方 */
  placement: HintPlacement;
  /** 要素の開きタグに足す属性 */
  attributes: Record<string, string>;
  /** 閉じタグの前（要素の最後の子）に置く HTML。ブロックの要素の印のボタン */
  inside: string;
  /** 要素の後ろに置く HTML。ツールチップの中身 */
  after: string;
};

/** `data-hint` を持つ要素の種類から印の付け方を決める */
export function placementOf(tag: string): HintPlacement {
  const name = tag.toLowerCase();
  return INLINE_TAGS.has(name) || VOID_TAGS.has(name) ? "inline" : "block";
}

/** ヒントの印と中身を作る。ブロックの要素には右上の印のボタンを、行内の要素には `tabindex` を付け、ツールチップの中身を要素の後ろに置く */
export function renderHintMarkup(hint: {
  /** 要素のタグ名 */
  tag: string;
  /** `data-hint` の値（文字として出す） */
  text: string;
  /** ツールチップの `id`（`mdmark-hint-{n}`） */
  id: string;
}): HintMarkup {
  const { tag, text, id } = hint;
  const placement = placementOf(tag);
  const after = renderDiagramTip({
    id,
    kind: "hint",
    label: "",
    hint: text,
  });
  if (placement === "inline") {
    return {
      placement,
      attributes: {
        class: "mdmark-hint-inline",
        tabindex: "0",
        "aria-describedby": id,
      },
      inside: "",
      after,
    };
  }
  const safeId = escapeHtml(id);
  return {
    placement,
    attributes: { class: "mdmark-hint-block" },
    inside: `<button type="button" class="mdmark-hint-mark" aria-label="説明" aria-describedby="${safeId}"></button>`,
    after,
  };
}

/** 部品設計『ヒント』: `data-hint` を持つ要素に印か下線とツールチップを付けた HTML（Storybook のストーリーが開く）。`open` のときはツールチップを開いて見せる */
export function renderHint(props: {
  /** `data-hint` の文 */
  text: string;
  /** 印の付け方 */
  placement: HintPlacement;
  /** ツールチップを開いているか（既定 `false`） */
  open?: boolean;
  /** 要素の中身（既定は見本の文字） */
  body?: string;
  /** 要素に足す `style`（書いた人が地の色を付けたブロックの要素を見せるときに使う） */
  style?: string;
}): string {
  const { text, placement, open = false } = props;
  const id = "story-hint";
  const markup = renderHintMarkup({
    tag: placement === "block" ? "div" : "span",
    text,
    id,
  });
  const openClass = open ? " is-hint-open" : "";
  const styleAttribute =
    props.style === undefined ? "" : ` style="${escapeHtml(props.style)}"`;
  const attributes = Object.entries(markup.attributes)
    .map(([name, value]) =>
      name === "class"
        ? ` class="${value}${openClass}"`
        : ` ${name}="${escapeHtml(value)}"`,
    )
    .join("")
    .concat(styleAttribute);
  // 開いた状態は、要素の上に出す（画面に対する位置は操作が決める）。上の余白の左上に置く
  const tip = open
    ? markup.after
        .replace(' hidden="hidden"', "")
        .replace(
          'role="tooltip"',
          'role="tooltip" style="position:absolute;inset-block-start:0;inset-inline-start:0"',
        )
    : markup.after;
  const frame = `position:relative;padding-block-start:${open ? "6rem" : "0"}`;
  if (placement === "block") {
    const body = props.body ?? "ブロックの要素の文字";
    return `<div style="${frame}"><div${attributes}>${body}${markup.inside}</div>${tip}</div>`;
  }
  const body = props.body ?? "行内の語";
  return `<p style="${frame}">本文の<span${attributes}>${body}</span>${tip}を読む。</p>`;
}
