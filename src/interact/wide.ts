import { renderWideBar } from "../parts/wide.ts";

/** 広げた幅が本文の幅より広いと判定する余裕（px） */
const WIDE_TOLERANCE_PX = 1;

/** 要素の内側（余白を除く）の左端と右端 */
const contentEdges = (
  element: HTMLElement,
): { left: number; right: number } => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return {
    left: rect.left + Number.parseFloat(style.paddingLeft || "0"),
    right: rect.right - Number.parseFloat(style.paddingRight || "0"),
  };
};

/** 広げられる幅の左端と右端: 描く先の要素の内側。右側の目次が本文の右に並ぶときは、その左までにする */
const availableEdges = (root: HTMLElement): { left: number; right: number } => {
  // 右側の目次を付けたときは、操作を付ける本文の列の外側が描く先の要素
  const host = root.closest<HTMLElement>(".mdmark") ?? root;
  const edges = contentEdges(host);
  const sideToc = host.querySelector<HTMLElement>(":scope > .mdmark-side-toc");
  if (sideToc && sideToc.offsetParent !== null) {
    const tocLeft = sideToc.getBoundingClientRect().left;
    if (tocLeft > edges.left) {
      edges.right = Math.min(edges.right, tocLeft);
    }
  }
  return edges;
};

/** `div.mdmark-wide-range` の直前に切り替えのボタンの帯を置き、押すたびに `data-state` と `aria-pressed` を入れ替える。描く先の要素の幅が本文の幅以下なら帯を隠す */
export const attachWideToggles = (root: HTMLElement): (() => void) => {
  const ranges = [
    ...root.querySelectorAll<HTMLElement>("div.mdmark-wide-range"),
  ];
  if (ranges.length === 0) {
    return () => {};
  }
  const bars: HTMLElement[] = [];
  for (const range of ranges) {
    range.insertAdjacentHTML(
      "beforebegin",
      renderWideBar(range.dataset.state !== "narrow"),
    );
    const bar = range.previousElementSibling as HTMLElement;
    bars.push(bar);
  }
  /** 広げた幅と位置を範囲に入れ、広げられないときは帯を隠す */
  const sync = (): void => {
    const available = availableEdges(root);
    for (const [index, range] of ranges.entries()) {
      const bar = bars[index];
      const column = range.parentElement;
      if (!bar || !column) {
        continue;
      }
      const edges = contentEdges(column);
      const width = available.right - available.left;
      const wider = width > edges.right - edges.left + WIDE_TOLERANCE_PX;
      bar.hidden = !wider;
      if (wider) {
        range.style.setProperty("--mdmark-wide-width", `${width}px`);
        range.style.setProperty(
          "--mdmark-wide-shift",
          `${edges.left - available.left}px`,
        );
      } else {
        range.style.removeProperty("--mdmark-wide-width");
        range.style.removeProperty("--mdmark-wide-shift");
      }
    }
  };
  const onClick = (event: Event): void => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "button.mdmark-wide-toggle",
    );
    const index = bars.findIndex((bar) => bar.contains(button ?? null));
    const range = ranges[index];
    if (!button || !range) {
      return;
    }
    const wide = range.dataset.state === "narrow";
    range.dataset.state = wide ? "wide" : "narrow";
    button.setAttribute("aria-pressed", String(wide));
  };
  root.addEventListener("click", onClick);
  const observer = new ResizeObserver(sync);
  observer.observe(root);
  sync();
  return () => {
    observer.disconnect();
    root.removeEventListener("click", onClick);
    for (const bar of bars) {
      bar.remove();
    }
    for (const range of ranges) {
      range.style.removeProperty("--mdmark-wide-width");
      range.style.removeProperty("--mdmark-wide-shift");
    }
  };
};
