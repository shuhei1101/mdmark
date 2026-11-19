import { stickyRange, stickyShift } from "./table.logic.ts";

/** `attachStickyRows` が表ごとの留める要素（表を包む横のスクロールの要素。無ければ `table`）に付ける属性。値は `timeline`（`animation-timeline` でずらす）か `script`（JS でずらす量を入れる）で、CSS はこの属性で適用する規則を分ける */
export const STICKY_MODE_ATTRIBUTE = "data-mdmark-sticky";

/** スクロール連動のアニメーションと、その範囲の指定を持つブラウザか */
const TIMELINE_SUPPORT =
  "(animation-timeline: view()) and (animation-range: 0% 100%)";

/** 表に入れる CSS カスタムプロパティの名前 */
const TIMELINE_VARIABLES = [
  "--mdmark-sticky-head-start",
  "--mdmark-sticky-head-max",
  "--mdmark-sticky-foot-max",
  "--mdmark-sticky-foot-end",
] as const;
const SCRIPT_VARIABLES = [
  "--mdmark-sticky-head-shift",
  "--mdmark-sticky-foot-shift",
  "--mdmark-sticky-foot-reach",
] as const;

/** 見出し行を留める位置の、スクロールする場所の上端からのずれ（px）。利用側が指定した `--mdmark-sticky-top` を読み込む */
function stickyTopOf(table: HTMLElement): number {
  const value = getComputedStyle(table).getPropertyValue("--mdmark-sticky-top");
  return Number.parseFloat(value) || 0;
}

/** 表を包む横のスクロールの要素の class（部品『表』の HTML） */
const SCROLL_CLASS = "mdmark-table-scroll";

/** 留める要素（属性と `view-timeline` を付ける要素）。表を包む要素があればそれにする（包む要素は横にスクロールする要素のため、表に付けるとタイムラインがページでなく包む要素のスクロールに従う） */
function timelineSubject(table: HTMLTableElement): HTMLElement {
  const parent = table.parentElement;
  return parent?.classList.contains(SCROLL_CLASS) === true ? parent : table;
}

/** 縦にスクロールする要素として扱う `overflow-y` の計算値 */
const SCROLLING_OVERFLOW = new Set(["auto", "scroll", "hidden"]);

/** 留める要素の親から祖先へたどって、最初に条件を満たす要素を返却する。無ければ画面（`null`） */
function closestAncestor(
  subject: HTMLElement,
  matches: (element: HTMLElement) => boolean,
): HTMLElement | null {
  for (
    let element = subject.parentElement;
    element !== null && element !== document.body;
    element = element.parentElement
  ) {
    if (matches(element)) {
      return element;
    }
  }
  return null;
}

/** スクロールする場所: 縦にはみ出していて縦にスクロールする最も近い祖先（横にだけスクロールする要素は選ばない）。無ければ画面（`null`） */
function scrollContainerOf(subject: HTMLElement): HTMLElement | null {
  return closestAncestor(
    subject,
    (element) =>
      SCROLLING_OVERFLOW.has(getComputedStyle(element).overflowY) &&
      element.scrollHeight > element.clientHeight,
  );
}

/** `view-timeline` が従う、最も近いスクロールコンテナ。無ければ画面（`null`） */
function timelineContainerOf(subject: HTMLElement): HTMLElement | null {
  return closestAncestor(subject, (element) => {
    const overflow = getComputedStyle(element).overflowY;
    return overflow !== "visible" && overflow !== "clip";
  });
}

/** スクロールする場所の上端と下端の、画面の中の位置 */
function scrollEdges(container: HTMLElement | null): {
  top: number;
  bottom: number;
} {
  if (container === null) {
    return { top: 0, bottom: document.documentElement.clientHeight };
  }
  const top = container.getBoundingClientRect().top + container.clientTop;
  return { top, bottom: top + container.clientHeight };
}

/** 表の見出し行・本文・集計の行の、ずらす前の画面の中の位置を測る */
function measure(table: HTMLTableElement) {
  const body = table.tBodies[0]?.getBoundingClientRect();
  if (!table.tHead || !body) {
    return undefined;
  }
  const head = table.tHead.getBoundingClientRect();
  const foot = table.tFoot?.getBoundingClientRect();
  return {
    tableRect: timelineSubject(table).getBoundingClientRect(),
    head,
    body,
    foot,
  };
}

/** 表ごとの留め方 */
type StickyMode = "timeline" | "script";

/** 留め方の CSS 変数を表から取り除く */
function clearVariables(table: HTMLTableElement, mode: StickyMode): void {
  for (const name of mode === "timeline"
    ? TIMELINE_VARIABLES
    : SCRIPT_VARIABLES) {
    table.style.removeProperty(name);
  }
}

/** 受け取りの `px` の文字にする */
const px = (value: number): string => `${value}px`;

/** `animation-timeline` を持つブラウザで、見出し行と集計の行が動ける範囲を CSS 変数に入れる */
function updateTimelineRange(table: HTMLTableElement): void {
  const measured = measure(table);
  if (!measured) {
    return;
  }
  const { tableRect, head, body, foot } = measured;
  const range = stickyRange({
    tableTop: tableRect.top,
    tableBottom: tableRect.bottom,
    headTop: head.top,
    headBottom: head.bottom,
    bodyTop: body.top,
    bodyBottom: body.bottom,
    footTop: foot?.top,
    footBottom: foot?.bottom,
  });
  table.style.setProperty("--mdmark-sticky-head-start", px(range.headStart));
  table.style.setProperty("--mdmark-sticky-head-max", px(range.headMax));
  if (foot) {
    table.style.setProperty("--mdmark-sticky-foot-max", px(range.footMax));
    table.style.setProperty("--mdmark-sticky-foot-end", px(range.footEnd));
  }
}

/** `animation-timeline` を持たないブラウザで、見出し行と集計の行をずらす量を CSS 変数に入れる */
function updateShift(table: HTMLTableElement): void {
  const measured = measure(table);
  if (!measured) {
    return;
  }
  const { head, body, foot } = measured;
  const edges = scrollEdges(scrollContainerOf(timelineSubject(table)));
  const shift = stickyShift({
    stickyTop: edges.top + stickyTopOf(table),
    viewportBottom: edges.bottom,
    headTop: head.top,
    headBottom: head.bottom,
    bodyTop: body.top,
    bodyBottom: body.bottom,
    footTop: foot?.top,
    footBottom: foot?.bottom,
  });
  table.style.setProperty("--mdmark-sticky-head-shift", px(shift.head));
  if (foot) {
    table.style.setProperty("--mdmark-sticky-foot-shift", px(shift.foot));
    // 下端に留めている間だけ、最後の行の面を下へはみ出させる
    table.style.setProperty(
      "--mdmark-sticky-foot-reach",
      shift.foot < 0 ? "2px" : "0px",
    );
  }
}

/** `root` の中の本文の行を持つ全ての表の見出し行をスクロールする場所の上端（`--mdmark-sticky-top`）に、集計の行をその下端に、表がスクロールする場所にかかっている間だけ留める。受け取りと `ResizeObserver` を削除し、属性と CSS 変数を取り除く関数を返却する */
export function attachStickyRows(root: HTMLElement): () => void {
  const timelineSupported = CSS.supports(TIMELINE_SUPPORT);
  const tables = [...root.querySelectorAll<HTMLTableElement>("table")].filter(
    (table) => table.tHead !== null && (table.tBodies[0]?.rows.length ?? 0) > 0,
  );
  /** 表ごとの留め方。スクロールする場所が変わると選び直す */
  const modes = new Map<HTMLTableElement, StickyMode>();
  const observer = new ResizeObserver(() => updateAll());
  const observed = new Set<Element>();
  /** 表の留め方とスクロールする場所を選び直し、留め方が変わった表は前の留め方の CSS 変数を取り除く */
  const chooseMode = (table: HTMLTableElement): StickyMode => {
    const subject = timelineSubject(table);
    const container = scrollContainerOf(subject);
    if (container !== null && !observed.has(container)) {
      // 区画の高さが変わると留める下端が変わるため、スクロールする場所の要素も監視する
      observed.add(container);
      observer.observe(container);
    }
    const mode: StickyMode =
      timelineSupported && timelineContainerOf(subject) === container
        ? "timeline"
        : "script";
    const previous = modes.get(table);
    if (previous !== mode) {
      if (previous !== undefined) {
        clearVariables(table, previous);
      }
      modes.set(table, mode);
      subject.setAttribute(STICKY_MODE_ATTRIBUTE, mode);
    }
    return mode;
  };
  const updateAll = (): void => {
    for (const table of tables) {
      const mode = chooseMode(table);
      (mode === "timeline" ? updateTimelineRange : updateShift)(table);
    }
  };
  for (const table of tables) {
    observer.observe(table);
  }
  updateAll();
  // 動かすのが JS の表は、スクロールのたびに 1 フレームに 1 回だけもう一度求める
  let frame: number | undefined;
  const onScroll = (): void => {
    if (frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      for (const [table, mode] of modes) {
        if (mode === "script") {
          updateShift(table);
        }
      }
    });
  };
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("resize", onScroll);
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onScroll);
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    for (const [table, mode] of modes) {
      timelineSubject(table).removeAttribute(STICKY_MODE_ATTRIBUTE);
      clearVariables(table, mode);
    }
    modes.clear();
  };
}
