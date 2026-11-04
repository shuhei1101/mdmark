import type { TooltipPlacement } from "../config.ts";
import { chooseTipSide } from "./placement.ts";
import { openEnclosing } from "./sections.ts";

// ポインターが番号とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）
const CLOSE_DELAY_MS = 150;

// ツールチップと画面の端との間に空ける幅（px）
const VIEWPORT_MARGIN_PX = 16;

// 開いているツールチップを持つ番号に付ける class
const OPEN_CLASS = "is-open";
const BELOW_CLASS = "is-below";
const DISMISSED_CLASS = "is-dismissed";

// 振り直す `id` の頭（長い頭から当てる）
const ID_PREFIXES = ["mdmark-fn-tip-", "mdmark-fnref-", "mdmark-fn-"];

// 振り直した `id` を指す属性
const POINTER_ATTRIBUTES = ["aria-describedby", "aria-details"];

// `id` を重ならせないための、操作を付けた回数の通し番号
let attachCounter = 0;

/** 番号・ツールチップ・一覧の項目の `id` を、ページの中で一意な値に振り直し、それを指す `href`・`aria-describedby`・`aria-details` も直す */
function renumberIds(root: HTMLElement, base: number): void {
  const renamed = new Map<string, string>();
  for (const element of root.querySelectorAll<HTMLElement>(
    ".mdmark-fn-link[id], .mdmark-fn-tip[id], .mdmark-fn-item[id]",
  )) {
    const prefix = ID_PREFIXES.find((head) => element.id.startsWith(head));
    if (prefix === undefined) {
      continue;
    }
    const newId = `${prefix}${base}-${element.id.slice(prefix.length)}`;
    renamed.set(element.id, newId);
    element.id = newId;
  }
  for (const element of root.querySelectorAll<HTMLElement>(
    ".mdmark-fn-link, .mdmark-fn-back",
  )) {
    const href = element.getAttribute("href") ?? "";
    const target = renamed.get(href.slice(1));
    if (href.startsWith("#") && target !== undefined) {
      element.setAttribute("href", `#${target}`);
    }
    for (const name of POINTER_ATTRIBUTES) {
      const pointed = renamed.get(element.getAttribute(name) ?? "");
      if (pointed !== undefined) {
        element.setAttribute(name, pointed);
      }
    }
  }
}

/** ツールチップを番号の上か下（`placement` の側を先に、収まらなければ反対側）に、画面からはみ出さないよう置く */
function place(options: {
  ref: HTMLElement;
  placement: TooltipPlacement;
}): void {
  const { ref, placement } = options;
  const anchor = ref.querySelector(".mdmark-fn-link")?.getBoundingClientRect();
  const tip = ref.querySelector<HTMLElement>(".mdmark-fn-tip");
  if (!tip || !anchor) {
    return;
  }
  tip.style.position = "fixed";
  const { width, height } = tip.getBoundingClientRect();
  const below =
    chooseTipSide({
      anchorTop: anchor.top,
      anchorBottom: anchor.bottom,
      height,
      gap: 0,
      viewportHeight: window.innerHeight,
      placement,
    }) === "bottom";
  ref.classList.toggle(BELOW_CLASS, below);
  const left = Math.min(
    anchor.left,
    window.innerWidth - width - VIEWPORT_MARGIN_PX,
  );
  tip.style.top = `${below ? anchor.bottom : anchor.top - height}px`;
  tip.style.bottom = "auto";
  tip.style.left = `${Math.max(left, VIEWPORT_MARGIN_PX)}px`;
}

/** ツールチップの置いた位置を外す */
function clearPlace(ref: HTMLElement): void {
  const tip = ref.querySelector<HTMLElement>(".mdmark-fn-tip");
  if (tip) {
    tip.style.position = "";
    tip.style.top = "";
    tip.style.bottom = "";
    tip.style.left = "";
  }
}

/** `root` の中から、`href` の `#` の後ろの `id` の要素を引く */
function targetOf(root: HTMLElement, link: Element): HTMLElement | null {
  const href = link.getAttribute("href") ?? "";
  return href.startsWith("#")
    ? root.querySelector<HTMLElement>(`[id="${CSS.escape(href.slice(1))}"]`)
    : null;
}

/** mount が描いた脚注の番号にツールチップを開閉する操作を、番号と末尾の一覧の項目に行き来する操作を付け、外す関数を返す */
export function attachFootnotes(options: {
  /** 描いた文書の要素 */
  root: HTMLElement;
  /** ツールチップを先に出す側 */
  placement: TooltipPlacement;
}): () => void {
  const { root, placement } = options;
  attachCounter += 1;
  renumberIds(root, attachCounter);
  const refs = [...root.querySelectorAll<HTMLElement>(".mdmark-fn-ref")];
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  /** ツールチップを閉じ、置いた位置を外す */
  const close = (ref: HTMLElement): void => {
    clearTimeout(timers.get(ref));
    ref.classList.remove(OPEN_CLASS, BELOW_CLASS);
    clearPlace(ref);
  };
  /** ほかのツールチップを閉じてから開く。Esc で閉じた後と番号を押した後は、番号を離れるまで開き直さない */
  const open = (ref: HTMLElement): void => {
    clearTimeout(timers.get(ref));
    if (ref.classList.contains(DISMISSED_CLASS)) {
      return;
    }
    for (const other of refs) {
      if (other !== ref) {
        close(other);
      }
    }
    ref.classList.add(OPEN_CLASS);
    place({ ref, placement });
  };
  /** ポインターもフォーカスも番号とツールチップを離れたら、少し待って閉じる */
  const closeLater = (ref: HTMLElement): void => {
    clearTimeout(timers.get(ref));
    timers.set(
      ref,
      setTimeout(() => {
        if (ref.matches(":hover, :focus-within")) {
          return;
        }
        close(ref);
        ref.classList.remove(DISMISSED_CLASS);
      }, CLOSE_DELAY_MS),
    );
  };

  const listeners = refs.map((ref) => {
    const handlers: Array<[string, () => void]> = [
      ["pointerenter", () => open(ref)],
      ["pointerleave", () => closeLater(ref)],
      ["focusin", () => open(ref)],
      ["focusout", () => closeLater(ref)],
    ];
    for (const [type, handler] of handlers) {
      ref.addEventListener(type, handler);
    }
    return { ref, handlers };
  });

  /** 番号を押す: 閉じた一覧を開き、該当の項目を画面に入れてフォーカスを移す。戻るリンクを押す: 番号を画面に入れてフォーカスを移す。どちらも URL の `#` を書き換えない */
  const onClick = (event: MouseEvent): void => {
    const link =
      event.target instanceof Element
        ? event.target.closest(".mdmark-fn-link, .mdmark-fn-back")
        : null;
    if (!link || !root.contains(link)) {
      return;
    }
    const target = targetOf(root, link);
    if (!target) {
      return;
    }
    event.preventDefault();
    const ref = link.closest<HTMLElement>(".mdmark-fn-ref");
    // 移った先に重ならないよう、ポインターが番号を離れるまで開き直さない
    if (ref) {
      close(ref);
      ref.classList.add(DISMISSED_CLASS);
      const list = target.closest("details");
      if (list) {
        list.open = true;
      }
      target.setAttribute("tabindex", "-1");
    }
    // 移る先を囲む閉じた節・選ばれていないタブ・閉じた行の詳細を開く
    openEnclosing(target);
    target.scrollIntoView({ block: "center" });
    target.focus();
  };

  /** Esc: 開いているツールチップを閉じる。フォーカスは番号に残し、ツールチップの中のリンクにあったときは番号へ戻す */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") {
      return;
    }
    for (const ref of refs) {
      if (!ref.classList.contains(OPEN_CLASS)) {
        continue;
      }
      if (
        ref.querySelector(".mdmark-fn-tip")?.contains(document.activeElement)
      ) {
        ref.querySelector<HTMLElement>(".mdmark-fn-link")?.focus();
      }
      close(ref);
      ref.classList.add(DISMISSED_CLASS);
    }
  };
  /** 画面のスクロールと幅の変化: 開いているツールチップを番号に付いて動かす */
  const placeOpen = (): void => {
    for (const ref of refs) {
      if (ref.classList.contains(OPEN_CLASS)) {
        place({ ref, placement });
      }
    }
  };
  /** 印刷の前: 開いているツールチップを閉じる */
  const closeAll = (): void => {
    for (const ref of refs) {
      close(ref);
    }
  };
  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", placeOpen, {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", placeOpen);
  window.addEventListener("beforeprint", closeAll);

  return () => {
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", placeOpen, { capture: true });
    window.removeEventListener("resize", placeOpen);
    window.removeEventListener("beforeprint", closeAll);
    for (const { ref, handlers } of listeners) {
      for (const [type, handler] of handlers) {
        ref.removeEventListener(type, handler);
      }
      close(ref);
      ref.classList.remove(DISMISSED_CLASS);
    }
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
  };
}
