/** 差分のパネルで `mount` に渡す `docId` */
export const DIFF_DOC_ID = "diff";

/** 差分のパネルで取り出し元に渡す、最後に受けた `render` の全文。書き換えられる入れ物 */
export type DiffTexts = {
  /** 変更後の全文（`render` の `markdown`） */
  modified: string;
  /** 変更前の全文（`render` の `previous`） */
  original: string;
};

/** 差分の取り出し元（mdmark の `DiffSource` のうち、この Webview が作るもの） */
export type DiffSource = {
  revisions: (docId: string) => Promise<{ id: string; at: string }[]>;
  content: (target: { docId: string; revisionId: string }) => Promise<string>;
};

/** `revisions` が `modified`・`original` の 2 つをこの順に返し、`content` が呼ばれた時点の全文を返す取り出し元を作る。`content` は知らない `revisionId` で reject する */
export const createDiffSource = (texts: DiffTexts): DiffSource => ({
  revisions: () => {
    const at = new Date().toISOString();
    return Promise.resolve([
      { id: "modified", at },
      { id: "original", at },
    ]);
  },
  content: ({ revisionId }) =>
    revisionId === "modified" || revisionId === "original"
      ? Promise.resolve(texts[revisionId])
      : Promise.reject(new Error(`知らないリビジョン: ${revisionId}`)),
});
