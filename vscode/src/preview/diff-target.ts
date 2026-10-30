/** 差分ビューの変更前と変更後の URI の文字列 */
export type DiffTarget = {
  /** 変更前の URI */
  original: string;
  /** 変更後の URI */
  modified: string;
};

/** アクティブなタブが差分ビューで、`uri` が無いか変更前・変更後のどちらかと同じとき、差分のパネルで開く変更前・変更後を返す。それ以外は `undefined` */
export function pickDiffTarget(options: {
  /** アクティブなタブの `TabInputTextDiff` の変更前・変更後（差分ビューでなければ `undefined`） */
  tab: DiffTarget | undefined;
  /** コマンドに渡された URI */
  uri: string | undefined;
}): DiffTarget | undefined {
  const { tab, uri } = options;
  if (tab === undefined) {
    return undefined;
  }
  if (uri !== undefined && uri !== tab.original && uri !== tab.modified) {
    return undefined;
  }
  return { original: tab.original, modified: tab.modified };
}

/** `PreviewManager.panels` のキーを組む。`original` が無ければ `uri` をそのまま、あれば `diff:{original}|{uri}` を返し、同じ Markdown の通常のパネルと差分のパネルを別に持つ */
export function panelKey(options: {
  /** Markdown（差分では変更後）の URI */
  uri: string;
  /** 差分の変更前の URI */
  original?: string;
}): string {
  const { uri, original } = options;
  return original === undefined ? uri : `diff:${original}|${uri}`;
}
