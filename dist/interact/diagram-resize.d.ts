/** リサイズハンドルで変えた高さを sessionStorage に書くキーの頭 */
export declare const DIAGRAM_HEIGHT_KEY_PREFIX = "mdmark-diagram-height:";
/** 同じページの同じ順の同じ題名の図だけが同じ高さを読む、sessionStorage のキー */
export declare const diagramHeightKey: (options: {
    pathname: string;
    index: number;
    title: string;
}) => string;
/** リサイズハンドルのドラッグと上下キーで表示する枠の高さを変え、ダブルクリックで戻し、変えた高さを保つ。付けたときに保った高さを当て、その高さと操作を外す関数を返す */
export declare const attachDiagramResize: (options: {
    /** 表示する枠 */
    viewport: HTMLElement;
    /** リサイズハンドル */
    handle: HTMLElement;
    /** 高さを保つキー（`diagramHeightKey`） */
    key: string;
    /** 高さを保つ先（sessionStorage。使えないときは `null`） */
    storage: Storage | null;
    /** 今の上限（定義の高さ × 今の倍率） */
    max: () => number;
    /** 定義から決まる高さを当て、その高さを返す */
    reset: () => number;
    /** 高さを変えたとき（戻したときは `null`）に呼ぶ */
    onResize: (height: number | null) => void;
}) => {
    restored: number | null;
    detach: () => void;
};
