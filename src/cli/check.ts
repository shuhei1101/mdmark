import { readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { MARK_NAME_PATTERN, resolveConfig } from "../config.ts";
import { checkIndex, type MdmarkIndexIssue } from "../knowledge/check.ts";
import { normalizePath } from "../knowledge/paths.ts";
import { FEATURES_MARK, SYNTAX_MARKS } from "../render/marks.ts";
import { findMarks } from "../render/parser.ts";
import {
  type CliConfig,
  findConfigFile,
  type LoadedConfig,
  loadConfig,
  validateConfig,
} from "./config.ts";
import { collectBuildDocuments, readIndexWithDocuments } from "./documents.ts";
import { bundleModule } from "./embed.ts";
import { CliError, type CliIo } from "./main.ts";

/** `mdmark check` が出すずれ 1 件 */
export type CheckIssue = {
  /** ずれのあるファイル（設定ファイルのフォルダからの相対パス） */
  file: string;
  /** キーのパスか行。ファイル全体は空文字 */
  where: string;
  /** ずれの種類 */
  kind: "schema" | "no_documents" | "unknown_mark" | MdmarkIndexIssue["kind"];
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

/** 束ねたコードを `data:` の URL にして `import()` し、モジュールの名前空間を返す */
async function importBundledCode(code: string): Promise<unknown> {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(url);
}

/** 設定の `extensions` の拡張を束ねて Node で読み込み、既定の書き出しの `directive` を集める。束ねられない・読み込めない・`directive` が印の名前でない拡張は `schema` のずれにする */
export async function loadExtensionDirectives(
  loaded: LoadedConfig,
  file: string,
  importCode: (code: string) => Promise<unknown> = importBundledCode,
): Promise<{ directives: Set<string>; issues: CheckIssue[] }> {
  const directives = new Set<string>();
  const issues: CheckIssue[] = [];
  for (const [position, path] of (loaded.config.extensions ?? []).entries()) {
    const where = `extensions[${position}]`;
    // 無いファイルは `checkReferencedFiles` のずれだけにする
    if (!(await exists(resolve(loaded.dir, path)))) {
      continue;
    }
    const bundled = await bundleModule(path, loaded.dir);
    if ("error" in bundled) {
      issues.push({
        file,
        where,
        kind: "schema",
        message: `\`${where}\` の \`${path}\` を束ねられません（${bundled.error}）。拡張のモジュールを直してください。`,
      });
      continue;
    }
    let module: unknown;
    try {
      module = await importCode(bundled.code);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message.split("\n")[0] : String(error);
      issues.push({
        file,
        where,
        kind: "schema",
        message: `\`${where}\` の \`${path}\` を読み込めません（${reason}）。モジュールの読み込みの時点でブラウザの API を使う処理は、\`load\` の中へ移してください。`,
      });
      continue;
    }
    const extension = (module as { default?: { directive?: unknown } } | null)
      ?.default;
    const directive = extension?.directive;
    if (typeof directive === "string" && MARK_NAME_PATTERN.test(directive)) {
      directives.add(directive);
    } else {
      issues.push({
        file,
        where,
        kind: "schema",
        message: `\`${where}\` の \`${path}\` の既定の書き出しに \`directive\` がありません。英小文字で始まる印の名前を \`directive\` に書いてください。`,
      });
    }
  }
  return { directives, issues };
}

/** 索引の点検に渡す文書と `build` の対象の文書を合わせ、設定ファイルのフォルダからの相対パスの順に、重なりを除いて読む */
export async function collectCheckDocuments(
  loaded: LoadedConfig,
): Promise<Array<{ path: string; markdown: string }>> {
  const documents = new Map<string, string>();
  try {
    const read = await readIndexWithDocuments(loaded);
    if (read) {
      const indexDirFromConfig = toPosix(relative(loaded.dir, read.indexDir));
      for (const [key, markdown] of Object.entries(read.documents)) {
        documents.set(toPosix(join(indexDirFromConfig, key)), markdown);
      }
    }
  } catch (error) {
    // 索引を読めないときのずれは `checkIndexFile` が出す
    if (!(error instanceof CliError)) {
      throw error;
    }
  }
  const build = loaded.config.build;
  if (build) {
    for (const path of await collectBuildDocuments(loaded.dir, build)) {
      if (!documents.has(path)) {
        documents.set(path, await readFile(resolve(loaded.dir, path), "utf8"));
      }
    }
  }
  return [...documents]
    .map(([path, markdown]) => ({ path, markdown }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** 文書ごとに拾った印のうち、知っている印に当たらないものを 1 つにつき 1 件の `unknown_mark` のずれにする */
export function checkUnknownMarks(
  documents: Array<{ path: string; markdown: string }>,
  config: CliConfig,
  directives: Set<string>,
): CheckIssue[] {
  const known = new Set([
    FEATURES_MARK,
    ...Object.keys(SYNTAX_MARKS),
    ...Object.keys(resolveConfig({ config }).libraries),
    ...directives,
    ...(config.check?.ignore ?? []),
  ]);
  const issues: CheckIssue[] = [];
  for (const document of documents) {
    for (const mark of findMarks(document.markdown)) {
      if (!known.has(mark.name)) {
        issues.push({
          file: document.path,
          where: String(mark.line),
          kind: "unknown_mark",
          message: `印 \`${mark.name}\` は知らない印で、描くときに取り除かれます。名前を直すか、拡張・\`libraries\`・\`check.ignore\` に足してください。`,
        });
      }
    }
  }
  return issues;
}

/** 設定ファイルを読み、設定の形・設定が指すファイル・`build` の対象・`checkIndex`・文書の本文の知らない印のずれをこの並びで返す。`unknownMarks` が `false` なら、拡張を読み込まず、知らない印を点検しない */
export async function collectCheckIssues(
  path: string,
  options: { unknownMarks?: boolean } = {},
): Promise<CheckIssue[]> {
  const read = await loadConfig(path);
  const file = basename(path);
  const { config, issues: shapeIssues } = validateConfig(read.raw, file);
  const loaded: LoadedConfig = { path, dir: read.dir, config };
  const referenced = await checkReferencedFiles(loaded, file);
  const build = await checkBuild(loaded, file);
  const indexIssues = await checkIndexFile(loaded);
  const checkMarks = options.unknownMarks !== false;
  const extensions = checkMarks
    ? await loadExtensionDirectives(loaded, file)
    : { directives: new Set<string>(), issues: [] };
  const unknownMarks = checkMarks
    ? checkUnknownMarks(
        await collectCheckDocuments(loaded),
        config,
        extensions.directives,
      )
    : [];
  return [
    ...shapeIssues,
    ...referenced,
    ...build.schema,
    ...extensions.issues,
    ...build.noDocuments,
    ...indexIssues,
    ...unknownMarks,
  ];
}

/** 設定の形・設定が指すファイル・`build` の対象・`checkIndex`・文書の本文の知らない印のずれを集め、`{ファイル}:{場所}: {種類}: {内容}` の行と `ずれ {件数} 件` を出す */
export async function runCheck(
  options: { config?: string | undefined },
  io: CliIo,
): Promise<0 | 1> {
  const path = await findConfigFile(io.cwd, options.config);
  const issues = await collectCheckIssues(path);
  for (const issue of issues) {
    const place =
      issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
    io.stdout(`${place}: ${issue.kind}: ${issue.message}`);
  }
  io.stdout(`ずれ ${issues.length} 件`);
  return issues.length === 0 ? 0 : 1;
}
