/** 文書のタグのうち、主題のタグかを持つオブジェクト */
export type MdmarkIndexDocTag = {
  /** タグの名前 */
  name: string;
  /** 主題のタグか。無いときは `false` として扱う */
  main?: boolean;
};

/** 索引の文書 1 つ */
export type MdmarkIndexDoc = {
  /** 文書の ID。`docs` の中で一意 */
  id: string;
  /** 文書のパス。索引のファイルのあるフォルダからの相対パス */
  path: string;
  /** 文書の題 */
  title: string;
  /** 1 文の概要 */
  description?: string;
  /** 本文での呼び名 */
  aliases?: string[];
  /** タグ。要素はタグの名前か、主題のタグかを持つオブジェクト */
  tags?: (string | MdmarkIndexDocTag)[];
  /** 関連する文書の `id` */
  related?: string[];
};

/** 索引の用語 1 つ */
export type MdmarkIndexTerm = {
  /** 用語の ID。`terms` の中で一意 */
  id: string;
  /** 用語の語 */
  term: string;
  /** 別名 */
  aliases?: string[];
  /** 意味 */
  meaning: string;
  /** やめた言い方 */
  avoid?: string[];
};

/** 索引のタグの語彙の 1 つ */
export type MdmarkIndexTag = {
  /** タグの名前 */
  name: string;
  /** グループ */
  group?: string;
  /** 説明（含める / 含めない / 例） */
  description?: string;
  /** 別名 */
  aliases?: string[];
  /** やめたタグの振り替え先の `name` */
  deprecated?: string;
};

/** 使う側が索引の YAML を読んだ値の型 */
export type MdmarkIndex = {
  /** 索引の版 */
  schema: 1;
  /** 文書 */
  docs: MdmarkIndexDoc[];
  /** 用語 */
  terms?: MdmarkIndexTerm[];
  /** タグの語彙 */
  tags?: MdmarkIndexTag[];
};

/** 索引のキー 1 つの型と必須か */
type KeyShape = {
  /** `string[]` は空でない文字列の並び、`array` は並びであること、`doc_tags` は空でない文字列か `name`（必須）と `main` だけを持つオブジェクトの並び */
  type: "string" | "string[]" | "integer" | "array" | "doc_tags" | "boolean";
  required: boolean;
};

/** 索引の最上位・`docs` の要素・`terms` の要素・`tags` の要素ごとの、キーと型と必須か */
export const INDEX_SHAPE: {
  root: Record<string, KeyShape>;
  doc: Record<string, KeyShape>;
  term: Record<string, KeyShape>;
  tag: Record<string, KeyShape>;
} = {
  root: {
    schema: { type: "integer", required: true },
    docs: { type: "array", required: true },
    terms: { type: "array", required: false },
    tags: { type: "array", required: false },
  },
  doc: {
    id: { type: "string", required: true },
    path: { type: "string", required: true },
    title: { type: "string", required: true },
    description: { type: "string", required: false },
    aliases: { type: "string[]", required: false },
    tags: { type: "doc_tags", required: false },
    related: { type: "string[]", required: false },
  },
  term: {
    id: { type: "string", required: true },
    term: { type: "string", required: true },
    meaning: { type: "string", required: true },
    aliases: { type: "string[]", required: false },
    avoid: { type: "string[]", required: false },
  },
  tag: {
    name: { type: "string", required: true },
    group: { type: "string", required: false },
    description: { type: "string", required: false },
    aliases: { type: "string[]", required: false },
    deprecated: { type: "string", required: false },
  },
};

/** 文書のタグのオブジェクトの、キーと型と必須か */
const DOC_TAG_SHAPE: Record<string, KeyShape> = {
  name: { type: "string", required: true },
  main: { type: "boolean", required: false },
};

/** 空でなくてよい文字列のキー: 空文字を許す */
const EMPTY_ALLOWED = new Set(["description"]);

/** 今の索引の版 */
const CURRENT_SCHEMA = 1;

/** 索引の形に合わない場所 */
export type IndexProblem = {
  /** 合わない場所（`docs[1].path` の形。ファイル全体は空文字） */
  where: string;
  /** 合わない内容 */
  message: string;
};

/** 値がオブジェクト（配列でない）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 値が型に合うか。合わなければ理由を返す */
function checkType(
  key: string,
  value: unknown,
  shape: KeyShape,
): string | undefined {
  if (shape.type === "integer") {
    return Number.isInteger(value) ? undefined : `${key} は整数にします`;
  }
  if (shape.type === "array") {
    return Array.isArray(value) ? undefined : `${key} は並びにします`;
  }
  if (shape.type === "boolean") {
    return typeof value === "boolean" ? undefined : `${key} は真偽値にします`;
  }
  if (shape.type === "string") {
    if (typeof value !== "string") {
      return `${key} は文字列にします`;
    }
    return value === "" && !EMPTY_ALLOWED.has(key)
      ? `${key} は空にできません`
      : undefined;
  }
  const ok =
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item !== "");
  return ok ? undefined : `${key} は空でない文字列の並びにします`;
}

/** 文書のタグの並びを検査し、合わない場所を `problems` に足す。要素は空でない文字列か、`name`（必須）と `main` だけを持つオブジェクト。1 つでも合わなければ `false` */
function checkDocTags(options: {
  value: unknown;
  where: string;
  problems: IndexProblem[];
}): boolean {
  const { value, where, problems } = options;
  if (!Array.isArray(value)) {
    problems.push({ where, message: "tags は並びにします" });
    return false;
  }
  let valid = true;
  value.forEach((tag, position) => {
    const tagWhere = `${where}[${position}]`;
    if (typeof tag === "string") {
      if (tag === "") {
        problems.push({
          where: tagWhere,
          message: "tags の要素は空にできません",
        });
        valid = false;
      }
      return;
    }
    if (!isRecord(tag)) {
      problems.push({
        where: tagWhere,
        message:
          "tags の要素はタグの名前の文字列か、name を持つオブジェクトにします",
      });
      valid = false;
      return;
    }
    if (
      !checkItem({ item: tag, shape: DOC_TAG_SHAPE, where: tagWhere, problems })
    ) {
      valid = false;
    }
  });
  return valid;
}

/** 要素 1 つをキーごとに検査し、合わない場所を `problems` に足す。1 つでも合わなければ `false` */
function checkItem(options: {
  item: unknown;
  shape: Record<string, KeyShape>;
  where: string;
  problems: IndexProblem[];
}): boolean {
  const { item, shape, where, problems } = options;
  if (!isRecord(item)) {
    problems.push({ where, message: `${where} はオブジェクトにします` });
    return false;
  }
  let valid = true;
  for (const [key, keyShape] of Object.entries(shape)) {
    const value = item[key];
    if (value === undefined) {
      if (keyShape.required) {
        problems.push({
          where: `${where}.${key}`,
          message: `${key} がありません`,
        });
        valid = false;
      }
      continue;
    }
    if (keyShape.type === "doc_tags") {
      const tagsWhere = `${where}.${key}`;
      if (!checkDocTags({ value, where: tagsWhere, problems })) {
        valid = false;
      }
      continue;
    }
    const message = checkType(key, value, keyShape);
    if (message) {
      problems.push({ where: `${where}.${key}`, message });
      valid = false;
    }
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key)) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} は索引に書けないキーです`,
      });
      valid = false;
    }
  }
  return valid;
}

/** 要素の並びを検査し、合う要素だけを返す。`unique` のキーの値が先の要素と重なる要素は除く（先の 1 つを残す） */
function checkList<Item>(options: {
  list: unknown[];
  name: string;
  shape: Record<string, KeyShape>;
  unique: string[];
  problems: IndexProblem[];
}): Item[] {
  const { list, name, shape, unique, problems } = options;
  const seen = new Map<string, Set<unknown>>(
    unique.map((key) => [key, new Set()]),
  );
  const items: Item[] = [];
  list.forEach((item, position) => {
    const where = `${name}[${position}]`;
    if (!checkItem({ item, shape, where, problems })) {
      return;
    }
    const record = item as Record<string, unknown>;
    // 重なりは、重なったキーごとに場所を返し、要素を除く
    const duplicated = unique.filter((key) => seen.get(key)?.has(record[key]));
    for (const key of duplicated) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} が先の要素と重なっています`,
      });
    }
    if (duplicated.length) {
      return;
    }
    for (const key of unique) {
      seen.get(key)?.add(record[key]);
    }
    items.push(item as Item);
  });
  return items;
}

/** 値を索引の形で検査し、合う文書・用語だけの索引と、合わない場所の一覧を返す */
export function normalizeIndex(value: unknown): {
  index: MdmarkIndex;
  problems: IndexProblem[];
} {
  const problems: IndexProblem[] = [];
  const index: MdmarkIndex = { schema: CURRENT_SCHEMA, docs: [] };
  if (!isRecord(value)) {
    problems.push({ where: "", message: "索引はオブジェクトにします" });
    return { index, problems };
  }
  // 最上位のキー: 版・必須の欠け・知らないキー
  const root: IndexProblem[] = [];
  checkItem({
    item: { ...value, docs: [], terms: [], tags: [] },
    shape: INDEX_SHAPE.root,
    where: "",
    problems: root,
  });
  for (const problem of root) {
    // 要素の検査に回す `docs`・`terms`・`tags` の値は、ここでは見ない
    const key = problem.where.slice(1);
    if (key !== "docs" && key !== "terms" && key !== "tags") {
      problems.push({ where: key, message: problem.message });
    }
  }
  if (value.schema !== undefined && value.schema !== CURRENT_SCHEMA) {
    if (Number.isInteger(value.schema)) {
      problems.push({
        where: "schema",
        message: `schema は ${CURRENT_SCHEMA} にします`,
      });
    }
  }
  if (value.tags !== undefined) {
    index.tags = checkTop<MdmarkIndexTag>({
      list: value.tags,
      name: "tags",
      shape: INDEX_SHAPE.tag,
      unique: [],
      required: false,
      problems,
    });
  }
  index.docs = checkTop<MdmarkIndexDoc>({
    list: value.docs,
    name: "docs",
    shape: INDEX_SHAPE.doc,
    unique: ["id", "path"],
    required: true,
    problems,
  });
  if (value.terms !== undefined) {
    index.terms = checkTop<MdmarkIndexTerm>({
      list: value.terms,
      name: "terms",
      shape: INDEX_SHAPE.term,
      unique: ["id"],
      required: false,
      problems,
    });
  }
  return { index, problems };
}

/** 最上位の `docs`・`terms` を検査する。並びでなければ空を返し、必須の欠けと型の違いを足す */
function checkTop<Item>(options: {
  list: unknown;
  name: string;
  shape: Record<string, KeyShape>;
  unique: string[];
  required: boolean;
  problems: IndexProblem[];
}): Item[] {
  const { list, name, required, problems } = options;
  if (list === undefined) {
    if (required) {
      problems.push({ where: name, message: `${name} がありません` });
    }
    return [];
  }
  if (!Array.isArray(list)) {
    problems.push({ where: name, message: `${name} は並びにします` });
    return [];
  }
  return checkList<Item>({ ...options, list });
}
