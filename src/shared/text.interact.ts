/** 用語のツールチップの要素の class */
const TIP_SELECTOR = ".mdmark-term-tip";

/** 要素の `textContent` から、用語のツールチップの文字を除いて前後の空白を落とした文字を返却する。要素は書き換えない */
export function visibleText(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  for (const tip of copy.querySelectorAll(TIP_SELECTOR)) {
    tip.remove();
  }
  return copy.textContent?.trim() ?? "";
}

/** 表のセルの値を返却する。`data-value` を持てばその値、無ければ `visibleText` の文字 */
export function cellValue(cell: HTMLTableCellElement): string {
  return cell.dataset.value ?? visibleText(cell);
}
