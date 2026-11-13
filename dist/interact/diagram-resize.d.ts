/** リサイズハンドルで変えた高さを sessionStorage に記載するキーの頭 */
export declare const DIAGRAM_HEIGHT_KEY_PREFIX = "mdmark-diagram-height:";
/** 同じページの同じ順の同じ題名の図だけが同じ高さを読み込む、sessionStorage のキー */
export declare const diagramHeightKey: (options: {
    pathname: string;
    index: number;
    title: string;
}) => string;
/** リサイズハンドルのドラッグと上下キーで表示する枠の高さを変え、ダブルクリックで今の倍率の図の全体が収まる高さにし、変えた高さを保つ。付けたときに保った高さを当て、その高さと操作を削除する関数を返却する */
export declare const attachDiagramResize: (options: {
    /** 表示する枠 */
    viewport: HTMLElement;
    /** リサイズハンドル */
    handle: HTMLElement;
    /** 高さを保つキー（`diagramHeightKey`） */
    key: string;
    /** 高さを保つ先（sessionStorage。使用できないときは `null`） */
    storage: Storage | null;
    /** 今の倍率の図の全体が収まる高さを返却する */
    fit: () => number;
    /** 高さを変えたとき（戻したときは `null`）に呼ぶ */
    onResize: (height: number | null) => void;
}) => {
    restored: number | null;
    detach: () => void;
};
