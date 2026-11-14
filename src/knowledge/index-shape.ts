/** 文書のタグのうち、主題のタグかを持つオブジェクト */
export type MdmarkIndexDocTag = {
  /** タグの名前 */
  name: string;
  /** 主題のタグか。無いときは `false` として扱う */
  main?: boolean;
};

/** 関係の種類。`MdmarkIndexRelated` の `type` に記載できる値 */
export type MdmarkRelationType =
  /** 相手を先に読み込まないと分からない */
  | "requires"
  /** 相手を必要なときに参照する */
  | "references"
  /** 相手を置き換えた */
  | "replaces"
  /** 相手の一部をなす */
  | "part_of"
  /** 片方を修正したらもう片方も修正する。両側に記載する */
  | "change_together";

/** `MdmarkRelationType` の値（記載できる順） */
export const RELATION_TYPES: readonly MdmarkRelationType[] = [
  "requires",
  "references",
  "replaces",
  "part_of",
  "change_together",
];

/** 文書の関連のうち、関係の種類といつ読み込むかを持つオブジェクト */
export type MdmarkIndexRelated = {
  /** 相手の文書の `id` */
  to: string;
  /** 関係の種類 */
  type: MdmarkRelationType;
  /** いつ読み込むかの 1 文 */
  when: string;
  /** 関連が該当するファイルの glob の並び */
  paths?: string[];
};

/** 索引の文書 1 つ */
export type MdmarkIndexDoc = {
  /** 文書の ID。`docs` の中で一意 */
  id: string;
  /** 文書のパス。索引のファイルのあるフォルダからの相対パス */
  path: string;
  /** 文書のタイトル */
  title: string;
  /** 1 文の概要 */
  description?: string;
  /** 本文での呼び名 */
  aliases?: string[];
  /** タグ。要素はタグの名前か、主題のタグかを持つオブジェクト */
  tags?: (string | MdmarkIndexDocTag)[];
  /** 他の文書への関連。要素は関連する文書の `id` か、`MdmarkIndexRelated` */
  related?: (string | MdmarkIndexRelated)[];
};

/** 索引の用語 1 つ */
export type MdmarkIndexTerm = {
  /** 用語の ID。`terms` の中で一意 */
  id: string;
  /** 用語の単語 */
  term: string;
  /** 別名 */
  aliases?: string[];
  /** 意味 */
  meaning: string;
  /** やめた言い方 */
  avoid?: string[];
};

/** 利用側が索引の YAML を読み込んだ値の型 */
export type MdmarkIndex = {
  /** 索引のバージョン */
  schema: 2;
  /** 文書 */
  docs: MdmarkIndexDoc[];
  /** 用語 */
  terms?: MdmarkIndexTerm[];
};

/** 索引のキー 1 つの型と必須か */
type KeyShape = {
  /** `string[]` は空でない文字列の並び、`array` は並びであること、`doc_tags` は空でない文字列か `name`（必須）と `main` だけを持つオブジェクトの並び、`doc_related` は空でない文字列か `to`・`type`・`when`（必須）と `paths` だけを持つオブジェクトの並び */
  type:
    | "string"
    | "string[]"
    | "integer"
    | "array"
    | "doc_tags"
    | "doc_related"
    | "boolean";
  required: boolean;
};

/** 索引の最上位・`docs` の要素・`terms` の要素ごとの、キーと型と必須か */
export const INDEX_SHAPE: {
  root: Record<string, KeyShape>;
  doc: Record<string, KeyShape>;
  term: Record<string, KeyShape>;
} = {
  root: {
    schema: { type: "integer", required: true },
    docs: { type: "array", required: true },
    terms: { type: "array", required: false },
  },
  doc: {
    id: { type: "string", required: true },
    path: { type: "string", required: true },
    title: { type: "string", required: true },
    description: { type: "string", required: false },
    aliases: { type: "string[]", required: false },
    tags: { type: "doc_tags", required: false },
    related: { type: "doc_related", required: false },
  },
  term: {
    id: { type: "string", required: true },
    term: { type: "string", required: true },
    meaning: { type: "string", required: true },
    aliases: { type: "string[]", required: false },
    avoid: { type: "string[]", required: false },
  },
};

/** 文書のタグのオブジェクトの、キーと型と必須か */
const DOC_TAG_SHAPE: Record<string, KeyShape> = {
  name: { type: "string", required: true },
  main: { type: "boolean", required: false },
};

/** 文書の関連のオブジェクトの、キーと型と必須か */
const DOC_RELATED_SHAPE: Record<string, KeyShape> = {
  to: { type: "string", required: true },
  type: { type: "string", required: true },
  when: { type: "string", required: true },
  paths: { type: "string[]", required: false },
};

/** 空でなくてよい文字列のキー: 空文字を許す */
const EMPTY_ALLOWED = new Set(["description"]);

/** 今の索引のバージョン */
const CURRENT_SCHEMA = 2;

/** 索引の構造に合わない場所 */
export type IndexProblem = {
  /** 合わない場所（`docs[1].path` の構造。ファイル全体は空文字） */
  where: string;
  /** 合わない内容 */
  message: string;
};

/** 値がオブジェクト（配列でない）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 文字列のキーの値を確かめ、合わなければ理由を返却する。空にできるキーだけ空文字を受ける */
function checkString(key: string, value: unknown): string | undefined {
  if (typeof value !== "string") {
    return `${key} は文字列にします`;
  }
  return value === "" && !EMPTY_ALLOWED.has(key)
    ? `${key} は空にできません`
    : undefined;
}

/** 値が型に合うか。合わなければ理由を返却する */
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
    return checkString(key, value);
  }
  const ok =
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item !== "");
  return ok ? undefined : `${key} は空でない文字列の並びにします`;
}

/** 文書のタグの並びを検査し、合わない場所を `problems` に追加する。要素は空でない文字列か、`name`（必須）と `main` だけを持つオブジェクト。1 つでも合わなければ `false` */
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

/** 文書の関連の並びを検査し、合わない場所を `problems` に追加する。要素は空でない文字列か、`to`・`type`・`when`（必須）と `paths` だけを持つオブジェクト。1 つでも合わなければ `false` */
function checkDocRelated(options: {
  value: unknown;
  where: string;
  problems: IndexProblem[];
}): boolean {
  const { value, where, problems } = options;
  if (!Array.isArray(value)) {
    problems.push({ where, message: "related は並びにします" });
    return false;
  }
  let valid = true;
  value.forEach((related, position) => {
    const relatedWhere = `${where}[${position}]`;
    if (typeof related === "string") {
      if (related === "") {
        problems.push({
          where: relatedWhere,
          message: "related の要素は空にできません",
        });
        valid = false;
      }
      return;
    }
    if (!isRecord(related)) {
      problems.push({
        where: relatedWhere,
        message:
          "related の要素は文書の id の文字列か、to・type・when を持つオブジェクトにします",
      });
      valid = false;
      return;
    }
    if (
      !checkItem({
        item: related,
        shape: DOC_RELATED_SHAPE,
        where: relatedWhere,
        problems,
      })
    ) {
      valid = false;
    }
    const { type } = related;
    if (
      typeof type === "string" &&
      type !== "" &&
      !RELATION_TYPES.includes(type as MdmarkRelationType)
    ) {
      problems.push({
        where: `${relatedWhere}.type`,
        message: `type は ${RELATION_TYPES.join("・")} のどれかにします`,
      });
      valid = false;
    }
  });
  return valid;
}

/** 項目の 1 つのキーの値を確かめ、合わなければ `problems` に追加して偽を返却する。無いキーは必須のときだけ合わない */
function checkKey(options: {
  value: unknown;
  key: string;
  shape: KeyShape;
  where: string;
  problems: IndexProblem[];
}): boolean {
  const { value, key, shape, where, problems } = options;
  if (value === undefined) {
    if (shape.required) {
      problems.push({ where, message: `${key} がありません` });
    }
    return !shape.required;
  }
  if (shape.type === "doc_tags") {
    return checkDocTags({ value, where, problems });
  }
  if (shape.type === "doc_related") {
    return checkDocRelated({ value, where, problems });
  }
  const message = checkType(key, value, shape);
  if (message) {
    problems.push({ where, message });
  }
  return message === undefined;
}

/** 要素 1 つをキーごとに検査し、合わない場所を `problems` に追加する。1 つでも合わなければ `false` */
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
    const checked = checkKey({
      value: item[key],
      key,
      shape: keyShape,
      where: `${where}.${key}`,
      problems,
    });
    valid = checked && valid;
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key)) {
      problems.push({
        where: `${where}.${key}`,
        message: `${key} は索引に記載できないキーです`,
      });
      valid = false;
    }
  }
  return valid;
}

/** 要素の並びを検査し、合う要素だけを返却する。`unique` のキーの値が先の要素と重なる要素は除く（先の 1 つを残す） */
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
    // 重なりは、重なったキーごとに場所を返却し、要素を除く
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

/** 値を索引の構造で検査し、合う文書・用語だけの索引と、合わない場所の一覧を返却する */
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
  // 最上位のキー: バージョン・必須の欠け・知らないキー
  if (value.schema !== CURRENT_SCHEMA && Number.isInteger(value.schema)) {
    problems.push({
      where: "schema",
      message: `schema は ${CURRENT_SCHEMA} にします。古いバージョンの索引は mdmark upgrade で移してください`,
    });
  }
  const root: IndexProblem[] = [];
  checkItem({
    item: { ...value, docs: [], terms: [] },
    shape: INDEX_SHAPE.root,
    where: "",
    problems: root,
  });
  for (const problem of root) {
    // 要素の検査に回す `docs`・`terms` の値は、ここでは見ない
    const key = problem.where.slice(1);
    if (key !== "docs" && key !== "terms") {
      problems.push({ where: key, message: problem.message });
    }
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

/** 最上位の `docs`・`terms` を検査する。並びでなければ空を返却し、必須の欠けと型の違いを追加する */
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

/** 文書の関連の要素を、`to`・`type`・`when` を持つオブジェクトにそろえる。文字列の要素は `type` と `when` が `null` のオブジェクトにする */
export function readRelated(item: string | MdmarkIndexRelated): {
  to: string;
  type: MdmarkRelationType | null;
  when: string | null;
  paths?: string[];
} {
  if (typeof item === "string") {
    return { to: item, type: null, when: null };
  }
  return item.paths === undefined
    ? { to: item.to, type: item.type, when: item.when }
    : { to: item.to, type: item.type, when: item.when, paths: item.paths };
}
