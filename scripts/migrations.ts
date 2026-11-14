import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { MIGRATIONS_DIR, readStepsFile } from "../src/cli/migrations.ts";
import { compareVersions, VERSION_PATTERN } from "../src/cli/versions.ts";

/** 変えたら移行の手順を求める `schemas/` のファイル */
const CHECKED_SCHEMAS = [
  "mdmark.config.schema.json",
  "mdmark.index.schema.json",
  "mdmark.settings.schema.json",
  "mdmark.templates.schema.json",
];

/** 手順なしの一覧の SHA-256 の書式 */
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const execFileAsync = promisify(execFile);

/** 手順なしの一覧の行 */
type NoStepsEntry = {
  version: string;
  schema: string;
  sha256: string;
};

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** ファイルの中身の SHA-256（16 進数） */
function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** パスがフォルダとして在るか */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** パスがファイルとして在るか */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** git を作業ツリーの直下で実行し、標準出力を返却する */
async function git(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: root });
  return stdout;
}

/** `git tag --list v*` のうちバージョンの書式に合う最も新しいバージョンを返却する。git の作業ツリーでないとき・タグが無いときは `undefined` */
export async function latestVersionTag(
  root: string,
): Promise<string | undefined> {
  let output: string;
  try {
    output = await git(root, ["tag", "--list", "v*"]);
  } catch {
    return undefined;
  }
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((tag) => VERSION_PATTERN.test(tag))
    .sort(compareVersions)
    .at(-1);
}

/** `no-steps.yaml` の 1 行の構造の誤りを、場所と文の組で返却する */
function noStepsEntryProblems(
  item: Record<string, unknown>,
  where: string,
): Array<[string, string]> {
  const problems: Array<[string, string]> = [];
  const version = item.version;
  if (
    version !== "next" &&
    !(typeof version === "string" && VERSION_PATTERN.test(version))
  ) {
    problems.push([
      `${where}.version`,
      "version は next か v{MAJOR}.{MINOR}.{PATCH} で記載してください。",
    ]);
  }
  if (
    typeof item.schema !== "string" ||
    !CHECKED_SCHEMAS.includes(item.schema)
  ) {
    problems.push([
      `${where}.schema`,
      `schema は ${CHECKED_SCHEMAS.join(" か ")} で記載してください。`,
    ]);
  }
  if (typeof item.sha256 !== "string" || !SHA256_PATTERN.test(item.sha256)) {
    problems.push([
      `${where}.sha256`,
      "sha256 は 64 桁の小文字の 16 進数で記載してください。",
    ]);
  }
  if (typeof item.reason !== "string" || item.reason === "") {
    problems.push([
      `${where}.reason`,
      "reason は手順が要らない理由を空でない文字列で記載してください。",
    ]);
  }
  return problems;
}

/** 読み込んだ `no-steps.yaml` の中身から、構造の誤りと行を取り出す */
function readNoStepsEntries(
  raw: unknown,
  label: string,
): { entries: NoStepsEntry[]; problems: string[] } {
  const problems: string[] = [];
  const problem = (where: string, message: string) => {
    problems.push(`${label}: ${where}: ${message}`);
  };
  if (!isRecord(raw) || !Array.isArray(raw.entries)) {
    problem("entries", "entries の並びを記載してください。");
    return { entries: [], problems };
  }
  for (const key of Object.keys(raw)) {
    if (key !== "entries") {
      problem(key, "entries 以外のキーは記載できません。削除してください。");
    }
  }
  const entries: NoStepsEntry[] = [];
  for (const [index, item] of raw.entries.entries()) {
    const where = `entries[${index}]`;
    if (!isRecord(item)) {
      problem(where, "行はキーと値で記載してください。");
      continue;
    }
    const found = noStepsEntryProblems(item, where);
    for (const [at, message] of found) {
      problem(at, message);
    }
    if (found.length === 0) {
      entries.push(item as NoStepsEntry);
    }
  }
  return { entries, problems };
}

/** `no-steps.yaml` を読み込み、構造の誤りと行を返却する。ファイルが無ければ空 */
async function readNoSteps(
  root: string,
): Promise<{ entries: NoStepsEntry[]; problems: string[] }> {
  const label = `${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.noSteps}`;
  const path = join(root, MIGRATIONS_DIR.root, MIGRATIONS_DIR.noSteps);
  if (!(await isFile(path))) {
    return { entries: [], problems: [] };
  }
  let raw: unknown;
  try {
    raw = parse(await readFile(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : "";
    return {
      entries: [],
      problems: [`${label}: YAML として読み込めません（${reason}）`],
    };
  }
  return readNoStepsEntries(raw, label);
}

/** 全てのバージョンの手順の構造の誤りを返却する */
async function stepsFileProblems(migrations: string): Promise<string[]> {
  if (!(await isDirectory(migrations))) {
    return [];
  }
  const problems: string[] = [];
  for (const entry of await readdir(migrations, { withFileTypes: true })) {
    const versioned =
      entry.name === MIGRATIONS_DIR.next || VERSION_PATTERN.test(entry.name);
    if (entry.isDirectory() && versioned) {
      const result = await readStepsFile(
        join(migrations, entry.name),
        `${MIGRATIONS_DIR.root}/${entry.name}/${MIGRATIONS_DIR.steps}`,
      );
      problems.push(...result.problems);
    }
  }
  return problems;
}

/** Schema 1 つをタグの時点と比べ、変えたのに移行の手順も手順なしの一覧の合う行も無ければ修正方法つきの文を返却する */
async function schemaChangeProblem(options: {
  root: string;
  tag: string;
  name: string;
  watched: string;
  noSteps: NoStepsEntry[];
}): Promise<string | undefined> {
  const { root, tag, name, watched, noSteps } = options;
  const currentPath = join(root, "schemas", name);
  // 作業ツリーに無い Schema は比べない
  if (!(await isFile(currentPath))) {
    return undefined;
  }
  const current = await readFile(currentPath, "utf8");
  let released: string;
  try {
    released = await git(root, ["show", `${tag}:schemas/${name}`]);
  } catch {
    // タグに無い Schema は比べない
    return undefined;
  }
  if (current === released) {
    return undefined;
  }
  const hash = sha256(current);
  const listed = noSteps.some(
    (entry) =>
      entry.version === watched &&
      entry.schema === name &&
      entry.sha256 === hash,
  );
  const watchedSteps = join(
    root,
    MIGRATIONS_DIR.root,
    watched,
    MIGRATIONS_DIR.steps,
  );
  if (listed || (await isFile(watchedSteps))) {
    return undefined;
  }
  return `schemas/${name} をタグ ${tag} から変えましたが、移行の手順がありません。${MIGRATIONS_DIR.root}/${watched}/${MIGRATIONS_DIR.steps} に手順を配置するか、広げるだけの変更なら ${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.noSteps} に version: ${watched}・schema: ${name}・sha256: ${hash}・reason の行を配置してください。`;
}

/** スキーマを最新のバージョンのタグから変えたのに移行の手順も手順なしの一覧の合う行も無いこと・release のビルドで出していないバージョンの手順が残ること・手順の構造の誤りを、修正方法つきの文で返却する */
export async function checkMigrations(options: {
  root: string;
  version: string;
}): Promise<string[]> {
  const { root, version } = options;
  const migrations = join(root, MIGRATIONS_DIR.root);
  // 全てのバージョンの手順の構造を検める
  const problems = await stepsFileProblems(migrations);
  const noSteps = await readNoSteps(root);
  problems.push(...noSteps.problems);
  const tag = await latestVersionTag(root);
  if (tag === undefined) {
    return problems;
  }
  const order = compareVersions(version, tag);
  // 比べるバージョンがタグより古ければ、スキーマは比べない
  if (order < 0) {
    return problems;
  }
  // タグと同じバージョンは出していないバージョンの手順（next）、新しいバージョンは release のビルドなので v{バージョン} を確認する
  const watched = order === 0 ? MIGRATIONS_DIR.next : version;
  const nextLeft =
    order > 0 &&
    ((await isDirectory(join(migrations, MIGRATIONS_DIR.next))) ||
      noSteps.entries.some((entry) => entry.version === MIGRATIONS_DIR.next));
  if (nextLeft) {
    problems.push(
      `${version} はタグ ${tag} より新しいバージョンのビルドですが、出していないバージョンの手順が残っています。${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.next}/ を ${MIGRATIONS_DIR.root}/${version}/ へ移し、${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.noSteps} の version: next を version: ${version} に書き換えてください。`,
    );
  }
  for (const name of CHECKED_SCHEMAS) {
    const problem = await schemaChangeProblem({
      root,
      tag,
      name,
      watched,
      noSteps: noSteps.entries,
    });
    if (problem !== undefined) {
      problems.push(problem);
    }
  }
  return problems;
}
