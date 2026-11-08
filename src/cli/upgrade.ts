import { readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { isMap, parse, parseDocument } from "yaml";
import { resolveSettingsPath, validateSettingsKeys } from "../config-files.ts";
import { restoreBackup, takeBackup } from "./backup.ts";
import { CHANGELOG_FILE, changelogRows } from "./changelog.ts";
import { collectCheckIssues } from "./check.ts";
import { findConfigFile, loadConfig, validateConfig } from "./config.ts";
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
  const loaded = { path: configPath, dir, config };
  const documents = new Set<string>();
  if (config.build) {
    for (const path of await collectBuildDocuments(dir, config.build)) {
      documents.add(resolve(dir, path));
    }
  }
  try {
    const read = await readIndexWithDocuments(loaded);
    for (const path of Object.keys(read?.documents ?? {})) {
      documents.add(resolve(read?.indexDir ?? dir, path));
    }
  } catch (error) {
    // 索引を読み込めないことは、適用した後の点検が通知する
    if (!(error instanceof CliError)) {
      throw error;
    }
  }
  const indexPath =
    config.index === undefined ? undefined : resolve(dir, config.index);
  return {
    configPath,
    indexPath:
      indexPath !== undefined && (await isFile(indexPath))
        ? indexPath
        : undefined,
    documents: [...documents],
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

/** キーが無い `set_default` の `ask` を適用する順に聞き、回答を当て先に入れる */
async function askValues(options: {
  versions: MigrationVersion[];
  target: MigrationTarget;
  ask: Prompter;
}): Promise<void> {
  const { versions, target, ask } = options;
  for (const { steps } of versions) {
    for (const step of steps) {
      if (step.op !== "set_default" || step.ask === undefined) {
        continue;
      }
      const path =
        step.file === "config" ? target.configPath : target.indexPath;
      if (path === undefined) {
        continue;
      }
      const doc = parseDocument(await readFile(path, "utf8"));
      // キーが既にあれば聞かない
      if (doc.hasIn(step.key.split("."))) {
        continue;
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
  if (options.settings && options.config !== undefined) {
    throw new CliError("--config と --settings は一緒に指定できません。");
  }
  const configPath = options.settings
    ? resolveSettingsPath({ env: process.env, home: homedir() })
    : await findConfigFile(io.cwd, options.config);
  const loaded = await loadConfig(configPath);
  const dir = loaded.dir;
  const local = assertVersion(
    isRecord(loaded.raw) && loaded.raw.version !== undefined
      ? loaded.raw.version
      : await askRequired(ask, VERSION_QUESTION),
  );
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
  // 端末の設定は設定ファイルの手順（設定ファイルだけを書き換える call を含む）だけを当て、索引と文書の手順は飛ばす
  const versions = options.settings
    ? loadedVersions.map((version) => ({
        ...version,
        steps: version.steps.filter((step) =>
          step.op === "call"
            ? step.files.length > 0 &&
              step.files.every((file) => file === "config")
            : "file" in step && step.file === "config",
        ),
      }))
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
  const steps: MigrationStep[] = versions.flatMap((version) => version.steps);
  if (!options.yes && steps.some((step) => step.destructive === true)) {
    const answer = await askRequired(ask, CONFIRM_QUESTION);
    if (answer !== CONFIRM_ANSWER) {
      throw new CliError(
        "何も適用していません。確認せずに適用するときは --yes を付けてください。",
      );
    }
  }
  const backupDir = await takeBackup({
    dir,
    files: stepFiles(versions, migrationTarget),
    now: options.now,
  });
  try {
    for (const version of versions) {
      for (const step of version.steps) {
        const lines = await applyStep({
          step,
          version,
          target: migrationTarget,
        });
        if (lines.length > 0) {
          io.stdout(`${version.version} の手順「${step.description}」:`);
          for (const line of lines) {
            io.stdout(`  ${line}`);
          }
        }
      }
    }
    const issues = options.settings
      ? await collectSettingsIssues(configPath)
      : await collectCheckIssues(configPath, {
          unknownMarks: false,
        });
    if (issues.length > 0) {
      await restoreBackup({ dir, backupDir });
      for (const issue of issues) {
        io.stderr(formatCheckIssue(issue));
      }
      io.stderr(
        `点検のずれが ${issues.length} 件あるため、コピーから戻しました。バージョンは書き換えていません。`,
      );
      return 1;
    }
  } catch (error) {
    await restoreBackup({ dir, backupDir });
    throw error;
  }
  await writeConfigVersion(configPath, target);
  io.stdout(`コピー: ${toPosix(relative(dir, backupDir))}`);
  io.stdout(`バージョンを ${target} にしました`);
  return 0;
}
