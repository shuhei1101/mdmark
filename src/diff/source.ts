/** `mount` の `opts.diffMode` に渡せる差分の出し方。使う側が差分の出し方に対応するバージョンかを見分けるため、配布物が公開する */
export const diffModes = ["button", "open", "blocks"] as const;

/** `mount` の `opts.diffMode` の値 */
export type DiffMode = (typeof diffModes)[number];

/** 文書の変更の 1 回分 */
export type DiffRevision = {
  /** リビジョンの識別子。空でない文字列で、一覧の中で重ならない */
  id: string;
  /** ISO 8601 の日時 */
  at: string;
  /** 一言の説明 */
  label?: string | undefined;
  /** 書いた人 */
  author?: string | undefined;
};

/** `content` に渡す、文書とリビジョンの識別子 */
export type DiffContentTarget = {
  /** 文書の識別子 */
  docId: string;
  /** リビジョンの識別子 */
  revisionId: string;
};

/** 使う側が書く、リビジョンの一覧と本文の取り出し元 */
export type DiffSource = {
  /** 文書のリビジョンを新しい順に返す */
  revisions: (docId: string) => Promise<DiffRevision[]>;
  /** そのリビジョンの Markdown を返す */
  content: (target: DiffContentTarget) => Promise<string>;
};

/** 値が任意の文字列の項目として正しいか（無いか文字列） */
function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

/** `revisions` が返した値がリビジョンの配列の形かを検め、形が合うときだけその配列を返す。形が合わなければ位置を含む `TypeError` を投げる */
export function checkRevisions(value: unknown): DiffRevision[] {
  if (!Array.isArray(value)) {
    throw new TypeError("リビジョンの一覧が配列ではない");
  }
  const ids = new Set<string>();
  value.forEach((item: unknown, position) => {
    const revision = (item ?? {}) as Record<string, unknown>;
    if (typeof revision.id !== "string" || revision.id === "") {
      throw new TypeError(
        `リビジョン ${position} 番目の id が空でない文字列ではない`,
      );
    }
    if (
      typeof revision.at !== "string" ||
      Number.isNaN(Date.parse(revision.at))
    ) {
      throw new TypeError(
        `リビジョン ${position} 番目の at が日時の文字列ではない`,
      );
    }
    if (!isOptionalString(revision.label)) {
      throw new TypeError(
        `リビジョン ${position} 番目の label が文字列ではない`,
      );
    }
    if (!isOptionalString(revision.author)) {
      throw new TypeError(
        `リビジョン ${position} 番目の author が文字列ではない`,
      );
    }
    if (ids.has(revision.id)) {
      throw new TypeError(
        `リビジョン ${position} 番目の id が重なっている: ${revision.id}`,
      );
    }
    ids.add(revision.id);
  });
  return value as DiffRevision[];
}

/** `opts.diffMode` の値が `diffModes` にあればそのまま、無いか知らない値なら `button` を返す */
export function normalizeDiffMode(value: unknown): DiffMode {
  return diffModes.find((mode) => mode === value) ?? "button";
}
