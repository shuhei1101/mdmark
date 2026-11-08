/** `save` に指定する、まだ `id` の無いコメント */
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

/** 保存したコメント。`MdmarkCommentDraft` に `id` を追加したもの */
export type MdmarkComment = MdmarkCommentDraft & {
  /** 保存先が付けた ID */
  id: string;
};

/** 利用側が記載する、コメントの読み込みと保存 */
export type MdmarkCommentStore = {
  /** 対象のコメントを返却する */
  load: (target: { docId: string }) => Promise<MdmarkComment[]>;
  /** 下書きを保存し、`id` を付けたコメントを返却する */
  save: (target: {
    docId: string;
    comment: MdmarkCommentDraft;
  }) => Promise<MdmarkComment>;
  /** コメントの本文を書き換える。持つときだけ吹き出しに「編集」を出す */
  update?: (target: {
    docId: string;
    id: string;
    body: string;
  }) => Promise<void>;
  /** コメントを削除する。持つときだけ吹き出しに「削除」を出す */
  remove?: (target: { docId: string; id: string }) => Promise<void>;
};

/** `mountComments` の Promise の値 */
export type MdmarkCommentsHandle = {
  /** マーカーを削除して文字を元の並びに戻し、ボタン・入力欄・吹き出し・一覧と `document` の受け取りを解除する。2 回目以降は何もしない */
  destroy: () => void;
};

/** 空でない文字列か */
function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** `load`・`save` が返却した値が `MdmarkComment` の構造かを返却する */
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

/** 読み込みと保存の関数が `load`・`save` の関数を持ち、`update`・`remove` を持つなら関数かを確認し、合わなければ `name` を含む `TypeError` を投げる */
export function checkCommentStore(
  store: unknown,
  name: string,
): asserts store is MdmarkCommentStore {
  const record = (store ?? {}) as Partial<
    Record<keyof MdmarkCommentStore, unknown>
  >;
  if (typeof record.load !== "function" || typeof record.save !== "function") {
    throw new TypeError(
      `${name} は load と save の関数を持つオブジェクトで指定してください`,
    );
  }
  const optional = [record.update, record.remove];
  if (
    optional.some((value) => value !== undefined && typeof value !== "function")
  ) {
    throw new TypeError(`${name} の update と remove は関数で指定してください`);
  }
}

/** `mountComments` の引数を確認し、合わなければ誤った引数の名前を含む `TypeError` を投げる */
export function checkCommentOptions(
  el: unknown,
  opts: unknown,
): asserts opts is { store: MdmarkCommentStore; docId: string } {
  if (!(el instanceof HTMLElement)) {
    throw new TypeError("el は HTMLElement で指定してください");
  }
  const { store, docId } = (opts ?? {}) as {
    store?: unknown;
    docId?: unknown;
  };
  checkCommentStore(store, "opts.store");
  if (!isFilled(docId)) {
    throw new TypeError("opts.docId は空でない文字列で指定してください");
  }
}
