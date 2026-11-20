/** セルの中で幅を取らない文字の要素（用語・脚注・注記のツールチップと、画面に出さないスクリーンリーダー用の文字）。開いているかに関わらずクラスで決める */
export declare const HIDDEN_TEXT_SELECTOR = ".mdmark-term-tip, .mdmark-fn-tip, .mdmark-visually-hidden";
/** 要素の子孫のうち `HIDDEN_TEXT_SELECTOR` に該当する要素を取り除く。複製した要素を指定する */
export declare const removeHiddenText: (root: Element) => void;
/** 要素の `textContent` から、用語のツールチップと脚注・注記の参照の文字を除いて前後の空白を落とした文字を返却する。要素は書き換えない */
export declare function visibleText(element: Element): string;
/** 表のセルの値を返却する。`data-value` を持てばその値、無ければ `visibleText` の文字 */
export declare function cellValue(cell: HTMLTableCellElement): string;
