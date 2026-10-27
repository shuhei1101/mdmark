import type { SideTocMode } from "../config.ts";
import { renderSideToc, type SideTocHeading } from "../parts/side-toc.ts";
import { foldAllSections, revealTarget } from "./sections.ts";
import { visibleText } from "./text.ts";

/** `mount` ごとに 1 つ作り、`update` で描き直しても保つ右側の目次の状態 */
export type SideTocState = {
  /** 目次を出すボタンで目次を出しているか */
  open: boolean;
  /** ピン止めしているか */
  pinned: boolean;
};

/** 画面の上端から、今いる節を決める線までの高さの、画面の高さに対する割合 */
const CURRENT_LINE_RATIO = 0.25;

/** 描く先の要素の幅がこの値（rem）未満のとき、右側の目次を狭い幅の帯で出す。CSS のコンテナクエリと同じ値 */
const NARROW_WIDTH_REM = 48;

/** 右側の目次に並べる見出し。埋め込んだ HTML の中の見出しは除く */
const SIDE_TOC_HEADING_SELECTOR = "h1[id], h2[id], h3[id]";

/** 埋め込んだ HTML の枠 */
const EMBEDDED_HTML_SELECTOR = ".mdmark-html";

/** 今いる節を決める線の帯だけを見る `IntersectionObserver` の余白（画面の上から線までを帯にする） */
const LINE_BAND_MARGIN = `0px 0px -${(1 - CURRENT_LINE_RATIO) * 100}% 0px`;

/** パネルの ID に続ける通し番号 */
let serial = 0;

/** 本文の中の h1〜h3 の見出しの要素を文書の順に返す。埋め込んだ HTML の中の見出しは除く */
function headingElements(content: HTMLElement): HTMLElement[] {
  return [
    ...content.querySelectorAll<HTMLElement>(SIDE_TOC_HEADING_SELECTOR),
  ].filter((heading) => heading.closest(EMBEDDED_HTML_SELECTOR) === null);
}

/** 本文の中の右側の目次に並べる見出しを文書の順に集める */
export function collectSideTocHeadings(content: HTMLElement): SideTocHeading[] {
  return headingElements(content).map((heading) => ({
    level: Number(heading.tagName[1]) as SideTocHeading["level"],
    id: heading.id,
    text: visibleText(heading),
  }));
}

/** 画面に出ている見出しの位置から今いる節の見出しの ID を決める。上端が線以下の見出しのうち最後のものを返し、無ければ画面の中にある最初の見出しを返す */
export function pickCurrentHeading(options: {
  /** 閉じた節と選ばれていないタブの中に無い見出しの ID と、画面の上端からの位置（文書の順） */
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

/** 描く先の要素の子を本文の列に包み、その後ろに右側の目次を置いて操作を付ける。見出しが無ければ何も置かない。外す関数は包む前の子の並びへ戻す */
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

  /** ピン止めするか外すかを、状態と属性に写す */
  const setPinned = (pinned: boolean): void => {
    state.pinned = pinned;
    aside.toggleAttribute("data-pinned", pinned);
    pin.setAttribute("aria-pressed", String(pinned));
  };

  /** 閉じた節と選ばれていないタブの中に無い見出しから今いる節を決め、項目・線・狭い幅の帯の文字に写す */
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

  // 今いる節は、次の描画のタイミングに 1 回だけ決め直す
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
      const id = (link.getAttribute("href") ?? "").slice(1);
      const target = targets.find((heading) => heading.id === id);
      // 既定の動き（URL の # を変える）は止めず、URL が同じでも節を開いて移る
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
  // 見出しが画面に出入りしたときと、線の帯に出入りしたときに決め直す
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

  return {
    content,
    aside,
    detach: () => {
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
