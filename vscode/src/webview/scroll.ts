/** 元の行番号と、スクロールする要素の先頭からの位置 */
export type Anchor = {
  /** 元の行番号（0 始まり） */
  line: number;
  /** スクロールする要素の先頭からの位置（px） */
  top: number;
};

/** 描いた文書の `data-source-line` を持つ要素を、位置の順に `Anchor` にして返す。同じ行は最初の要素だけ、見えていない要素（高さ 0）と、行や位置が戻る要素は除く */
export function collectAnchors(options: {
  /** 描いた文書の要素 */
  root: HTMLElement;
  /** スクロールする要素 */
  scroller: Element;
}): Anchor[] {
  const { root, scroller } = options;
  // 画面がスクロールするときは、文書の先頭からの位置は `getBoundingClientRect().top` に `scrollTop` を足した値
  const page =
    scroller === document.scrollingElement ||
    scroller === document.documentElement;
  const origin = page ? 0 : scroller.getBoundingClientRect().top;
  const anchors: Anchor[] = [];
  for (const element of root.querySelectorAll<HTMLElement>(
    "[data-source-line]",
  )) {
    const rect = element.getBoundingClientRect();
    const line = Number(element.dataset.sourceLine);
    const top = rect.top - origin + scroller.scrollTop;
    const last = anchors.at(-1);
    if (
      rect.height === 0 ||
      !Number.isInteger(line) ||
      (last !== undefined && (line <= last.line || top <= last.top))
    ) {
      continue;
    }
    anchors.push({ line, top });
  }
  return anchors;
}

/** `matches` を満たす最後の印の位置。無ければ `-1` */
function lastIndexOf(
  anchors: Anchor[],
  matches: (anchor: Anchor) => boolean,
): number {
  for (let index = anchors.length - 1; index >= 0; index -= 1) {
    if (matches(anchors[index] as Anchor)) {
      return index;
    }
  }
  return -1;
}

/** 行以下の最後の印と次の印の間を、行の割合で内分した位置を返す。印が無いか最初の印より前は 0、最後の印より後は最後の印の位置 */
export function topForLine(anchors: Anchor[], line: number): number {
  const first = anchors[0];
  if (first === undefined || line < first.line) {
    return 0;
  }
  const index = lastIndexOf(anchors, (anchor) => anchor.line <= line);
  const before = anchors[index] as Anchor;
  const after = anchors[index + 1];
  if (after === undefined) {
    return before.top;
  }
  const ratio = (line - before.line) / (after.line - before.line);
  return before.top + ratio * (after.top - before.top);
}

/** 位置の前後の印の間で内分した行番号を、整数に切り捨てて返す。印が無いか最初の印より前は 0、最後の印より後は最後の印の行 */
export function lineForTop(anchors: Anchor[], top: number): number {
  const first = anchors[0];
  if (first === undefined || top < first.top) {
    return 0;
  }
  const index = lastIndexOf(anchors, (anchor) => anchor.top <= top);
  const before = anchors[index] as Anchor;
  const after = anchors[index + 1];
  if (after === undefined) {
    return before.line;
  }
  const ratio = (top - before.top) / (after.top - before.top);
  return Math.floor(before.line + ratio * (after.line - before.line));
}
