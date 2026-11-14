import { readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { isMap, parse, parseDocument } from "yaml";
import { resolveSettingsPath, validateSettingsKeys } from "../config-files.ts";
import { restoreBackup, takeBackup } from "./backup.ts";
import { CHANGELOG_FILE, changelogRows } from "./changelog.ts";
import { type CheckIssue, collectCheckIssues } from "./check.ts";
import {
  findConfigFile,
  type LoadedConfig,
  loadConfig,
  validateConfig,
} from "./config.ts";
import { collectBuildDocuments, readIndexWithDocuments } from "./documents.ts";
import { CliError, type CliIo } from "./errors.ts";
import { formatCheckIssue } from "./issues.ts";
import {
  applyStep,
  loadMigrationVersions,
  type MigrationStep,
  type MigrationTarget,
  type MigrationVersion,
  stepFiles,
} from "./migrations.ts";
import type { Prompter } from "./prompt.ts";
import { compareVersions, parseVersion } from "./versions.ts";

/** 壊す手順の確認で承諾とする回答し */
const CONFIRM_ANSWER = "y";

/** 手元のバージョンを聞く質問 */
const VERSION_QUESTION =
  "手元のバージョン（v{MAJOR}.{MINOR}.{PATCH}）を入れてください:";

/** 壊す手順の確認の質問 */
const CONFIRM_QUESTION = `壊す手順を適用してよいですか（${CONFIRM_ANSWER} で適用する）:`;

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** OS の区切りを `/` にそろえる */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** ファイルが在るか */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** バージョンの書式が `v{MAJOR}.{MINOR}.{PATCH}` でなければ誤りを投げる */
function assertVersion(value: unknown): string {
  if (typeof value !== "string" || parseVersion(value) === undefined) {
    throw new CliError(
      `手元のバージョン ${String(value)} の書式が違います。v{MAJOR}.{MINOR}.{PATCH} で記載してください。`,
    );
  }
  return value;
}

/** 質問を出して回答を受ける。回答する前に入力が終わっていれば、書き換えの前に誤りを投げる */
async function askRequired(ask: Prompter, question: string): Promise<string> {
  const answer = await ask(question);
  if (answer === undefined) {
    throw new CliError(
      `「${question}」に回答がありません。何も書き換えていません。`,
    );
  }
  return answer;
}

/** 設定ファイルの `version` をバージョンにし、無ければ最上位の先頭に追加する */
export async function writeConfigVersion(
  configPath: string,
  version: string,
): Promise<void> {
  const doc = parseDocument(await readFile(configPath, "utf8"));
  if (doc.contents === null || doc.has("version")) {
    doc.set("version", version);
  } else if (isMap(doc.contents)) {
    // 最上位の先頭に追加するため、キーと値の組を先頭へ差し込む
    doc.contents.items.unshift(doc.createPair("version", version));
  } else {
    throw new CliError(
      `${basename(configPath)} がキーと値の構造ではありません。設定のキーを記載してください。`,
    );
  }
  await writeFile(configPath, doc.toString({ flowCollectionPadding: false }));
}

/** `build` の対象と索引の文書の絶対パス（重なりなし）。索引を読み込めないことは、適用した後の点検が通知する */
async function targetDocuments(loaded: LoadedConfig): Promise<string[]> {
  const { dir, config } = loaded;
  const documents = new Set<string>();
  for (const path of config.build
    ? await collectBuildDocuments(dir, config.build)
    : []) {
    documents.add(resolve(dir, path));
  }
  try {
    const read = await readIndexWithDocuments(loaded);
    for (const path of Object.keys(read?.documents ?? {})) {
      documents.add(resolve(read?.indexDir ?? dir, path));
    }
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
  }
  return [...documents];
}

/** 設定の `index` が指す、ある索引の絶対パス（無ければ `undefined`） */
async function existingIndex(
  dir: string,
  index: string | undefined,
): Promise<string | undefined> {
  if (index === undefined) {
    return undefined;
  }
  const indexPath = resolve(dir, index);
  return (await isFile(indexPath)) ? indexPath : undefined;
}

/** 手順を適用する設定・索引・文書の場所を作る（回答は適用する前に聞くため空） */
async function createTarget(options: {
  configPath: string;
  raw: unknown;
}): Promise<MigrationTarget> {
  const { configPath, raw } = options;
  const dir = dirname(configPath);
  const file = basename(configPath);
  // 古い設定は新しい構造に合わないことがあるため、合うところだけを読み込む
  const { config } = validateConfig(raw, file);
  return {
    configPath,
    indexPath: await existingIndex(dir, config.index),
    documents: await targetDocuments({ path: configPath, dir, config }),
    answers: new Map(),
  };
}

/** 手順の行と変更履歴の行を標準出力に出す */
async function printPlan(options: {
  versions: MigrationVersion[];
  packageDir: string;
  from: string;
  to: string;
  io: CliIo;
}): Promise<void> {
  const { versions, packageDir, from, to, io } = options;
  for (const version of versions) {
    // 手順のないバージョンは行を出さない
    if (version.steps.length === 0) {
      continue;
    }
    io.stdout(`${version.version}:`);
    for (const step of version.steps) {
      const mark = step.destructive === true ? "（壊す手順）" : "";
      io.stdout(`  ${step.op}${mark}: ${step.description}`);
    }
  }
  let text: string;
  try {
    text = await readFile(join(packageDir, CHANGELOG_FILE), "utf8");
  } catch (error) {
    throw new CliError(
      `変更履歴を読み込めません（${error instanceof Error ? error.message : String(error)}）。mdmark をもう一度入れてください。`,
    );
  }
  const rows = changelogRows({ text, from, to });
  if (rows.length > 0) {
    io.stdout("変更履歴:");
    for (const row of rows) {
      io.stdout(`  ${row.version} ${row.pr} ${row.change}`);
    }
  }
}

/** 値を聞く `set_default` の手順 1 つの値を聞く。書き換える YAML が無いか、キーが既にあれば聞かない */
async function askValue(options: {
  step: MigrationStep;
  target: MigrationTarget;
  ask: Prompter;
}): Promise<void> {
  const { step, target, ask } = options;
  if (step.op !== "set_default" || step.ask === undefined) {
    return;
  }
  const path = step.file === "config" ? target.configPath : target.indexPath;
  if (path === undefined) {
    return;
  }
  const doc = parseDocument(await readFile(path, "utf8"));
  if (doc.hasIn(step.key.split("."))) {
    return;
  }
  const answer = await askRequired(ask, step.ask);
  try {
    parse(answer);
  } catch {
    throw new CliError(
      `「${step.ask}」の回答 ${answer} を YAML の値として読み込めません。何も書き換えていません。`,
    );
  }
  target.answers.set(step, answer);
}

/** キーが無い `set_default` の `ask` を適用する順に聞き、回答を当て先に入れる */
async function askValues(options: {
  versions: MigrationVersion[];
  target: MigrationTarget;
  ask: Prompter;
}): Promise<void> {
  const { versions, target, ask } = options;
  for (const step of versions.flatMap(({ steps }) => steps)) {
    await askValue({ step, target, ask });
  }
}

/** 端末の設定を再読み込みし、`mdmark.config.yaml` のキーと端末の設定だけのキーの構造を点検する */
async function collectSettingsIssues(path: string) {
  const { raw } = await loadConfig(path);
  const file = basename(path);
  return [
    ...validateConfig(raw, file).issues,
    ...validateSettingsKeys(raw, file),
  ];
}

/** 書き換える設定ファイルのパス。`--settings` は端末の設定 */
async function upgradeConfigPath(
  options: { config?: string | undefined; settings?: boolean | undefined },
  cwd: string,
): Promise<string> {
  if (options.settings && options.config !== undefined) {
    throw new CliError("--config と --settings は一緒に指定できません。");
  }
  return options.settings
    ? resolveSettingsPath({ env: process.env, home: homedir() })
    : await findConfigFile(cwd, options.config);
}

/** 手元のバージョン（設定に無ければ聞く） */
async function localVersion(raw: unknown, ask: Prompter): Promise<string> {
  return assertVersion(
    isRecord(raw) && raw.version !== undefined
      ? raw.version
      : await askRequired(ask, VERSION_QUESTION),
  );
}

/** 端末の設定は設定ファイルの手順（設定ファイルだけを書き換える call を含む）だけを当て、索引と文書の手順は飛ばす */
function settingsVersions(versions: MigrationVersion[]): MigrationVersion[] {
  return versions.map((version) => ({
    ...version,
    steps: version.steps.filter((step) =>
      step.op === "call"
        ? step.files.length > 0 && step.files.every((file) => file === "config")
        : "file" in step && step.file === "config",
    ),
  }));
}

/** 壊す手順があれば、`--yes` が無いときは確認を聞き、確認の答えでなければ例外を投げる */
async function confirmDestructive(options: {
  steps: MigrationStep[];
  yes: boolean;
  ask: Prompter;
}): Promise<void> {
  const { steps, yes, ask } = options;
  if (yes || !steps.some((step) => step.destructive === true)) {
    return;
  }
  const answer = await askRequired(ask, CONFIRM_QUESTION);
  if (answer !== CONFIRM_ANSWER) {
    throw new CliError(
      "何も適用していません。確認せずに適用するときは --yes を付けてください。",
    );
  }
}

/** 手順を順に適用し、スクリプトが出した行を手順ごとに出力する */
async function applyVersions(options: {
  versions: MigrationVersion[];
  target: MigrationTarget;
  io: CliIo;
}): Promise<void> {
  const { versions, target, io } = options;
  for (const version of versions) {
    for (const step of version.steps) {
      const lines = await applyStep({ step, version, target });
      if (lines.length === 0) {
        continue;
      }
      io.stdout(`${version.version} の手順「${step.description}」:`);
      for (const line of lines) {
        io.stdout(`  ${line}`);
      }
    }
  }
}

/** 適用した後の点検のずれ。移行の報告に挙げた今の書き方のマーカーは、点検の失敗に数えない */
async function upgradeIssues(
  configPath: string,
  settings: boolean | undefined,
): Promise<CheckIssue[]> {
  if (settings) {
    return collectSettingsIssues(configPath);
  }
  const issues = await collectCheckIssues(configPath, { unknownMarks: false });
  return issues.filter((issue) => issue.kind !== "legacy_mark");
}

/** 手順を適用して点検し、ずれがあればコピーから戻してずれを出力する。点検が通ったかを返却する */
async function applyAndCheck(options: {
  versions: MigrationVersion[];
  target: MigrationTarget;
  settings: boolean | undefined;
  backup: { dir: string; backupDir: string };
  io: CliIo;
}): Promise<boolean> {
  const { versions, target, settings, backup, io } = options;
  try {
    await applyVersions({ versions, target, io });
    const issues = await upgradeIssues(target.configPath, settings);
    if (issues.length === 0) {
      return true;
    }
    await restoreBackup(backup);
    for (const issue of issues) {
      io.stderr(formatCheckIssue(issue));
    }
    io.stderr(
      `点検のずれが ${issues.length} 件あるため、コピーから戻しました。バージョンは書き換えていません。`,
    );
    return false;
  } catch (error) {
    await restoreBackup(backup);
    throw error;
  }
}

/** 手元のバージョンから呼んだ CLI のバージョンまでの移行の手順を当て、点検が通ったら設定のバージョンを書き換える */
export async function runUpgrade(
  options: {
    config?: string | undefined;
    settings?: boolean | undefined;
    plan: boolean;
    yes: boolean;
    packageDir: string;
    cliVersion: string;
    now: Date;
  },
  io: CliIo,
  ask: Prompter,
): Promise<0 | 1> {
  const configPath = await upgradeConfigPath(options, io.cwd);
  const loaded = await loadConfig(configPath);
  const dir = loaded.dir;
  const local = await localVersion(loaded.raw, ask);
  const target = options.cliVersion;
  io.stdout(`手元のバージョン: ${local}`);
  io.stdout(`目標のバージョン: ${target}`);
  const order = compareVersions(local, target);
  if (order > 0) {
    throw new CliError(
      `手元のバージョン ${local} はこの mdmark（${target}）より新しいです。npx github:shuhei1101/mdmark#${local} upgrade のように、手元のバージョン以上の mdmark で呼んでください。`,
    );
  }
  if (order === 0) {
    io.stdout(
      "手元のバージョンが目標のバージョンと同じです。適用する手順はありません",
    );
    return 0;
  }
  const loadedVersions = await loadMigrationVersions({
    packageDir: options.packageDir,
    from: local,
    to: target,
  });
  const versions = options.settings
    ? settingsVersions(loadedVersions)
    : loadedVersions;
  const migrationTarget = options.settings
    ? { configPath, indexPath: undefined, documents: [], answers: new Map() }
    : await createTarget({ configPath, raw: loaded.raw });
  await printPlan({
    versions,
    packageDir: options.packageDir,
    from: local,
    to: target,
    io,
  });
  if (options.plan) {
    io.stdout("--plan のため書き換えていません");
    return 0;
  }
  // 書き換えの前に、値を聞く手順の質問と壊す手順の確認を聞く
  await askValues({ versions, target: migrationTarget, ask });
  await confirmDestructive({
    steps: versions.flatMap((version) => version.steps),
    yes: options.yes,
    ask,
  });
  const backupDir = await takeBackup({
    dir,
    files: stepFiles(versions, migrationTarget),
    now: options.now,
  });
  const passed = await applyAndCheck({
    versions,
    target: migrationTarget,
    settings: options.settings,
    backup: { dir, backupDir },
    io,
  });
  if (!passed) {
    return 1;
  }
  await writeConfigVersion(configPath, target);
  io.stdout(`コピー: ${toPosix(relative(dir, backupDir))}`);
  io.stdout(`バージョンを ${target} にしました`);
  return 0;
}
