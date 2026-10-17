import { stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { checkIndex, type MdmarkIndexIssue } from "../knowledge/check.ts";
import { normalizePath } from "../knowledge/paths.ts";
import {
  findConfigFile,
  type LoadedConfig,
  loadConfig,
  validateConfig,
} from "./config.ts";
import { collectBuildDocuments, readIndexWithDocuments } from "./documents.ts";
import { CliError, type CliIo } from "./main.ts";

/** `mdmark check` が出すずれ 1 件 */
export type CheckIssue = {
  /** ずれのあるファイル（設定ファイルのフォルダからの相対パス） */
  file: string;
  /** キーのパスか行。ファイル全体は空文字 */
  where: string;
  /** ずれの種類 */
  kind: "schema" | "no_documents" | MdmarkIndexIssue["kind"];
  /** 内容と直し方の 1 文 */
  message: string;
};

/** ファイルが在るか */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** OS の区切りを `/` にそろえる */
function toPosix(path: string): string {
  return path.split(sep).join("/");
}

/** 設定が指すファイル（`theme`・`extensions`）が在るかを確かめる */
async function checkReferencedFiles(
  loaded: LoadedConfig,
  file: string,
): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  const { theme, extensions } = loaded.config;
  if (theme !== undefined && !(await exists(resolve(loaded.dir, theme)))) {
    issues.push({
      file,
      where: "theme",
      kind: "schema",
      message: `\`theme\` の \`${theme}\` が見つかりません。パスを直すか CSS を置いてください。`,
    });
  }
  for (const [position, path] of (extensions ?? []).entries()) {
    if (!(await exists(resolve(loaded.dir, path)))) {
      issues.push({
        file,
        where: `extensions[${position}]`,
        kind: "schema",
        message: `\`extensions[${position}]\` の \`${path}\` が見つかりません。パスを直すか拡張を置いてください。`,
      });
    }
  }
  return issues;
}

/** `build` の対象の文書が 0 件でないことと、`build.glossary`・`build.entry` がまとめる文書に当たることを確かめる */
async function checkBuild(
  loaded: LoadedConfig,
  file: string,
): Promise<{ schema: CheckIssue[]; noDocuments: CheckIssue[] }> {
  const build = loaded.config.build;
  if (!build) {
    return { schema: [], noDocuments: [] };
  }
  const paths = await collectBuildDocuments(loaded.dir, build);
  const included = new Set(paths);
  const schema: CheckIssue[] = [];
  for (const [position, path] of (build.glossary ?? []).entries()) {
    if (!included.has(normalizePath(path))) {
      schema.push({
        file,
        where: `build.glossary[${position}]`,
        kind: "schema",
        message: `\`build.glossary[${position}]\` の \`${path}\` がまとめる文書に当たりません。\`build.include\` に当たる文書のパスにしてください。`,
      });
    }
  }
  if (build.entry !== undefined && !included.has(normalizePath(build.entry))) {
    schema.push({
      file,
      where: "build.entry",
      kind: "schema",
      message: `\`build.entry\` の \`${build.entry}\` がまとめる文書に当たりません。\`build.include\` に当たる文書のパスにしてください。`,
    });
  }
  const noDocuments: CheckIssue[] =
    paths.length === 0
      ? [
          {
            file,
            where: "build.include",
            kind: "no_documents",
            message:
              "`build.include` に当たる文書がありません。`build.include` を直してください。",
          },
        ]
      : [];
  return { schema, noDocuments };
}

/** 索引と文書のずれ（`checkIndex`）を、設定ファイルのフォルダからの相対パスのずれにして返す。索引を読めないときは索引を指す `schema` のずれにする */
async function checkIndexFile(loaded: LoadedConfig): Promise<CheckIssue[]> {
  if (loaded.config.index === undefined) {
    return [];
  }
  let read: Awaited<ReturnType<typeof readIndexWithDocuments>>;
  try {
    read = await readIndexWithDocuments(loaded);
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error;
    }
    return [
      {
        file: toPosix(loaded.config.index),
        where: "",
        kind: "schema",
        message: error.message,
      },
    ];
  }
  if (!read) {
    return [];
  }
  const indexDirFromConfig = toPosix(relative(loaded.dir, read.indexDir));
  return checkIndex({
    index: read.raw,
    documents: read.documents,
    indexFile: read.indexFile,
  }).map((issue) => ({
    ...issue,
    // 索引のずれは設定ファイルのフォルダからの相対パスで出ているので、文書のずれだけ索引のフォルダの分を足す
    file:
      issue.file === read.indexFile || indexDirFromConfig === ""
        ? issue.file
        : join(indexDirFromConfig, issue.file).split(sep).join("/"),
  }));
}

/** 設定の形・設定が指すファイル・`build` の対象・`checkIndex` のずれを集め、`{ファイル}:{場所}: {種類}: {内容}` の行と `ずれ {件数} 件` を出す */
export async function runCheck(
  options: { config?: string | undefined },
  io: CliIo,
): Promise<0 | 1> {
  const path = await findConfigFile(io.cwd, options.config);
  const read = await loadConfig(path);
  const file = basename(path);
  const { config, issues: shapeIssues } = validateConfig(read.raw, file);
  const loaded: LoadedConfig = { path, dir: read.dir, config };
  const referenced = await checkReferencedFiles(loaded, file);
  const build = await checkBuild(loaded, file);
  const indexIssues = await checkIndexFile(loaded);
  const issues = [
    ...shapeIssues,
    ...referenced,
    ...build.schema,
    ...build.noDocuments,
    ...indexIssues,
  ];
  for (const issue of issues) {
    const place =
      issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
    io.stdout(`${place}: ${issue.kind}: ${issue.message}`);
  }
  io.stdout(`ずれ ${issues.length} 件`);
  return issues.length === 0 ? 0 : 1;
}
