/** 要素の `textContent` から、用語のツールチップの文字を除いて前後の空白を落とした文字を返却する。要素は書き換えない */
export declare function visibleText(element: Element): string;
/** 表のセルの値を返却する。`data-value` を持てばその値、無ければ `visibleText` の文字 */
export declare function cellValue(cell: HTMLTableCellElement): string;
