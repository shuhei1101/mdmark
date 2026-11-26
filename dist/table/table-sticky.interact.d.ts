/** `attachStickyRows` が表ごとの留める要素（表を包む横のスクロールの要素。無ければ `table`）に付ける属性。値は `timeline`（`animation-timeline` でずらす）か `script`（JS でずらす量を入れる）で、CSS はこの属性で適用する規則を分ける */
export declare const STICKY_MODE_ATTRIBUTE = "data-mdmark-sticky";
/** 表のメニューのボタンを持つ囲む要素に付ける属性。値は留め方（`timeline`・`script`）で、CSS はこの属性でボタンを見出し行と同じだけずらす */
export declare const STICKY_MENU_ATTRIBUTE = "data-mdmark-sticky-menu";
/** `root` の中の本文の行を持つ全ての表の見出し行をスクロールする場所の上端（`--mdmark-sticky-top`）に、集計の行をその下端に、表がスクロールする場所にかかっている間だけ留める。受け取りと `ResizeObserver` を削除し、属性と CSS 変数を取り除く関数を返却する */
export declare function attachStickyRows(root: HTMLElement): () => void;
