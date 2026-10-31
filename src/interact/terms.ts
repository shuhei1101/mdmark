import type { TooltipPlacement } from "../config.ts";
import {
  COMMAND_COPY_STATES,
  renderTermTipCopy,
  type TermTipCopyState,
} from "../parts/term-tip.ts";
import { COPIED_NOTICE_MS, copyText } from "./clipboard.ts";
import { chooseTipSide } from "./placement.ts";

// ポインターが語とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）
const CLOSE_DELAY_MS = 150;

// ツールチップと画面の端との間に空ける幅（px）
const VIEWPORT_MARGIN_PX = 16;

// 開いているツールチップを持つ語の枠に付ける class
const OPEN_CLASS = "is-open";
const BELOW_CLASS = "is-below";
const DISMISSED_CLASS = "is-dismissed";

// `id` を重ならせないための、操作を付けた回数の通し番号
let attachCounter = 0;

/** 語に付けた `aria-describedby`・`aria-details` を、振り直した `id` に合わせる */
function renameReferences(options: {
  term: Element;
  oldId: string;
  newId: string;
}): void {
  const { term, oldId, newId } = options;
  for (const name of ["aria-describedby", "aria-details"]) {
    const value = term.getAttribute(name);
    if (value === oldId) {
      term.setAttribute(name, newId);
    } else if (value === `${oldId}-meaning`) {
      term.setAttribute(name, `${newId}-meaning`);
    }
  }
}

/** ツールチップと関連文書の一覧の題の `id` を、ページの中で一意な値に振り直す */
function renumberIds(root: HTMLElement, base: number): void {
  root.querySelectorAll<HTMLElement>(".mdmark-term-wrap").forEach((wrap, i) => {
    const tip = wrap.querySelector<HTMLElement>(".mdmark-term-tip");
    const term = wrap.querySelector(".mdmark-term");
    if (!tip || !term) {
      return;
    }
    const oldId = tip.id;
    const newId = `mdmark-term-${base}-${i}`;
    renameReferences({ term, oldId, newId });
    tip.id = newId;
    const meaning = tip.querySelector<HTMLElement>(
      ".mdmark-term-tip-meaning[id]",
    );
    if (meaning) {
      meaning.id = `${newId}-meaning`;
    }
  });
  root.querySelectorAll<HTMLElement>(".mdmark-backlinks").forEach((nav, i) => {
    const title = nav.querySelector<HTMLElement>(".mdmark-backlinks-title");
    if (title) {
      title.id = `mdmark-backlinks-title-${base}${i === 0 ? "" : `-${i}`}`;
      nav.setAttribute("aria-labelledby", title.id);
    }
  });
}

/** ツールチップを語の上か下（`placement` の側を先に、収まらなければ反対側）に、画面からはみ出さないよう置く。行をまたぐ語は、下なら最後の行、上なら最初の行に付ける */
function place(options: {
  wrap: HTMLElement;
  placement: TooltipPlacement;
}): void {
  const { wrap, placement } = options;
  const rects = wrap.querySelector(".mdmark-term")?.getClientRects();
  const tip = wrap.querySelector<HTMLElement>(".mdmark-term-tip");
  const first = rects?.[0];
  const last = rects?.[rects.length - 1];
  if (!tip || !first || !last) {
    return;
  }
  tip.style.position = "fixed";
  const { width, height } = tip.getBoundingClientRect();
  const below =
    chooseTipSide({
      anchorTop: first.top,
      anchorBottom: last.bottom,
      height,
      gap: 0,
      viewportHeight: window.innerHeight,
      placement,
    }) === "bottom";
  wrap.classList.toggle(BELOW_CLASS, below);
  const anchor = below ? last : first;
  const left = Math.min(
    anchor.left,
    window.innerWidth - width - VIEWPORT_MARGIN_PX,
  );
  tip.style.top = `${below ? last.bottom : first.top - height}px`;
  tip.style.bottom = "auto";
  tip.style.left = `${Math.max(left, VIEWPORT_MARGIN_PX)}px`;
}

/** ツールチップの置いた位置を外す */
function clearPlace(wrap: HTMLElement): void {
  const tip = wrap.querySelector<HTMLElement>(".mdmark-term-tip");
  if (tip) {
    tip.style.position = "";
    tip.style.top = "";
    tip.style.bottom = "";
    tip.style.left = "";
  }
}

/** コピーのボタンの状態・中身と、同じ区分の読み上げの要素の文字を当てる */
function setCopyState(button: HTMLElement, state: TermTipCopyState): void {
  button.dataset.state = state;
  button.innerHTML = renderTermTipCopy(state);
  const status = button
    .closest(".mdmark-term-tip-section")
    ?.querySelector(".mdmark-term-tip-status");
  if (status) {
    status.textContent =
      state === "idle" ? "" : `コマンドを${COMMAND_COPY_STATES[state].text}`;
  }
}

/** mount が描いた用語の下線に、ツールチップを開閉する操作を付け、外す関数を返す */
export function attachTermTips(options: {
  /** 描いた文書の要素 */
  root: HTMLElement;
  /** ツールチップを先に出す側 */
  placement: TooltipPlacement;
}): () => void {
  const { root, placement } = options;
  attachCounter += 1;
  renumberIds(root, attachCounter);
  const wraps = [...root.querySelectorAll<HTMLElement>(".mdmark-term-wrap")];
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  /** ツールチップを閉じ、置いた位置を外す */
  const close = (wrap: HTMLElement): void => {
    clearTimeout(timers.get(wrap));
    wrap.classList.remove(OPEN_CLASS, BELOW_CLASS);
    clearPlace(wrap);
  };
  /** ほかのツールチップを閉じてから開く。Esc で閉じた後は、語を離れるまで開き直さない */
  const open = (wrap: HTMLElement): void => {
    clearTimeout(timers.get(wrap));
    if (wrap.classList.contains(DISMISSED_CLASS)) {
      return;
    }
    for (const other of wraps) {
      if (other !== wrap) {
        close(other);
      }
    }
    wrap.classList.add(OPEN_CLASS);
    place({ wrap, placement });
  };
  /** ポインターもフォーカスも語とツールチップを離れたら、少し待って閉じる */
  const closeLater = (wrap: HTMLElement): void => {
    clearTimeout(timers.get(wrap));
    timers.set(
      wrap,
      setTimeout(() => {
        if (wrap.matches(":hover, :focus-within")) {
          return;
        }
        close(wrap);
        wrap.classList.remove(DISMISSED_CLASS);
      }, CLOSE_DELAY_MS),
    );
  };

  const listeners = wraps.map((wrap) => {
    const handlers: Array<[string, () => void]> = [
      ["pointerenter", () => open(wrap)],
      ["pointerleave", () => closeLater(wrap)],
      ["focusin", () => open(wrap)],
      ["focusout", () => closeLater(wrap)],
    ];
    for (const [type, handler] of handlers) {
      wrap.addEventListener(type, handler);
    }
    return { wrap, handlers };
  });

  /** Esc: 開いているツールチップを閉じる。フォーカスは語に残し、ツールチップの中のリンクにあったときは語へ戻す */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }
    for (const wrap of wraps) {
      if (!wrap.classList.contains(OPEN_CLASS)) {
        continue;
      }
      const tip = wrap.querySelector(".mdmark-term-tip");
      if (tip?.contains(document.activeElement)) {
        wrap.querySelector<HTMLElement>(".mdmark-term")?.focus();
      }
      close(wrap);
      wrap.classList.add(DISMISSED_CLASS);
    }
  };
  /** 画面のスクロールと幅の変化: 開いているツールチップを語に付いて動かす */
  const placeOpen = (): void => {
    for (const wrap of wraps) {
      if (wrap.classList.contains(OPEN_CLASS)) {
        place({ wrap, placement });
      }
    }
  };
  /** 印刷の前: 開いているツールチップを閉じる */
  const closeAll = (): void => {
    for (const wrap of wraps) {
      close(wrap);
    }
  };
  /** コマンドのコピーのボタン: 同じ区分のコマンドをクリップボードへ書き、ボタンと読み上げの要素で知らせる */
  const copyTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  const onCopyClick = async (event: Event): Promise<void> => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("button.mdmark-term-tip-copy")
        : null;
    if (!button) {
      return;
    }
    clearTimeout(copyTimers.get(button));
    const command =
      button.closest(".mdmark-term-tip-command")?.querySelector("code")
        ?.textContent ?? "";
    if (await copyText(command)) {
      setCopyState(button, "copied");
      copyTimers.set(
        button,
        setTimeout(() => setCopyState(button, "idle"), COPIED_NOTICE_MS),
      );
    } else {
      setCopyState(button, "failed");
    }
  };
  root.addEventListener("click", onCopyClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", placeOpen, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", placeOpen);
  window.addEventListener("beforeprint", closeAll);

  return () => {
    root.removeEventListener("click", onCopyClick);
    for (const timer of copyTimers.values()) {
      clearTimeout(timer);
    }
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", placeOpen, { capture: true });
    window.removeEventListener("resize", placeOpen);
    window.removeEventListener("beforeprint", closeAll);
    for (const { wrap, handlers } of listeners) {
      for (const [type, handler] of handlers) {
        wrap.removeEventListener(type, handler);
      }
      close(wrap);
      wrap.classList.remove(DISMISSED_CLASS);
    }
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
  };
}
