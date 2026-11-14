import type { IndexProblem } from "../knowledge/index-shape.ts";

/** ガイドの索引の 1 行 */
export type GuideEntry = {
  /** 名前。索引の中で一意 */
  name: string;
  /** 参照するとき（どんな作業のときに参照するか） */
  when: string;
  /** 1 文の概要 */
  summary: string;
  /** 本文のページ。リポジトリの直下からの相対パス（`docs/` の下の `.md`） */
  page: string;
};

/** 索引の今のバージョン */
const GUIDE_SCHEMA = 1;
/** 索引の行が持つキー */
const ENTRY_KEYS = ["name", "when", "summary", "page"] as const;
/** 本文のページが配置される先頭のフォルダ */
const PAGE_PREFIX = "docs/";
/** 本文のページの拡張子 */
const PAGE_SUFFIX = ".md";

/** 値がオブジェクト（配列でない）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 行のキーと値の型の合わない場所 */
function entryShapeProblems(
  item: Record<string, unknown>,
  where: string,
): IndexProblem[] {
  const problems: IndexProblem[] = [];
  for (const key of Object.keys(item)) {
    if (!(ENTRY_KEYS as readonly string[]).includes(key)) {
      problems.push({
        where: `${where}.${key}`,
        message: `\`${key}\` は記載できません`,
      });
    }
  }
  for (const key of ENTRY_KEYS) {
    const field = item[key];
    if (typeof field !== "string" || field === "") {
      problems.push({
        where: `${where}.${key}`,
        message: `\`${key}\` は空でない文字列にします`,
      });
    }
  }
  return problems;
}

/** 行の合わない場所。名前は `names` に記録し、前の行と重なれば合わない場所にする */
function entryProblems(
  item: Record<string, unknown>,
  where: string,
  names: Set<string>,
): IndexProblem[] {
  const problems = entryShapeProblems(item, where);
  const { name, page } = item;
  if (typeof name === "string" && name !== "") {
    if (names.has(name)) {
      problems.push({
        where: `${where}.name`,
        message: `名前 \`${name}\` が重なっています`,
      });
    }
    names.add(name);
  }
  if (
    typeof page === "string" &&
    page !== "" &&
    !(page.startsWith(PAGE_PREFIX) && page.endsWith(PAGE_SUFFIX))
  ) {
    problems.push({
      where: `${where}.page`,
      message: `\`page\` は \`${PAGE_PREFIX}\` で始まり \`${PAGE_SUFFIX}\` で終わるパスにします`,
    });
  }
  return problems;
}

/** 値をガイドの索引の構造で検査し、合う行と合わない場所の一覧を返却する */
export function parseGuideIndex(value: unknown): {
  entries: GuideEntry[];
  problems: IndexProblem[];
} {
  const entries: GuideEntry[] = [];
  const problems: IndexProblem[] = [];
  if (!isRecord(value)) {
    problems.push({ where: "", message: "索引はオブジェクトにします" });
    return { entries, problems };
  }
  for (const key of Object.keys(value)) {
    if (key !== "schema" && key !== "guides") {
      problems.push({ where: key, message: `\`${key}\` は記載できません` });
    }
  }
  if (value.schema !== GUIDE_SCHEMA) {
    problems.push({
      where: "schema",
      message: `\`schema\` は ${GUIDE_SCHEMA} にします`,
    });
  }
  if (!Array.isArray(value.guides)) {
    problems.push({
      where: "guides",
      message: "`guides` は行の並びにします",
    });
    return { entries, problems };
  }
  const names = new Set<string>();
  value.guides.forEach((item: unknown, position) => {
    const where = `guides[${position}]`;
    if (!isRecord(item)) {
      problems.push({ where, message: "行はオブジェクトにします" });
      return;
    }
    const found = entryProblems(item, where, names);
    problems.push(...found);
    if (found.length === 0) {
      entries.push(item as GuideEntry);
    }
  });
  return { entries, problems };
}
