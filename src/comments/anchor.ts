import type { MdmarkComment, MdmarkCommentDraft } from "./spec.ts";

/** 下書きの `prefix`・`suffix` に取る文字の上限 */
export const CONTEXT_CHARS = 32;

/** コメントを付けない場所: この中の選びにはボタンを出さない */
export const COMMENT_EXCLUDED =
  "input, textarea, pre, code, .mdmark-view-switch, .mdmark-view-board, .mdmark-filter-drawer, .mdmark-comment-mark, .mdmark-comment-popover, .mdmark-comment-add, .mdmark-comment-orphans";

/** 箇所を探す本文の文字に数えない場所。印は本文の文字を変えないため、印の中の文字は数える */
const TEXT_EXCLUDED = COMMENT_EXCLUDED.split(", ")
  .filter((selector) => selector !== ".mdmark-comment-mark")
  .join(", ");

/** 本文の文字と、文字の節ごとの始まりの位置 */
export type CommentText = {
  /** 文字の節をつないだ本文の文字 */
  text: string;
  /** 文字の節と、`text` の中の始まりの位置 */
  nodes: Array<{ node: Text; start: number }>;
};

/** `root` の中の、`TEXT_EXCLUDED` に入らない文字の節を順に集め、つないだ文字と節ごとの始まりの位置を返す */
export function commentText(root: HTMLElement): CommentText {
  const nodes: CommentText["nodes"] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const excluded = node.parentElement?.closest(TEXT_EXCLUDED);
    // 除く場所が `root` の外の祖先なら、除かない
    if (excluded && root.contains(excluded)) {
      continue;
    }
    nodes.push({ node: node as Text, start: text.length });
    text += node.textContent ?? "";
  }
  return { text, nodes };
}

/** 範囲の端（要素の中の位置を含む）を、本文の文字の中の位置にする */
function positionOf(
  collected: CommentText,
  container: Node,
  offset: number,
): number {
  const hit = collected.nodes.find(({ node }) => node === container);
  if (hit) {
    return hit.start + offset;
  }
  // 要素の中の位置は、その位置より後ろで最初の文字の節の始まりにする
  const point = document.createRange();
  point.setStart(container, offset);
  point.collapse(true);
  const after = collected.nodes.find(
    ({ node }) => point.comparePoint(node, 0) > 0,
  );
  return after ? after.start : collected.text.length;
}

/** 範囲の文字と、範囲の前後の本文の文字から、コメントの下書きを作る */
export function draftFromRange(options: {
  /** 範囲の要素 */
  root: HTMLElement;
  /** 選んだ範囲 */
  range: Range;
  /** コメントの本文 */
  body: string;
}): MdmarkCommentDraft {
  const { root, range, body } = options;
  const collected = commentText(root);
  let start = positionOf(collected, range.startContainer, range.startOffset);
  let end = positionOf(collected, range.endContainer, range.endOffset);
  // 選んだ文字の前後の空白を落とし、落とした分だけ位置をずらす
  const raw = collected.text.slice(start, end);
  start += raw.length - raw.trimStart().length;
  end -= raw.length - raw.trimEnd().length;
  return {
    quote: collected.text.slice(start, end),
    prefix: collected.text.slice(Math.max(0, start - CONTEXT_CHARS), start),
    suffix: collected.text.slice(end, end + CONTEXT_CHARS),
    body: body.trim(),
  };
}

/** 本文の文字に付ける箇所と、そこに付くコメント */
export type CommentAnchor = {
  /** `text` の中の始まりの位置 */
  start: number;
  /** `text` の中の終わりの位置 */
  end: number;
  /** この箇所に付くコメント（保存の順） */
  comments: MdmarkComment[];
};

/** `quote` が本文に現れる位置を全て返す */
function occurrences(text: string, quote: string): number[] {
  const positions: number[] = [];
  for (
    let found = text.indexOf(quote);
    found >= 0;
    found = text.indexOf(quote, found + 1)
  ) {
    positions.push(found);
  }
  return positions;
}

/** コメント 1 つの `quote` の始まりの位置を探す。前後の文字を含めて一致する最初の位置、無ければ `quote` が 1 か所だけ一致する位置。見つからなければ `undefined` */
function findStart(text: string, comment: MdmarkComment): number | undefined {
  const full = text.indexOf(comment.prefix + comment.quote + comment.suffix);
  if (full >= 0) {
    return full + comment.prefix.length;
  }
  const only = occurrences(text, comment.quote);
  return only.length === 1 ? only[0] : undefined;
}

/** 本文の文字の中で、コメントごとに箇所を探し、同じ箇所のコメントをまとめ、見つからないものを分ける */
export function locateComments(options: {
  /** 本文の文字 */
  text: string;
  /** 読んだコメント */
  comments: MdmarkComment[];
}): { anchors: CommentAnchor[]; orphans: MdmarkComment[] } {
  const { text, comments } = options;
  const orphans: MdmarkComment[] = [];
  const found = new Map<string, CommentAnchor>();
  for (const comment of comments) {
    const start = findStart(text, comment);
    if (start === undefined) {
      orphans.push(comment);
      continue;
    }
    const end = start + comment.quote.length;
    const key = `${start}:${end}`;
    const anchor = found.get(key);
    if (anchor) {
      anchor.comments.push(comment);
    } else {
      found.set(key, { start, end, comments: [comment] });
    }
  }
  // 始まりの順に並べ、前の箇所と重なる箇所のコメントは見つからないものにする
  const anchors: CommentAnchor[] = [];
  for (const anchor of [...found.values()].sort((a, b) => a.start - b.start)) {
    const previous = anchors.at(-1);
    if (previous && anchor.start < previous.end) {
      orphans.push(...anchor.comments);
    } else {
      anchors.push(anchor);
    }
  }
  return { anchors, orphans };
}
