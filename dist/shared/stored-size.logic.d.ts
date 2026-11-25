/** 保った大きさを読み込む。読み込めない・正の整数でない・保つ先が無いときは `null`（保つ先の例外は外へ出さない） */
export declare const readStoredSize: (storage: Storage | null, key: string) => number | null;
/** 大きさを整数の文字で保つ（`null` はキーを削除する）。保つ先が無いときは何もせず、保つ先の例外は外へ出さない */
export declare const writeStoredSize: (storage: Storage | null, key: string, size: number | null) => void;
/** 同じページの同じ順の同じ名前の対象だけが同じ大きさを読み込む、sessionStorage のキー */
export declare const storedSizeKey: (options: {
    /** キーの頭 */
    prefix: string;
    /** ページの `location.pathname` */
    pathname: string;
    /** 描いた文書の根の中の対象の通し番号（0 から） */
    index: number;
    /** 対象の名前（図の題名・動画の `src`） */
    name: string;
}) => string;
