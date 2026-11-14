import type { SideTocMode } from "../config.ts";
import { renderSideToc, type SideTocHeading } from "../parts/side-toc.ts";
import { findScrollContainer, type ScrollContainer } from "./scroller.ts";
import { foldAllSections, revealTarget } from "./sections.ts";
import { visibleText } from "./text.ts";

/** `mount` ごとに 1 つ作り、`update` で再描画しても保つ右側の目次の状態 */
export type SideTocState = {
  /** 目次を出すボタンで目次を出しているか */
  open: boolean;
  /** ピン止めしているか */
  pinned: boolean;
};

/** 画面の上端から、今いるセクションを決める線までの高さの、画面の高さに対する割合 */
const CURRENT_LINE_RATIO = 0.25;

/** 描く先の要素の幅がこの値（rem）未満のとき、右側の目次を狭い幅の帯で出す。CSS のコンテナクエリと同じ値 */
const NARROW_WIDTH_REM = 48;

/** 右側の目次に並べる見出し。埋め込んだ HTML の中の見出しは除く */
const SIDE_TOC_HEADING_SELECTOR = "h1[id], h2[id], h3[id]";

/** 埋め込んだ HTML の枠 */
const EMBEDDED_HTML_SELECTOR = ".mdmark-html";

/** hover で開く目次の枠が、右端の線の上端から届かせる高さ（rem）。線 3 本分で、線から枠へポインターを動かしても hover が切れない */
const SIDE_TOC_RAIL_COVER_REM = 2;

/** hover でピン止めしていない右端の線と目次の枠の右端の、スクロールする場所の右端からの間（rem）。先頭へ戻るボタンの `--mdmark-back-to-top-gap` の既定と同じ */
const SIDE_TOC_EDGE_GAP_REM = 1;

/** 差分のミニマップの帯と横の範囲が重なるとき、帯の左端から右端の線と目次の枠の右端までに空ける幅（px）。`BACK_TO_TOP_AVOID_GAP_PX` と同じ値 */
const SIDE_TOC_AVOID_GAP_PX = 8;

/** 右側の目次が回避する、ページに配置する差分のミニマップの帯 */
const MINIMAP_SELECTOR = "body > .mdmark-diff-minimap";

/** hover で開く目次の枠の上端の、見えている枠の上端からのずれ（CSS の長さ） */
const PANEL_OFFSET =
  "calc(var(--mdmark-sticky-top, 0px) + var(--mdmark-space))";

/** 右端の線の下端と、見えている枠・描く先の要素の下端との間（CSS の長さ） */
const RAIL_GAP = "var(--mdmark-space)";

/** 今いるセクションを決める線の帯だけを確認する `IntersectionObserver` の余白（画面の上から線までを帯にする） */
const LINE_BAND_MARGIN = `0px 0px -${(1 - CURRENT_LINE_RATIO) * 100}% 0px`;

/** パネルの ID に続ける通し番号 */
let serial = 0;

/** 本文の中の h1〜h3 の見出しの要素を文書の順に返却する。埋め込んだ HTML の中の見出しは除く */
function headingElements(content: HTMLElement): HTMLElement[] {
  return [
    ...content.querySelectorAll<HTMLElement>(SIDE_TOC_HEADING_SELECTOR),
  ].filter((heading) => heading.closest(EMBEDDED_HTML_SELECTOR) === null);
}

/** 本文の中で色分けしたブロック */
const DIFF_BLOCK_SELECTOR = ".mdmark-diff-block";

/** 変わったセクションを数える見出し。削除のブロックの中の `id` を持たない見出しも含める */
const ALL_HEADING_SELECTOR = "h1, h2, h3";

/** 本文の中の色分けしたブロックごとに、そのブロックが含む見出しか前にある最後の見出しと、その祖先の見出しを集め、`id` を持つ見出しの ID を返却する */
export function findChangedHeadings(content: HTMLElement): Set<string> {
  const changed = new Set<string>();
  const blocks = [
    ...content.querySelectorAll<HTMLElement>(DIFF_BLOCK_SELECTOR),
  ];
  if (blocks.length === 0) {
    return changed;
  }
  const headings = [
    ...content.querySelectorAll<HTMLElement>(ALL_HEADING_SELECTOR),
  ].filter((heading) => heading.closest(EMBEDDED_HTML_SELECTOR) === null);
  const levelOf = (heading: HTMLElement): number =>
    Number(heading.tagName[1]);
  for (const block of blocks) {
    const own = headings.find((heading) => block.contains(heading));
    // 文書の順でブロックより前にある見出し（ブロックが含む見出しを除く）
    const before = headings.filter(
      (heading) =>
        !block.contains(heading) &&
        (block.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_PRECEDING) !==
          0,
    );
    let target = own ?? before.at(-1);
    while (target !== undefined) {
      // `id` を持たない見出し（削除のブロックの中）は目次の項目を持たないため、祖先だけを集める
      if (target.id !== "") {
        changed.add(target.id);
      }
      const level = levelOf(target);
      const index = before.indexOf(target);
      target = (index < 0 ? before : before.slice(0, index))
        .filter((heading) => levelOf(heading) < level)
        .at(-1);
    }
  }
  return changed;
}

/** 本文の中の右側の目次に並べる見出しを文書の順に集め、変わったセクションの見出しに `changed` を付ける */
export function collectSideTocHeadings(content: HTMLElement): SideTocHeading[] {
  const changed = findChangedHeadings(content);
  return headingElements(content).map((heading) => ({
    level: Number(heading.tagName[1]) as SideTocHeading["level"],
    id: heading.id,
    text: visibleText(heading),
    ...(changed.has(heading.id) ? { changed: true } : {}),
  }));
}

/** 画面に出ている見出しの位置から今いるセクションの見出しの ID を決める。上端が線以下の見出しのうち最後のものを返却し、無ければ画面の中にある最初の見出しを返却する */
export function pickCurrentHeading(options: {
  /** 閉じたセクションと選ばれていないタブの中に無い見出しの ID と、画面の上端からの位置（文書の順） */
  headings: { id: string; top: number }[];
  /** 線の位置 */
  line: number;
  /** 画面の高さ */
  viewportHeight: number;
}): string | undefined {
  const { headings, line, viewportHeight } = options;
  const above = headings.filter((heading) => heading.top <= line);
  const picked =
    above[above.length - 1] ??
    headings.find((heading) => heading.top < viewportHeight);
  return picked?.id;
}

/** 右端の線と目次の枠の右端の、画面の右端（スクロールバーを除く）からの距離（px）を返却する。スクロールする場所の右端から 1rem 離し、横の範囲が重なる差分のミニマップの帯があればその左へずらす */
function edgeEnd(options: {
  /** スクロールする場所 */
  scroll: ScrollContainer;
  /** 目次の枠の幅（px） */
  panelWidth: number;
  /** ルートの文字の大きさ（px） */
  rem: number;
}): number {
  const { scroll, panelWidth, rem } = options;
  const { clientWidth } = document.documentElement;
  const { target } = scroll;
  // スクロールする場所の右端: スクロールバーを除き、画面からはみ出す分は画面の端
  const areaRight = scroll.page
    ? clientWidth
    : Math.min(
        target.getBoundingClientRect().left +
          target.clientLeft +
          target.clientWidth,
        clientWidth,
      );
  let right = areaRight - SIDE_TOC_EDGE_GAP_REM * rem;
  // 右端から左へ目次の枠の幅までの横の範囲と重なる帯の左へ、順にずらす
  for (const minimap of document.querySelectorAll<HTMLElement>(
    MINIMAP_SELECTOR,
  )) {
    const rect = minimap.getBoundingClientRect();
    if (
      rect.width === 0 ||
      right - panelWidth >= rect.right ||
      rect.left - SIDE_TOC_AVOID_GAP_PX >= right
    ) {
      continue;
    }
    right = rect.left - SIDE_TOC_AVOID_GAP_PX;
  }
  return clientWidth - right;
}

/** hover で開く目次の枠と右端の線の位置を、スクロールする場所の上端・下端・右端と、aside・描く先の要素・差分のミニマップの帯から決めて aside の CSS 変数に入れる。削除する関数は受け取りを解除する */
function followPanelPosition(el: HTMLElement, aside: HTMLElement): () => void {
  const scroll = findScrollContainer(el);
  const panel = aside.querySelector(".mdmark-side-toc-panel") as HTMLElement;
  // CSS の長さ（rem・px など）を px にするための、見えない要素
  const probe = document.createElement("span");
  probe.hidden = true;
  probe.style.marginTop = PANEL_OFFSET;
  probe.style.marginBottom = RAIL_GAP;
  aside.append(probe);

  const update = (): void => {
    const frame = scroll.page
      ? undefined
      : scroll.target.getBoundingClientRect();
    const viewportHeight = document.documentElement.clientHeight;
    const frameTop = frame ? frame.top : 0;
    const frameBottom = frame
      ? Math.min(frame.bottom, viewportHeight)
      : viewportHeight;
    const probeStyle = getComputedStyle(probe);
    const top = frameTop + Number.parseFloat(probeStyle.marginTop);
    const gap = Number.parseFloat(probeStyle.marginBottom);
    const rem = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize,
    );
    const asideRect = aside.getBoundingClientRect();
    // 右端の線の上端: 文書の先頭では aside の位置、スクロールした後は枠の上端と同じ位置
    const railTop = Math.max(asideRect.top, top);
    // 右端の線の下端: 見えている枠と描く先の要素の両方に収める
    const railBottom = Math.min(frameBottom, el.getBoundingClientRect().bottom);
    const railHeight = Math.max(railBottom - railTop - gap, 0);
    const reach = railTop + SIDE_TOC_RAIL_COVER_REM * rem - top;
    const end = edgeEnd({
      scroll,
      panelWidth: panel.getBoundingClientRect().width,
      rem,
    });
    // 位置を全て読み込んでから記載する（記載した後に再読み込みしてレイアウトをもう一度計算しない）
    aside.style.setProperty("--mdmark-side-toc-panel-top", `${top}px`);
    aside.style.setProperty("--mdmark-side-toc-panel-end", `${end}px`);
    aside.style.setProperty(
      "--mdmark-side-toc-panel-min-height",
      `${Math.max(reach, 0)}px`,
    );
    aside.style.setProperty("--mdmark-side-toc-rail-top", `${railTop}px`);
    aside.style.setProperty("--mdmark-side-toc-rail-height", `${railHeight}px`);
    aside.toggleAttribute("data-rail-outside", railHeight === 0);
  };

  update();
  // スクロールする要素の中でも、画面全体のスクロールで要素の位置が変わるため両方でもう一度決める
  if (!scroll.page) {
    scroll.target.addEventListener("scroll", update, { passive: true });
  }
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  // 差分のミニマップの帯の出し入れ（document.body の子の追加・削除）でも、スクロールを待たずにもう一度決める
  const bodyObserver = new MutationObserver(update);
  bodyObserver.observe(document.body, { childList: true });
  return () => {
    if (!scroll.page) {
      scroll.target.removeEventListener("scroll", update);
    }
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    bodyObserver.disconnect();
    probe.remove();
  };
}

/** 描く先の要素の子を本文の列に包み、その後ろに右側の目次を配置して操作を付ける。見出しが無ければ何も配置しない。削除する関数は包む前の子の並びへ戻す */
export function attachSideToc(options: {
  /** 描く先の要素 */
  el: HTMLElement;
  /** 出し方 */
  mode: SideTocMode;
  /** すべて展開とすべて折りたたむを出すか */
  sections: boolean;
  /** `mount` が保つ状態 */
  state: SideTocState;
}): { content: HTMLElement; aside?: HTMLElement; detach: () => void } {
  const { el, mode, sections, state } = options;
  const headings = collectSideTocHeadings(el);
  if (headings.length === 0) {
    return { content: el, detach: () => {} };
  }
  const content = document.createElement("div");
  content.className = "mdmark-content";
  content.append(...el.childNodes);
  serial += 1;
  const template = document.createElement("template");
  template.innerHTML = renderSideToc({
    headings,
    mode,
    sections,
    open: state.open,
    pinned: state.pinned,
    panelId: `mdmark-side-toc-panel-${serial}`,
  });
  const aside = template.content.firstElementChild as HTMLElement;
  el.append(content, aside);

  const toggle = aside.querySelector<HTMLButtonElement>(
    ".mdmark-side-toc-toggle",
  ) as HTMLButtonElement;
  const pin = aside.querySelector<HTMLButtonElement>(
    ".mdmark-side-toc-pin",
  ) as HTMLButtonElement;
  const links = [
    ...aside.querySelectorAll<HTMLAnchorElement>(".mdmark-side-toc-list a"),
  ];
  const bars = [...aside.querySelectorAll(".mdmark-side-toc-bar")];
  const currentLabel = aside.querySelector(
    ".mdmark-side-toc-current",
  ) as HTMLElement;
  const targets = headingElements(content);

  /** 目次を出すか隠すかを、状態と属性に写す */
  const setOpen = (open: boolean): void => {
    state.open = open;
    aside.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  /** ピン止めするか削除するかを、状態と属性に写す */
  const setPinned = (pinned: boolean): void => {
    state.pinned = pinned;
    aside.toggleAttribute("data-pinned", pinned);
    pin.setAttribute("aria-pressed", String(pinned));
  };

  /** 閉じたセクションと選ばれていないタブの中に無い見出しから今いるセクションを決め、項目・線・狭い幅の帯の文字に写す */
  const updateCurrent = (): void => {
    const visible = targets
      .map((heading, index) => ({ heading, index }))
      .filter(({ heading }) => heading.closest("[hidden]") === null);
    const id = pickCurrentHeading({
      headings: visible.map(({ heading }) => ({
        id: heading.id,
        top: heading.getBoundingClientRect().top,
      })),
      line: window.innerHeight * CURRENT_LINE_RATIO,
      viewportHeight: window.innerHeight,
    });
    const current = visible.find(({ heading }) => heading.id === id)?.index;
    links.forEach((link, index) => {
      if (index === current) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
      bars[index]?.toggleAttribute("data-current", index === current);
    });
    currentLabel.textContent =
      current === undefined ? "" : (links[current]?.textContent ?? "");
  };

  // 今いるセクションは、次の描画のタイミングに 1 回だけもう一度決める
  let frame = 0;
  const requestUpdate = (): void => {
    if (frame === 0) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        updateCurrent();
      });
    }
  };

  const onClick = (event: MouseEvent): void => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const link = event.target.closest<HTMLAnchorElement>(
      ".mdmark-side-toc-list a",
    );
    const foldAll = event.target.closest<HTMLElement>("[data-fold-all]");
    if (event.target.closest(".mdmark-side-toc-toggle")) {
      setOpen(!state.open);
    } else if (event.target.closest(".mdmark-side-toc-pin")) {
      setPinned(!state.pinned);
    } else if (foldAll) {
      foldAllSections({
        root: content,
        open: foldAll.dataset.foldAll === "open",
      });
      requestUpdate();
    } else if (link) {
      // 呼ぶ側が href を書き換えても参照できるよう、見出しは data-heading-id で参照する
      const id = link.dataset.headingId;
      const target = targets.find((heading) => heading.id === id);
      // 既定の動き（URL の # を変える）は止めず、URL が同じでもセクションを開いて移る
      if (target) {
        revealTarget(target);
      }
      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      if (el.getBoundingClientRect().width < NARROW_WIDTH_REM * rem) {
        setOpen(false);
      }
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && state.open) {
      setOpen(false);
      toggle.focus();
    }
  };

  aside.addEventListener("click", onClick);
  aside.addEventListener("keydown", onKeyDown);
  content.addEventListener("click", requestUpdate);
  content.addEventListener("keyup", requestUpdate);
  window.addEventListener("hashchange", requestUpdate);
  // 見出しが画面に出入りしたときと、線の帯に出入りしたときにもう一度決める
  const observers = [
    new IntersectionObserver(requestUpdate),
    new IntersectionObserver(requestUpdate, { rootMargin: LINE_BAND_MARGIN }),
  ];
  for (const observer of observers) {
    for (const heading of targets) {
      observer.observe(heading);
    }
  }
  requestUpdate();
  // hover の出し方だけ、開く目次の枠を見えている枠の上端に合わせる
  const unfollow = mode === "hover" ? followPanelPosition(el, aside) : () => {};

  return {
    content,
    aside,
    detach: () => {
      unfollow();
      aside.removeEventListener("click", onClick);
      aside.removeEventListener("keydown", onKeyDown);
      content.removeEventListener("click", requestUpdate);
      content.removeEventListener("keyup", requestUpdate);
      window.removeEventListener("hashchange", requestUpdate);
      for (const observer of observers) {
        observer.disconnect();
      }
      cancelAnimationFrame(frame);
      content.replaceWith(...content.childNodes);
      aside.remove();
    },
  };
}
