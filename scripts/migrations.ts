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

/** `no-steps.yaml` を読み込み、構造の誤りと行を返却する。ファイルが無ければ空 */
async function readNoSteps(
  root: string,
): Promise<{ entries: NoStepsEntry[]; problems: string[] }> {
  const label = `${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.noSteps}`;
  const path = join(root, MIGRATIONS_DIR.root, MIGRATIONS_DIR.noSteps);
  if (!(await isFile(path))) {
    return { entries: [], problems: [] };
  }
  const problems: string[] = [];
  const problem = (where: string, message: string) => {
    problems.push(`${label}: ${where}: ${message}`);
  };
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
    const before = problems.length;
    if (
      item.version !== "next" &&
      !(typeof item.version === "string" && VERSION_PATTERN.test(item.version))
    ) {
      problem(
        `${where}.version`,
        "version は next か v{MAJOR}.{MINOR}.{PATCH} で記載してください。",
      );
    }
    if (
      typeof item.schema !== "string" ||
      !CHECKED_SCHEMAS.includes(item.schema)
    ) {
      problem(
        `${where}.schema`,
        `schema は ${CHECKED_SCHEMAS.join(" か ")} で記載してください。`,
      );
    }
    if (typeof item.sha256 !== "string" || !SHA256_PATTERN.test(item.sha256)) {
      problem(
        `${where}.sha256`,
        "sha256 は 64 桁の小文字の 16 進数で記載してください。",
      );
    }
    if (typeof item.reason !== "string" || item.reason === "") {
      problem(
        `${where}.reason`,
        "reason は手順が要らない理由を空でない文字列で記載してください。",
      );
    }
    if (problems.length === before) {
      entries.push(item as NoStepsEntry);
    }
  }
  return { entries, problems };
}

/** スキーマを最新のバージョンのタグから変えたのに移行の手順も手順なしの一覧の合う行も無いこと・release のビルドで出していないバージョンの手順が残ること・手順の構造の誤りを、修正方法つきの文で返却する */
export async function checkMigrations(options: {
  root: string;
  version: string;
}): Promise<string[]> {
  const { root, version } = options;
  const problems: string[] = [];
  const migrations = join(root, MIGRATIONS_DIR.root);
  // 全てのバージョンの手順の構造を検める
  if (await isDirectory(migrations)) {
    for (const entry of await readdir(migrations, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        (entry.name === MIGRATIONS_DIR.next || VERSION_PATTERN.test(entry.name))
      ) {
        const result = await readStepsFile(
          join(migrations, entry.name),
          `${MIGRATIONS_DIR.root}/${entry.name}/${MIGRATIONS_DIR.steps}`,
        );
        problems.push(...result.problems);
      }
    }
  }
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
  if (order > 0) {
    const nextLeft =
      (await isDirectory(join(migrations, MIGRATIONS_DIR.next))) ||
      noSteps.entries.some((entry) => entry.version === MIGRATIONS_DIR.next);
    if (nextLeft) {
      problems.push(
        `${version} はタグ ${tag} より新しいバージョンのビルドですが、出していないバージョンの手順が残っています。${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.next}/ を ${MIGRATIONS_DIR.root}/${version}/ へ移し、${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.noSteps} の version: next を version: ${version} に書き換えてください。`,
      );
    }
  }
  const watchedSteps = join(migrations, watched, MIGRATIONS_DIR.steps);
  for (const name of CHECKED_SCHEMAS) {
    const currentPath = join(root, "schemas", name);
    // 作業ツリーに無い Schema は比べない
    if (!(await isFile(currentPath))) {
      continue;
    }
    const current = await readFile(currentPath, "utf8");
    let released: string;
    try {
      released = await git(root, ["show", `${tag}:schemas/${name}`]);
    } catch {
      // タグに無い Schema は比べない
      continue;
    }
    if (current === released) {
      continue;
    }
    const hash = sha256(current);
    const listed = noSteps.entries.some(
      (entry) =>
        entry.version === watched &&
        entry.schema === name &&
        entry.sha256 === hash,
    );
    if (!listed && !(await isFile(watchedSteps))) {
      problems.push(
        `schemas/${name} をタグ ${tag} から変えましたが、移行の手順がありません。${MIGRATIONS_DIR.root}/${watched}/${MIGRATIONS_DIR.steps} に手順を配置するか、広げるだけの変更なら ${MIGRATIONS_DIR.root}/${MIGRATIONS_DIR.noSteps} に version: ${watched}・schema: ${name}・sha256: ${hash}・reason の行を配置してください。`,
      );
    }
  }
  return problems;
}
