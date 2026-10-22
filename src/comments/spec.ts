/** `save` に渡す、まだ `id` の無いコメント */
export type MdmarkCommentDraft = {
  /** 選んだ文字（前後の空白を落とす） */
  quote: string;
  /** 選んだ文字の直前の本文の文字 */
  prefix: string;
  /** 選んだ文字の直後の本文の文字 */
  suffix: string;
  /** コメントの本文（前後の空白を落とす） */
  body: string;
};

/** 保存したコメント。`MdmarkCommentDraft` に `id` を足したもの */
export type MdmarkComment = MdmarkCommentDraft & {
  /** 保存先が付けた ID */
  id: string;
};

/** 使う側が書く、コメントの読み込みと保存 */
export type MdmarkCommentStore = {
  /** 対象のコメントを返す */
  load: (target: { docId: string }) => Promise<MdmarkComment[]>;
  /** 下書きを保存し、`id` を付けたコメントを返す */
  save: (target: {
    docId: string;
    comment: MdmarkCommentDraft;
  }) => Promise<MdmarkComment>;
};

/** `mountComments` の Promise の値 */
export type MdmarkCommentsHandle = {
  /** 印を外して文字を元の並びに戻し、ボタン・入力欄・吹き出し・一覧と `document` の受け取りを外す。2 回目以降は何もしない */
  destroy: () => void;
};

/** 空でない文字列か */
function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** `load`・`save` が返した値が `MdmarkComment` の形かを返す */
export function isComment(value: unknown): value is MdmarkComment {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isFilled(record.id) &&
    isFilled(record.quote) &&
    typeof record.prefix === "string" &&
    typeof record.suffix === "string" &&
    typeof record.body === "string"
  );
}

/** `mountComments`（と `mount` の `commentStore`）の引数を確かめ、合わなければ誤った引数の名前を含む `TypeError` を投げる */
export function checkCommentOptions(
  el: unknown,
  opts: unknown,
): asserts opts is { store: MdmarkCommentStore; docId: string } {
  if (!(el instanceof HTMLElement)) {
    throw new TypeError("el は HTMLElement で渡してください");
  }
  const { store, docId } = (opts ?? {}) as {
    store?: Partial<MdmarkCommentStore> | null;
    docId?: unknown;
  };
  if (typeof store?.load !== "function" || typeof store.save !== "function") {
    throw new TypeError(
      "opts.store は load と save の関数を持つオブジェクトで渡してください",
    );
  }
  if (!isFilled(docId)) {
    throw new TypeError("opts.docId は空でない文字列で渡してください");
  }
}
