// 幅が列より広いと判定する余裕（px）。小数の丸めで揺れないよう、これを超えたときだけ広いとする
const WIDE_TOLERANCE_PX = 1;

// 列より広い間だけ付ける class
const WIDE_CLASS = "is-wide";

/** `root` の中の埋め込んだ HTML（`div.mdmark-html`）ごとに幅を見て、列より広い間だけ class `is-wide` と `tabindex="0"` を付け、その中で横にスクロールさせる。幅が変わるたびに判定し直す。返す関数で監視を外し、付けた class と `tabindex` を消す */
export function attachEmbeddedHtml(root: HTMLElement): () => void {
  const elements = [...root.querySelectorAll<HTMLElement>("div.mdmark-html")];
  /** 広さを判定して、印を付けるか消す */
  const sync = (element: HTMLElement): void => {
    const wide = element.scrollWidth > element.clientWidth + WIDE_TOLERANCE_PX;
    element.classList.toggle(WIDE_CLASS, wide);
    if (wide) {
      element.tabIndex = 0;
    } else {
      element.removeAttribute("tabindex");
    }
  };
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      sync(entry.target as HTMLElement);
    }
  });
  for (const element of elements) {
    sync(element);
    observer.observe(element);
  }
  return () => {
    observer.disconnect();
    for (const element of elements) {
      element.classList.remove(WIDE_CLASS);
      element.removeAttribute("tabindex");
    }
  };
}
