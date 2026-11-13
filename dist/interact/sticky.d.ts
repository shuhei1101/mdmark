/** `attachStickyRows` が描く先の要素に付ける属性。値は `timeline`（`animation-timeline` でずらす）か `script`（JS でずらす量を入れる）で、CSS はこの属性で適用する規則を分ける */
export declare const STICKY_MODE_ATTRIBUTE = "data-mdmark-sticky";
/** 各 `mdmark-table` の見出し行を画面の上端（`--mdmark-sticky-top`）に、集計の行を画面の下端に、表が画面にかかっている間だけ留める。受け取りと `ResizeObserver` を削除し、属性と CSS 変数を取り除く関数を返却する */
export declare function attachStickyRows(root: HTMLElement): () => void;
