import type { TooltipPlacement } from "../config.ts";
import { chooseTipSide } from "./placement.ts";

// ポインターが持ち主とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）
const CLOSE_DELAY_MS = 150;

// ツールチップと持ち主の間・画面の端との間に空ける幅（px）
const TIP_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 16;

// 開いているツールチップの線に付ける class
const ACTIVE_CLASS = "is-active";

// 開いているヒントの要素に付ける class
const HINT_OPEN_CLASS = "is-hint-open";

// 埋め込んだ HTML のヒントの持ち主（ブロックの要素の印・行内の要素）と、ツールチップの class
const HINT_OWNER_SELECTOR = ".mdmark-hint-mark, .mdmark-hint-inline";
const HINT_HOST_SELECTOR = ".mdmark-hint-block, .mdmark-hint-inline";
const HINT_TIP_CLASS = "mdmark-hint-tip";

// 埋め込んだ HTML のヒントに操作を付けた回数の通し番号。`id` を重ならせないために使う
let hintCounter = 0;

/** 図のツールチップ（線の詳細・箱の説明と入力・処理・出力・箱の中の用語）と、埋め込んだ HTML のヒント（`div.mdmark-html` を渡したとき）の操作を付け、開いているものを閉じる関数と、操作を外す関数を返す。ポインターとフォーカスで開き、上に乗っても消えず、Esc で閉じる。箱は右上の印の上、ヒントはブロックの要素の印か行内の要素の上でだけ開く。置く側は `chooseTipSide` が決める */
export function attachDiagramTips(options: {
  /** 図か、埋め込んだ HTML の `div.mdmark-html` */
  figure: HTMLElement;
  /** ツールチップを先に出す側 */
  placement: TooltipPlacement;
}): {
  closeOpen: () => boolean;
  detach: () => void;
} {
  const { figure, placement } = options;
  const embedded = figure.classList.contains("mdmark-html");
  const box = figure.querySelector<HTMLElement>(".mdmark-diagram-box");
  const viewport = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  );
  // 埋め込んだ HTML を受けたときは、中の図の部品の分は図の側が扱うので、図の外のヒントだけを見る
  const tips = new Map<string, HTMLElement>(
    embedded
      ? []
      : [...figure.querySelectorAll<HTMLElement>(".mdmark-diagram-tip")].map(
          (tip) => [tip.dataset.tipFor ?? "", tip],
        ),
  );
  // 埋め込んだ HTML のヒントの持ち主（ツールチップを置く基準にもなる）
  const hintOwners = new Map<string, HTMLElement>();
  const controller = new AbortController();
  const { signal } = controller;
  let current: string | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  /** 持ち主の名前から、ツールチップを置く基準の要素（フォーカスできる要素）を引く */
  const anchorOf = (owner: string): HTMLElement | null =>
    hintOwners.get(owner) ??
    figure.querySelector<HTMLElement>(
      `[data-tip-owner="${CSS.escape(owner)}"]:not(.mdmark-diagram-wire-hit)`,
    );

  /** ヒントの持ち主の名前から、開いている印を付ける要素（ブロックの要素か行内の要素）を引く */
  const hintHostOf = (owner: string): Element | null | undefined =>
    hintOwners.get(owner)?.closest(HINT_HOST_SELECTOR);

  /** 持ち主の線 */
  const wireOf = (owner: string): Element | null =>
    figure.querySelector(
      `.mdmark-diagram-wire[data-wire="${CSS.escape(owner)}"]`,
    );

  /** 持ち主の枠とツールチップの高さから、ツールチップを置く側を決める */
  const tipSideOf = (options: { a: DOMRect; height: number }) =>
    chooseTipSide({
      anchorTop: options.a.top,
      anchorBottom: options.a.bottom,
      height: options.height,
      gap: TIP_GAP_PX,
      viewportHeight: window.innerHeight,
      placement,
    });

  /** ツールチップを持ち主の上か下（`placement` の側を先に、収まらなければ反対側）に、画面からはみ出さないよう置く */
  const place = (tip: HTMLElement, anchor: HTMLElement): void => {
    if (tip.classList.contains(HINT_TIP_CLASS)) {
      placeHint(tip, anchor);
      return;
    }
    if (!box) {
      return;
    }
    // 箱の印は、印でなく箱に付けて置く
    const target = anchor.classList.contains("mdmark-diagram-info")
      ? (anchor.closest<HTMLElement>(".mdmark-diagram-node") ?? anchor)
      : anchor;
    const a = target.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const above = tipSideOf({ a, height }) === "top";
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(a.left, window.innerWidth - width - VIEWPORT_MARGIN_PX),
    );
    tip.style.left = `${left - b.left}px`;
    tip.style.top = `${(above ? a.top - TIP_GAP_PX - height : a.bottom + TIP_GAP_PX) - b.top}px`;
  };

  /** 埋め込んだ HTML のヒントのツールチップを、画面に対して持ち主の上か下（`placement` の側を先に、収まらなければ反対側）に、画面からはみ出さないよう置く */
  const placeHint = (tip: HTMLElement, anchor: HTMLElement): void => {
    const a = anchor.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const above = tipSideOf({ a, height }) === "top";
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(a.left, window.innerWidth - width - VIEWPORT_MARGIN_PX),
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${above ? a.top - TIP_GAP_PX - height : a.bottom + TIP_GAP_PX}px`;
  };

  /** ツールチップを閉じ、持ち主の線の強調を外す */
  const close = (): void => {
    clearTimeout(closeTimer);
    if (current === undefined) {
      return;
    }
    const tip = tips.get(current);
    if (tip) {
      tip.hidden = true;
    }
    wireOf(current)?.classList.remove(ACTIVE_CLASS);
    hintHostOf(current)?.classList.remove(HINT_OPEN_CLASS);
    current = undefined;
    unwatch();
  };

  /** ほかのツールチップを閉じてから、この持ち主のツールチップを開く */
  const open = (owner: string): void => {
    clearTimeout(closeTimer);
    if (owner === current) {
      return;
    }
    close();
    const tip = tips.get(owner);
    const anchor = anchorOf(owner);
    if (!tip || !anchor) {
      return;
    }
    tip.hidden = false;
    place(tip, anchor);
    wireOf(owner)?.classList.add(ACTIVE_CLASS);
    hintHostOf(owner)?.classList.add(HINT_OPEN_CLASS);
    current = owner;
    watch();
  };

  /** ポインターもフォーカスも持ち主とツールチップを離れたら、少し待って閉じる */
  const closeLater = (): void => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      const tip = current === undefined ? undefined : tips.get(current);
      const anchor = current === undefined ? null : anchorOf(current);
      if (tip?.matches(":hover") || anchor?.matches(":hover, :focus")) {
        return;
      }
      close();
    }, CLOSE_DELAY_MS);
  };

  // 持ち主: 線のラベル・透明の太い線・箱の印・箱の中の用語（埋め込んだ HTML の中の図は、図の側が扱う）
  for (const owner of embedded
    ? []
    : figure.querySelectorAll<HTMLElement>("[data-tip-owner]")) {
    const name = owner.dataset.tipOwner ?? "";
    owner.addEventListener("pointerenter", () => open(name), { signal });
    owner.addEventListener("pointerleave", closeLater, { signal });
    owner.addEventListener("focus", () => open(name), { signal });
    owner.addEventListener("blur", closeLater, { signal });
  }
  // 埋め込んだ HTML のヒント: ツールチップの `id` を、ページの中で一意な値に振り直して持ち主と結ぶ
  if (embedded) {
    hintCounter += 1;
    const owners = [
      ...figure.querySelectorAll<HTMLElement>(HINT_OWNER_SELECTOR),
    ].filter((owner) => !owner.closest("figure.mdmark-diagram"));
    owners.forEach((owner, position) => {
      const tip = figure.querySelector<HTMLElement>(
        `#${CSS.escape(owner.getAttribute("aria-describedby") ?? "")}`,
      );
      if (!tip) {
        return;
      }
      const name = `mdmark-hint-${hintCounter}-${position + 1}`;
      tip.id = name;
      owner.setAttribute("aria-describedby", name);
      tips.set(name, tip);
      hintOwners.set(name, owner);
      owner.addEventListener("pointerenter", () => open(name), { signal });
      owner.addEventListener("pointerleave", closeLater, { signal });
      owner.addEventListener("focus", () => open(name), { signal });
      owner.addEventListener("blur", closeLater, { signal });
    });
  }
  for (const tip of tips.values()) {
    tip.addEventListener("pointerenter", () => clearTimeout(closeTimer), {
      signal,
    });
    tip.addEventListener("pointerleave", closeLater, { signal });
  }

  /** Esc: 開いているツールチップを閉じる。フォーカスは持ち主に残す */
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && current !== undefined) {
      event.preventDefault();
      close();
    }
  };
  /** 図を動かしたとき・画面をスクロールしたとき: 開いているツールチップを持ち主に付いて動かす */
  const follow = (): void => {
    if (current === undefined) {
      return;
    }
    const tip = tips.get(current);
    const anchor = anchorOf(current);
    if (tip && anchor) {
      place(tip, anchor);
    }
  };
  viewport?.addEventListener("scroll", follow, { passive: true, signal });

  // 開いている間だけ受け取る。印刷の前は閉じる（紙には出さない）
  const watch = (): void => {
    document.addEventListener("keydown", onKeydown);
    // 横にスクロールする埋め込んだ HTML の中のスクロールも受けるため、捕捉の段で受ける
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", follow);
    window.addEventListener("beforeprint", close);
  };
  const unwatch = (): void => {
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("scroll", follow, { capture: true });
    window.removeEventListener("resize", follow);
    window.removeEventListener("beforeprint", close);
  };

  return {
    closeOpen: () => {
      if (current === undefined) {
        return false;
      }
      close();
      return true;
    },
    detach: () => {
      close();
      controller.abort();
    },
  };
}
