import { CliError } from "../cli/errors.ts";
import type { MdmarkIndexDoc } from "../knowledge/index-shape.ts";
import type { MdmarkReferences } from "../knowledge/references.ts";
import { readDocTag, type TagListEntry } from "../knowledge/tags.ts";

/** `find_docs` の行に加えて返せる項目 */
export type DocField = "path" | "aliases" | "related" | "referenced_by";

/** `next_cursor` に入れる、次の先頭の位置と絞り込みの条件 */
export type FindDocsCursor = {
  /** 並べた後の文書の、次に返す先頭の位置（0 始まり） */
  offset: number;
  /** `next_cursor` を返した呼び出しの絞り込みの条件。渡されなかった条件は持たない */
  filter: {
    text?: string;
    tags?: string[];
    any_tags?: string[];
    related_to?: string;
  };
};

/** `view` ごとに、ID・題・概要・タグ・文字数（常に返す）に加えて返す項目。並びは行のキー・Markdown の表の列・`omitted` の並びにも使う */
export const VIEW_FIELDS: Record<"brief" | "standard" | "full", DocField[]> = {
  brief: [],
  standard: ["path", "aliases"],
  full: ["path", "aliases", "related", "referenced_by"],
};

/** 続きがあるときに `hint` に入れる文 */
export const FIND_DOCS_HINT =
  "続きがあります。tags・any_tags・text で絞るか、count_only で件数だけを確かめてください。";

/** `cursor` を読めないか、絞り込みの条件が `next_cursor` を返した呼び出しと違うときの文 */
export const CURSOR_ERROR_MESSAGE =
  "cursor を読めないか、絞り込みの条件が next_cursor を返した呼び出しと違います。cursor を省いて先頭から引き直してください。";

/** `FindDocsCursor` を JSON にして base64url（末尾の `=` を落とす）の文字列にする */
export function encodeCursor(cursor: FindDocsCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/** 絞り込みの条件の 4 つのキーが、配列の並びまで同じか */
function sameFilter(
  a: FindDocsCursor["filter"],
  b: FindDocsCursor["filter"],
): boolean {
  const keys = ["text", "tags", "any_tags", "related_to"] as const;
  return keys.every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}

/** `cursor` を読み、絞り込みの条件が今回の条件と同じときだけ次に返す先頭の位置を返す。読めないか条件が違うときは `CliError` を投げる */
export function decodeCursor(options: {
  /** 渡された `cursor` */
  cursor: string;
  /** 今回の絞り込みの条件 */
  filter: FindDocsCursor["filter"];
}): number {
  const { cursor, filter } = options;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new CliError(CURSOR_ERROR_MESSAGE);
  }
  const candidate = parsed as Partial<FindDocsCursor> | null;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof candidate.offset !== "number" ||
    !Number.isInteger(candidate.offset) ||
    candidate.offset < 0 ||
    typeof candidate.filter !== "object" ||
    candidate.filter === null ||
    !sameFilter(candidate.filter, filter)
  ) {
    throw new CliError(CURSOR_ERROR_MESSAGE);
  }
  return candidate.offset;
}

/** `view` の組に `include` を加え `exclude` を除いた項目と、返さない項目の取り方を返す。並びは `VIEW_FIELDS.full` の並び */
export function selectDocFields(options: {
  /** 項目の組 */
  view: "brief" | "standard" | "full";
  /** 加える項目 */
  include: DocField[];
  /** 除く項目 */
  exclude: DocField[];
}): { fields: DocField[]; omitted: Array<{ field: string; how: string }> } {
  const { view, include, exclude } = options;
  const wanted = new Set<DocField>([...VIEW_FIELDS[view], ...include]);
  for (const field of exclude) {
    wanted.delete(field);
  }
  const fields = VIEW_FIELDS.full.filter((field) => wanted.has(field));
  const omitted = VIEW_FIELDS.full
    .filter((field) => !wanted.has(field))
    .map((field) => ({ field, how: `include: ["${field}"]` }));
  return { fields, omitted };
}

/** 索引の文書を、`id`・`title`・`description`・`tags`・`chars` と返す項目のキーをこの順で持つ行にする */
export function toDocRow(options: {
  /** 文書 */
  doc: MdmarkIndexDoc;
  /** 文字数。数えられないときは `null` */
  chars: number | null;
  /** 返す項目 */
  fields: DocField[];
  /** 参照の表。`referenced_by` を返すときに要る */
  references: MdmarkReferences | undefined;
}): Record<string, unknown> {
  const { doc, chars, fields, references } = options;
  const row: Record<string, unknown> = {
    id: doc.id,
    title: doc.title,
    description: doc.description ?? null,
    tags: (doc.tags ?? []).map(readDocTag),
    chars,
  };
  for (const field of fields) {
    if (field === "path") {
      row.path = doc.path;
    } else if (field === "aliases") {
      row.aliases = doc.aliases ?? [];
    } else if (field === "related") {
      row.related = doc.related ?? [];
    } else {
      row.referenced_by = references?.backlinks[doc.id]?.length ?? 0;
    }
  }
  return row;
}

/** 語彙に無いタグ 1 つの `warnings` の文を作る */
export function unknownTagWarning(unknown: {
  tag: string;
  nearest: string | undefined;
}): string {
  return unknown.nearest === undefined
    ? `タグ ${unknown.tag} は語彙になく、近いタグもありません。list_tags で語彙を確かめてください。`
    : `タグ ${unknown.tag} は語彙にありません。近いタグは ${unknown.nearest} です。`;
}

/** 表のセルの文字にする。`|` は `\|`、改行は空白にする */
function escapeCell(text: string): string {
  return text.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

/** 値をセルの文字にする。`null` と空の配列は `-`、配列は `・` でつなぐ */
function cellOf(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "-" : escapeCell(value.join("・"));
  }
  return escapeCell(String(value));
}

/** 表の 1 行にする */
function tableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/** 見出しの行と区切りの行にする */
function tableHead(headers: string[]): string[] {
  return [tableRow(headers), tableRow(headers.map(() => "---"))];
}

/** 文書の行のタグを、主題のタグに `（主題）` を付けた `・` つなぎにする */
function tagsCell(tags: unknown): string {
  const names = (tags as Array<{ name: string; main: boolean }>).map((tag) =>
    tag.main ? `${tag.name}（主題）` : tag.name,
  );
  return cellOf(names);
}

/** 返す項目の表の列の見出し */
const FIELD_HEADERS: Record<DocField, string> = {
  path: "パス",
  aliases: "別名",
  related: "関連する文書",
  referenced_by: "被参照の数",
};

/** `find_docs` の結果のオブジェクトを、`format: markdown` のテキストにする */
export function formatFindDocs(result: Record<string, unknown>): string {
  const docs = result.docs as Array<Record<string, unknown>> | undefined;
  const parts: string[] = [];
  // 先頭の行
  parts.push(
    docs === undefined
      ? `総件数 ${result.total} 件・合計文字数 ${result.total_chars}`
      : `総件数 ${result.total} 件・返した件数 ${result.returned} 件・合計文字数 ${result.total_chars}・next_cursor: ${result.next_cursor ?? "なし"}`,
  );
  // 文書の表。列は、行が持つ項目に合わせる
  if (docs !== undefined && docs.length > 0) {
    const fields = VIEW_FIELDS.full.filter((field) => field in (docs[0] ?? {}));
    const lines = tableHead([
      "ID",
      "題",
      "概要",
      "タグ",
      "文字数",
      ...fields.map((field) => FIELD_HEADERS[field]),
    ]);
    for (const doc of docs) {
      lines.push(
        tableRow([
          cellOf(doc.id),
          cellOf(doc.title),
          cellOf(doc.description),
          tagsCell(doc.tags),
          cellOf(doc.chars),
          ...fields.map((field) => cellOf(doc[field])),
        ]),
      );
    }
    parts.push(lines.join("\n"));
  }
  const tagCounts = (result.tag_counts ?? []) as Array<{
    name: string;
    count: number;
  }>;
  if (tagCounts.length > 0) {
    parts.push(
      `タグごとの件数: ${tagCounts.map((tag) => `${tag.name} ${tag.count}`).join("・")}`,
    );
  }
  const omitted = (result.omitted ?? []) as Array<{
    field: string;
    how: string;
  }>;
  if (omitted.length > 0) {
    parts.push(
      `省いた項目: ${omitted.map((item) => `${item.field}（${item.how}）`).join("・")}`,
    );
  }
  const warnings = (result.warnings ?? []) as string[];
  if (warnings.length > 0) {
    parts.push(warnings.join("\n"));
  }
  if (typeof result.hint === "string") {
    parts.push(result.hint);
  }
  return parts.join("\n\n");
}

/** `list_tags` のタグの並びを、名前・グループ・説明・別名・振り替え先・文書の数の列の表だけのテキストにする */
export function formatListTags(tags: TagListEntry[]): string {
  const lines = tableHead([
    "名前",
    "グループ",
    "説明",
    "別名",
    "振り替え先",
    "文書の数",
  ]);
  for (const tag of tags) {
    lines.push(
      tableRow([
        cellOf(tag.name),
        cellOf(tag.group),
        cellOf(tag.description),
        cellOf(tag.aliases),
        cellOf(tag.deprecated),
        cellOf(tag.docs),
      ]),
    );
  }
  return lines.join("\n");
}
