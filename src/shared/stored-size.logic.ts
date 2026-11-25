/** 保った大きさを読み込む。読み込めない・正の整数でない・保つ先が無いときは `null`（保つ先の例外は外へ出さない） */
export const readStoredSize = (
  storage: Storage | null,
  key: string,
): number | null => {
  try {
    const value = storage?.getItem(key);
    if (value === null || value === undefined || !/^\d+$/.test(value)) {
      return null;
    }
    const size = Number(value);
    return size > 0 ? size : null;
  } catch {
    return null;
  }
};

/** 大きさを整数の文字で保つ（`null` はキーを削除する）。保つ先が無いときは何もせず、保つ先の例外は外へ出さない */
export const writeStoredSize = (
  storage: Storage | null,
  key: string,
  size: number | null,
): void => {
  try {
    if (size === null) {
      storage?.removeItem(key);
    } else {
      storage?.setItem(key, String(size));
    }
  } catch {
    // 保てないときは、大きさを保たずに変えるだけにする
  }
};

/** 同じページの同じ順の同じ名前の対象だけが同じ大きさを読み込む、sessionStorage のキー */
export const storedSizeKey = (options: {
  /** キーの頭 */
  prefix: string;
  /** ページの `location.pathname` */
  pathname: string;
  /** 描いた文書の根の中の対象の通し番号（0 から） */
  index: number;
  /** 対象の名前（図の題名・動画の `src`） */
  name: string;
}): string =>
  `${options.prefix}${options.pathname}#${options.index}:${options.name}`;
