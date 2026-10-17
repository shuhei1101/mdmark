import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { isMap, parse, parseDocument } from "yaml";
import { restoreBackup, takeBackup } from "./backup.ts";
import { CHANGELOG_FILE, changelogRows } from "./changelog.ts";
import { collectCheckIssues } from "./check.ts";
import { findConfigFile, loadConfig, validateConfig } from "./config.ts";
import { collectBuildDocuments, readIndexWithDocuments } from "./documents.ts";
import { CliError, type CliIo } from "./main.ts";
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

/** 壊す手順の確かめで承諾とする答え */
const CONFIRM_ANSWER = "y";

/** 手元の版を聞く問い */
const VERSION_QUESTION =
  "手元の版（v{MAJOR}.{MINOR}.{PATCH}）を入れてください:";

/** 壊す手順の確かめの問い */
const CONFIRM_QUESTION = `壊す手順を当ててよいですか（${CONFIRM_ANSWER} で当てる）:`;

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

/** 版の書式が `v{MAJOR}.{MINOR}.{PATCH}` でなければ誤りを投げる */
function assertVersion(value: unknown): string {
  if (typeof value !== "string" || parseVersion(value) === undefined) {
    throw new CliError(
      `手元の版 ${String(value)} の書式が違います。v{MAJOR}.{MINOR}.{PATCH} で書いてください。`,
    );
  }
  return value;
}

/** 問いを出して答えを受ける。答える前に入力が終わっていれば、書き換えの前に誤りを投げる */
async function askRequired(ask: Prompter, question: string): Promise<string> {
  const answer = await ask(question);
  if (answer === undefined) {
    throw new CliError(
      `「${question}」に答えがありません。何も書き換えていません。`,
    );
  }
  return answer;
}

/** 設定ファイルの `version` を版にし、無ければ最上位の先頭に足す */
export async function writeConfigVersion(
  configPath: string,
  version: string,
): Promise<void> {
  const doc = parseDocument(await readFile(configPath, "utf8"));
  if (doc.contents === null || doc.has("version")) {
    doc.set("version", version);
  } else if (isMap(doc.contents)) {
    // 最上位の先頭に足すため、キーと値の組を先頭へ差し込む
    doc.contents.items.unshift(doc.createPair("version", version));
  } else {
    throw new CliError(
      `${basename(configPath)} がキーと値の形ではありません。設定のキーを書いてください。`,
    );
  }
  await writeFile(configPath, String(doc));
}

/** 手順を当てる設定・索引・文書の場所を作る（答えは当てる前に聞くため空） */
async function createTarget(options: {
  configPath: string;
  raw: unknown;
}): Promise<MigrationTarget> {
  const { configPath, raw } = options;
  const dir = dirname(configPath);
  const file = basename(configPath);
  // 古い設定は新しい形に合わないことがあるため、合うところだけを読む
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
    // 索引を読めないことは、当てた後の点検が知らせる
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
    // 手順のない版は行を出さない
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
      `変更履歴を読めません（${error instanceof Error ? error.message : String(error)}）。mdmark を入れ直してください。`,
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

/** キーが無い `set_default` の `ask` を当てる順に聞き、答えを当て先に入れる */
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
          `「${step.ask}」の答え ${answer} を YAML の値として読めません。何も書き換えていません。`,
        );
      }
      target.answers.set(step, answer);
    }
  }
}

/** 手元の版から呼んだ CLI の版までの移行の手順を当て、点検が通ったら設定の版を書き換える */
export async function runUpgrade(
  options: {
    config?: string | undefined;
    plan: boolean;
    yes: boolean;
    packageDir: string;
    cliVersion: string;
    now: Date;
  },
  io: CliIo,
  ask: Prompter,
): Promise<0 | 1> {
  const configPath = await findConfigFile(io.cwd, options.config);
  const loaded = await loadConfig(configPath);
  const dir = loaded.dir;
  const local = assertVersion(
    isRecord(loaded.raw) && loaded.raw.version !== undefined
      ? loaded.raw.version
      : await askRequired(ask, VERSION_QUESTION),
  );
  const target = options.cliVersion;
  io.stdout(`手元の版: ${local}`);
  io.stdout(`目標の版: ${target}`);
  const order = compareVersions(local, target);
  if (order > 0) {
    throw new CliError(
      `手元の版 ${local} はこの mdmark（${target}）より新しいです。npx github:shuhei1101/mdmark#${local} upgrade のように、手元の版以上の mdmark で呼んでください。`,
    );
  }
  if (order === 0) {
    io.stdout("手元の版が目標の版と同じです。当てる手順はありません");
    return 0;
  }
  const versions = await loadMigrationVersions({
    packageDir: options.packageDir,
    from: local,
    to: target,
  });
  const migrationTarget = await createTarget({ configPath, raw: loaded.raw });
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
  // 書き換えの前に、値を聞く手順の問いと壊す手順の確かめを聞く
  await askValues({ versions, target: migrationTarget, ask });
  const steps: MigrationStep[] = versions.flatMap((version) => version.steps);
  if (!options.yes && steps.some((step) => step.destructive === true)) {
    const answer = await askRequired(ask, CONFIRM_QUESTION);
    if (answer !== CONFIRM_ANSWER) {
      throw new CliError(
        "何も当てていません。確かめずに当てるときは --yes を付けてください。",
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
        await applyStep({ step, version, target: migrationTarget });
      }
    }
    const issues = await collectCheckIssues(configPath);
    if (issues.length > 0) {
      await restoreBackup({ dir, backupDir });
      for (const issue of issues) {
        const place =
          issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
        io.stderr(`${place}: ${issue.kind}: ${issue.message}`);
      }
      io.stderr(
        `点検のずれが ${issues.length} 件あるため、写しから戻しました。版は書き換えていません。`,
      );
      return 1;
    }
  } catch (error) {
    await restoreBackup({ dir, backupDir });
    throw error;
  }
  await writeConfigVersion(configPath, target);
  io.stdout(`写し: ${toPosix(relative(dir, backupDir))}`);
  io.stdout(`版を ${target} にしました`);
  return 0;
}
