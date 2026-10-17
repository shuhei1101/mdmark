/** 用語のツールチップの要素の class */
const TIP_SELECTOR = ".mdmark-term-tip";

/** 要素の `textContent` から、用語のツールチップの文字を除いて前後の空白を落とした文字を返す。要素は書き換えない */
export function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const tip of copy.querySelectorAll(TIP_SELECTOR)) {
    tip.remove();
  }
  return copy.textContent?.trim() ?? "";
}
