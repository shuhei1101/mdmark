import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { CliError } from "../cli/errors.ts";
import type { IndexProblem } from "../knowledge/index-shape.ts";

/** 使い方集の索引の 1 行 */
export type GuideEntry = {
  /** 名前。`read_guide` に渡す値で、索引の中で一意 */
  name: string;
  /** 読むとき（どんな作業のときに読むか） */
  when: string;
  /** 1 文の概要 */
  summary: string;
  /** 本文のページ。リポジトリの直下からの相対パス（`docs/` の下の `.md`） */
  page: string;
};

/** 読んだ本文: 名前 1 つ分 */
export type GuidePage = {
  /** 名前 */
  name: string;
  /** 1 行目が `# {名前}`、空行を挟んでページの本文 */
  text: string;
};

/** 同梱した索引のファイル名 */
export const GUIDE_INDEX_FILE = "index.json";
/** セッションに渡す索引の文字数の上限（`additionalContext` の上限） */
export const GUIDE_CONTEXT_LIMIT = 10_000;
/** `read_guide` が 1 回に返す本文の合計の上限の文字数 */
export const GUIDE_RESULT_LIMIT = 50_000;
/** 索引に無い名前に添える近い名前の最大の数 */
export const NEAREST_NAME_COUNT = 3;
/** 索引の文の先頭の 1 文 */
export const GUIDE_CONTEXT_LEAD =
  "mdmark の使い方集の索引。本文は MCP の read_guide に名前を渡すと読める。";

/** 索引の今の版 */
const GUIDE_SCHEMA = 1;
/** 索引の行が持つキー */
const ENTRY_KEYS = ["name", "when", "summary", "page"] as const;
/** 本文のページが置かれる先頭のフォルダ */
const PAGE_PREFIX = "docs/";
/** 本文のページの拡張子 */
const PAGE_SUFFIX = ".md";

/** 値がオブジェクト（配列でない）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 値を使い方集の索引の形で検査し、合う行と合わない場所の一覧を返す */
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
      problems.push({ where: key, message: `\`${key}\` は書けません` });
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
    const before = problems.length;
    for (const key of Object.keys(item)) {
      if (!(ENTRY_KEYS as readonly string[]).includes(key)) {
        problems.push({
          where: `${where}.${key}`,
          message: `\`${key}\` は書けません`,
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
    if (problems.length === before) {
      entries.push(item as GuideEntry);
    }
  });
  return { entries, problems };
}

/** プラグインの使い方集のフォルダの索引を読んで行を返す。読めなければ入れ直しを案内する誤りにする */
export async function readGuideIndex(guideDir: string): Promise<GuideEntry[]> {
  const path = join(guideDir, GUIDE_INDEX_FILE);
  let reason: string;
  try {
    const { entries, problems } = parseGuideIndex(
      JSON.parse(await readFile(path, "utf8")),
    );
    const first = problems[0];
    if (first === undefined) {
      return entries;
    }
    reason = `${first.where}: ${first.message}`;
  } catch (error) {
    reason =
      error instanceof Error
        ? (error.message.split("\n")[0] ?? error.message)
        : String(error);
  }
  throw new CliError(
    `使い方集の索引 ${path} を読めません（${reason}）。プラグインを入れ直してください。`,
  );
}

/** 表のセルに入れる文字にする（縦棒は打ち消し、改行は空白にする） */
function toCell(text: string): string {
  return text.replaceAll("|", "\\|").replace(/\s*\n\s*/g, " ");
}

/** 索引の行から、先頭の 1 文と名前・読むとき・概要の表の文を作る */
export function formatGuideContext(entries: GuideEntry[]): string {
  return [
    GUIDE_CONTEXT_LEAD,
    "| 名前 | 読むとき | 概要 |",
    "| --- | --- | --- |",
    ...entries.map(
      (entry) =>
        `| ${toCell(entry.name)} | ${toCell(entry.when)} | ${toCell(entry.summary)} |`,
    ),
  ].join("\n");
}

/** 2 つの文字列のレーベンシュタイン距離を数える */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** 索引の名前を、渡した名前との編集距離の近い順（同じなら索引の並び）に最大 `count` 件まで返す */
export function nearestNames(options: {
  /** 探す名前 */
  name: string;
  /** 索引の名前 */
  names: string[];
  /** 返す最大の数 */
  count: number;
}): string[] {
  const { name, names, count } = options;
  return names
    .map((candidate, order) => ({
      candidate,
      order,
      distance: editDistance(name, candidate),
    }))
    .sort((a, b) => a.distance - b.distance || a.order - b.order)
    .slice(0, count)
    .map((item) => item.candidate);
}

/** 索引の行が指すページを、使い方集のフォルダの配下から読む */
async function readPage(options: {
  guideDir: string;
  entry: GuideEntry;
}): Promise<string> {
  const { guideDir, entry } = options;
  const path = resolve(guideDir, entry.page);
  const fromGuide = relative(resolve(guideDir), path);
  const failure = new CliError(
    `使い方集の ${entry.name} のページ ${entry.page} を読めません。プラグインを入れ直してください。`,
  );
  if (fromGuide.startsWith("..") || isAbsolute(fromGuide)) {
    throw failure;
  }
  try {
    return await readFile(path, "utf8");
  } catch {
    throw failure;
  }
}

/** 渡した名前の順に、索引の行が指すページの本文を読む */
export async function readGuides(options: {
  /** 使い方集のフォルダ */
  guideDir: string;
  /** 索引の行 */
  entries: GuideEntry[];
  /** 読む名前 */
  names: string[];
}): Promise<GuidePage[]> {
  const { guideDir, entries } = options;
  const names = [...new Set(options.names)];
  const indexNames = entries.map((entry) => entry.name);
  const unknown = names.filter((name) => !indexNames.includes(name));
  if (unknown.length > 0) {
    throw new CliError(
      unknown
        .map((name) => {
          const near = nearestNames({
            name,
            names: indexNames,
            count: NEAREST_NAME_COUNT,
          });
          return `使い方集に ${name} がありません（近い名前: ${near.join("・")}）。索引の名前を渡してください。`;
        })
        .join("\n"),
    );
  }
  const bodies: { name: string; body: string }[] = [];
  for (const name of names) {
    const entry = entries.find((candidate) => candidate.name === name);
    if (entry === undefined) {
      continue;
    }
    bodies.push({ name, body: await readPage({ guideDir, entry }) });
  }
  const total = bodies.reduce((sum, item) => sum + item.body.length, 0);
  if (total > GUIDE_RESULT_LIMIT) {
    const counts = bodies
      .map((item) => `${item.name}: ${item.body.length}`)
      .join("、");
    throw new CliError(
      `本文の合計が ${GUIDE_RESULT_LIMIT} 文字を超えます（${counts}）。名前を分けて呼んでください。`,
    );
  }
  return bodies.map((item) => ({
    name: item.name,
    text: `# ${item.name}\n\n${item.body}`,
  }));
}
