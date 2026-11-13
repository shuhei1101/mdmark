/** `attachCodeFolds` が開閉のボタンごとに登録する、行を開くか畳む関数 */
export declare const codeFoldSetters: WeakMap<Element, (open: boolean) => void>;
/** 開閉のボタンから `codeFoldSetters` の関数を参照して、その行を開くか畳む。登録の無いボタンは何もしない */
export declare function setCodeFoldOpen(toggle: Element, open: boolean): void;
/** `data-fold-lines` の行を持つコードブロックに、行の開閉のボタン・`⋯`・縦線の範囲を付け、削除する関数を返却する */
export declare function attachCodeFolds(root: HTMLElement): () => void;
