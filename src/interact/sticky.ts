import { stickyRange, stickyShift } from "../table-logic.ts";

/** `attachStickyRows` が描く先の要素に付ける属性。値は `timeline`（`animation-timeline` でずらす）か `script`（JS でずらす量を入れる）で、CSS はこの属性で当てる規則を分ける */
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

/** 見出し行を留める位置の、画面の上端からのずれ（px）。使う側が渡した `--mdmark-sticky-top` を読む */
function stickyTopOf(table: HTMLElement): number {
  const value = getComputedStyle(table).getPropertyValue("--mdmark-sticky-top");
  return Number.parseFloat(value) || 0;
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
    tableRect: table.getBoundingClientRect(),
    head,
    body,
    foot,
  };
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
  const shift = stickyShift({
    stickyTop: stickyTopOf(table),
    viewportBottom: document.documentElement.clientHeight,
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

/** 各 `mdmark-table` の見出し行を画面の上端（`--mdmark-sticky-top`）に、集計の行を画面の下端に、表が画面にかかっている間だけ留める。受け取りと `ResizeObserver` を外し、属性と CSS 変数を取り除く関数を返す */
export function attachStickyRows(root: HTMLElement): () => void {
  const timeline = CSS.supports(TIMELINE_SUPPORT);
  const update = timeline ? updateTimelineRange : updateShift;
  const variables = timeline ? TIMELINE_VARIABLES : SCRIPT_VARIABLES;
  const tables = [
    ...root.querySelectorAll<HTMLTableElement>(".mdmark-table table"),
  ].filter((table) => (table.tBodies[0]?.rows.length ?? 0) > 0);
  root.setAttribute(STICKY_MODE_ATTRIBUTE, timeline ? "timeline" : "script");
  const updateAll = (): void => {
    for (const table of tables) {
      update(table);
    }
  };
  const observer = new ResizeObserver(updateAll);
  for (const table of tables) {
    observer.observe(table);
  }
  updateAll();
  // 動かすのが JS のときは、スクロールのたびに 1 フレームに 1 回だけ求め直す
  let frame: number | undefined;
  const onScroll = (): void => {
    if (frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      updateAll();
    });
  };
  if (!timeline) {
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onScroll);
  }
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("resize", onScroll);
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    root.removeAttribute(STICKY_MODE_ATTRIBUTE);
    for (const table of tables) {
      for (const name of variables) {
        table.style.removeProperty(name);
      }
    }
  };
}
