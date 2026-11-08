import {
  type CommentClosedKind,
  renderCommentMarker,
} from "../parts/comment.ts";

/** 箇所の行の上端の差がこの値以下なら、同じ行として 1 つのマーカーにまとめる（px） */
export const SAME_LINE_PX = 4;

/** 上下に並んだマーカーの間に空ける幅（px） */
export const MARKER_GAP_PX = 4;

/** 閉じた中の箇所へ移るとき、入れ子の閉じた要素を外側から開く処理を繰り返す上限 */
export const MAX_OPEN_DEPTH = 4;

/** 箇所の行の上端と高さ（px） */
type Line = { top: number; height: number };

/** マーカーを配置する基準 */
type Anchor = {
  /** コメントのマーカー */
  mark: HTMLElement;
  /** 縦の位置を測る要素（マーカーか、閉じた要素を開くボタン） */
  target: Element;
  /** 箇所を包む、いちばん外側の閉じた要素の種類 */
  closed?: CommentClosedKind;
};

/** 行の上端と高さの並びから、同じ行をまとめ、重ならないように下げたマーカーの縦の中ほどを返却する */
export function layoutMarkers(options: {
  /** 箇所ごとの行の上端と高さ（並びは問わない） */
  lines: Line[];
  /** マーカーの高さ（px） */
  markerSize: number;
}): Array<{ center: number; indexes: number[] }> {
  const { lines, markerSize } = options;
  const order = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.top - b.line.top);
  // 上端の近い行を、まとまりの最初の行と比べて 1 つにまとめる
  const groups: Array<{ first: Line; indexes: number[] }> = [];
  for (const { line, index } of order) {
    const last = groups.at(-1);
    if (last && line.top - last.first.top <= SAME_LINE_PX) {
      last.indexes.push(index);
    } else {
      groups.push({ first: line, indexes: [index] });
    }
  }
  let previous = Number.NEGATIVE_INFINITY;
  return groups.map(({ first, indexes }) => {
    const center = Math.max(
      first.top + first.height / 2,
      previous + markerSize + MARKER_GAP_PX,
    );
    previous = center;
    return { center, indexes };
  });
}

/** マーカーを包む `hidden` の祖先のうち、いちばん外側の要素を返却する */
function outermostHidden(
  mark: HTMLElement,
  content: HTMLElement,
): HTMLElement | undefined {
  let found: HTMLElement | undefined;
  for (
    let el = mark.parentElement;
    el && el !== content;
    el = el.parentElement
  ) {
    if (el.hidden) {
      found = el;
    }
  }
  return found;
}

/** 閉じた要素を `aria-controls` で指す開くボタンを返却する */
function openerOf(
  hidden: HTMLElement,
  content: HTMLElement,
): HTMLElement | undefined {
  if (hidden.id === "") {
    return undefined;
  }
  return (
    content.querySelector<HTMLElement>(
      `[aria-controls="${CSS.escape(hidden.id)}"]`,
    ) ?? undefined
  );
}

/** 閉じた要素の種類を返却する */
function closedKindOf(hidden: HTMLElement): CommentClosedKind {
  if (hidden.matches('[role="tabpanel"]')) {
    return "tab";
  }
  if (hidden.matches(".mdmark-row-detail")) {
    return "row";
  }
  return "section";
}

/** 本文の列の右に余白の列を配置し、マーカーの行の縦の中ほどに余白のマーカーを配置して、押すとマーカーへ移る操作と再配置を付け、削除する関数を返却する */
export function attachMarginMarkers(options: {
  /** 本文の列（`div.mdmark-content`） */
  content: HTMLElement;
}): () => void {
  const { content } = options;
  const margin = document.createElement("div");
  margin.className = "mdmark-comment-margin";
  content.after(margin);
  let frame = 0;
  let detached = false;

  /** マーカーごとに、縦の位置を測る要素と閉じた中の種類を求める。開くボタンの無い閉じた中のマーカーは除く */
  const collectAnchors = (): Anchor[] =>
    [
      ...content.querySelectorAll<HTMLElement>("mark.mdmark-comment-mark"),
    ].flatMap((mark): Anchor[] => {
      const hidden = outermostHidden(mark, content);
      if (!hidden) {
        return [{ mark, target: mark }];
      }
      const opener = openerOf(hidden, content);
      return opener
        ? [{ mark, target: opener, closed: closedKindOf(hidden) }]
        : [];
    });

  /** 閉じた中を外側から開き、マーカーを画面の中ほどまでスクロールして押す */
  const jump = (mark: HTMLElement): void => {
    for (let depth = 0; depth < MAX_OPEN_DEPTH; depth += 1) {
      const hidden = outermostHidden(mark, content);
      if (!hidden) {
        break;
      }
      openerOf(hidden, content)?.click();
    }
    mark.scrollIntoView({ block: "center" });
    mark.click();
  };

  /** 今のマーカーの位置で、マーカーを全てもう一度配置する */
  const place = (): void => {
    frame = 0;
    const anchors = collectAnchors();
    const base = margin.getBoundingClientRect().top;
    const lines = anchors.map(({ target }): Line => {
      const rect = target.getClientRects()[0] ?? target.getBoundingClientRect();
      return { top: rect.top - base, height: rect.height };
    });
    // まとまりを決めてからマーカーを描き、描いたマーカーの高さで重なりを回避する
    const groups = layoutMarkers({ lines, markerSize: 0 });
    const markers = groups.map(({ indexes }) => {
      const group = indexes.map((index) => anchors[index] as Anchor);
      const [first] = group as [Anchor, ...Anchor[]];
      const template = document.createElement("template");
      template.innerHTML = renderCommentMarker({
        quote: first.mark.textContent ?? "",
        count: group.length,
        current: group.some(
          ({ mark }) => mark.getAttribute("aria-expanded") === "true",
        ),
        ...(first.closed === undefined ? {} : { closed: first.closed }),
      });
      const button = template.content.firstElementChild as HTMLButtonElement;
      button.addEventListener("click", () => jump(first.mark));
      return button;
    });
    // 再作成してもフォーカスを失わないよう、フォーカスのあったマーカーの順番を記録して戻す
    const focused = [...margin.children].indexOf(
      document.activeElement as Element,
    );
    margin.replaceChildren(...markers);
    if (focused >= 0) {
      markers[Math.min(focused, markers.length - 1)]?.focus();
    }
    const markerSize = markers[0]?.offsetHeight ?? 0;
    layoutMarkers({ lines, markerSize }).forEach(({ center }, index) => {
      const marker = markers[index];
      if (marker) {
        marker.style.top = `${center}px`;
      }
    });
  };

  /** 再配置を 1 フレームに 1 回にまとめる */
  const schedule = (): void => {
    if (!detached && frame === 0) {
      frame = requestAnimationFrame(place);
    }
  };

  const mutations = new MutationObserver(schedule);
  mutations.observe(content, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden", "aria-expanded", "class"],
  });
  const resizes = new ResizeObserver(schedule);
  if (content.parentElement) {
    resizes.observe(content.parentElement);
  }
  schedule();

  return () => {
    detached = true;
    cancelAnimationFrame(frame);
    frame = 0;
    mutations.disconnect();
    resizes.disconnect();
    margin.remove();
  };
}
