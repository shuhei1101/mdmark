import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { build } from "esbuild";
import { bundleModule } from "../bundle-module.ts";
import {
  COLOR_SCHEMES,
  COLOR_THEMES,
  MARK_NAME_PATTERN,
  resolveConfig,
} from "../config.ts";
import { displayConfigPath, relativizeConfigPaths } from "../config-files.ts";
import {
  checkFlowLayout,
  type FlowLayoutIssue,
  type FlowLayoutKind,
} from "../diagram/check.ts";
import {
  definitionWarning,
  type MdmarkFlowDefinition,
  readDefinition,
} from "../diagram/definition.ts";
import type { MdmarkAliasProblem } from "../knowledge/aliases.ts";
import { checkIndex, type MdmarkIndexIssue } from "../knowledge/check.ts";
import { normalizePath } from "../knowledge/paths.ts";
import { FEATURES_MARK, SYNTAX_MARKS } from "../render/marks.ts";
import { findMarks } from "../render/parser.ts";
import { findDiagramBlocks } from "../render/syntax/diagrams.ts";
import { loadAliases } from "./aliases.ts";
import { checkMissingFiles } from "./assets.ts";
import {
  type CliConfig,
  findConfigFile,
  type LoadedConfig,
  readLayeredConfig,
} from "./config.ts";
import { collectBuildDocuments, readIndexWithDocuments } from "./documents.ts";
import { CliError, type CliIo } from "./errors.ts";
import { changedPathsSince } from "./git.ts";
import { collectIncludes, includeProblemMessage } from "./includes.ts";
import { formatCheckIssue } from "./issues.ts";
import { checkMarkdownSource } from "./markdown-check.ts";

/** `mdmark check` が出すずれ 1 件 */
export type CheckIssue = {
  /** ずれのあるファイル（設定ファイルのフォルダからの相対パス） */
  file: string;
  /** キーのパスか行。ファイル全体は空文字 */
  where: string;
  /** ずれの種類 */
  kind:
    | "schema"
    | "unknown_color_theme"
    | "unknown_color_scheme"
    | "no_documents"
    | "unknown_mark"
    | "missing_file"
    | "diagram_invalid"
    | "syntax_warning"
    | "unknown_mark_arg"
    | FlowLayoutKind
    | "alias_no_files"
    | "alias_unreadable"
    | "include_target_missing"
    | "include_circular"
    | MdmarkAliasProblem["kind"]
    | MdmarkIndexIssue["kind"];
  /** 内容と修正方法の 1 文 */
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

/** フォルダが在るか */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** 文書が指すファイルのうち、文書のフォルダにも `assets.root` のフォルダにも無いものを集める */
async function checkDocumentFiles(loaded: LoadedConfig): Promise<CheckIssue[]> {
  const root = loaded.config.assets?.root;
  const assetsRoot =
    root !== undefined && (await isDirectory(resolve(loaded.dir, root)))
      ? resolve(loaded.dir, root)
      : undefined;
  const issues: CheckIssue[] = [];
  for (const doc of await collectCheckDocuments(loaded)) {
    issues.push(
      ...(await checkMissingFiles({
        markdown: doc.markdown,
        docFile: resolve(loaded.dir, doc.path),
        file: doc.path,
        assetsRoot,
      })),
    );
  }
  return issues;
}

/** 設定が指すファイル（`theme`・`extensions`・`assets.root`）が在るかを確認する */
async function checkReferencedFiles(
  loaded: LoadedConfig,
  file: string,
): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = [];
  const { theme, extensions, assets } = loaded.config;
  if (
    assets?.root !== undefined &&
    !(await isDirectory(resolve(loaded.dir, assets.root)))
  ) {
    issues.push({
      file,
      where: "assets.root",
      kind: "schema",
      message: `\`assets.root\` のフォルダ \`${assets.root}\` が見つかりません。パスを修正するかフォルダを配置してください。`,
    });
  }
  if (theme !== undefined && !(await exists(resolve(loaded.dir, theme)))) {
    issues.push({
      file,
      where: "theme",
      kind: "schema",
      message: `\`theme\` の \`${theme}\` が見つかりません。パスを修正するか CSS を配置してください。`,
    });
  }
  for (const [position, path] of (extensions ?? []).entries()) {
    if (!(await exists(resolve(loaded.dir, path)))) {
      issues.push({
        file,
        where: `extensions[${position}]`,
        kind: "schema",
        message: `\`extensions[${position}]\` の \`${path}\` が見つかりません。パスを修正するか拡張を配置してください。`,
      });
    }
  }
  return issues;
}

/** `build` の対象の文書が 0 件でないことと、`build.glossary`・`build.entry` がまとめる文書に該当することを確認する */
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
        message: `\`build.glossary[${position}]\` の \`${path}\` がまとめる文書に該当しません。\`build.include\` に該当する文書のパスにしてください。`,
      });
    }
  }
  if (build.entry !== undefined && !included.has(normalizePath(build.entry))) {
    schema.push({
      file,
      where: "build.entry",
      kind: "schema",
      message: `\`build.entry\` の \`${build.entry}\` がまとめる文書に該当しません。\`build.include\` に該当する文書のパスにしてください。`,
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
              "`build.include` に該当する文書がありません。`build.include` を修正してください。",
          },
        ]
      : [];
  return { schema, noDocuments };
}

/** 索引と文書のずれ（`checkIndex`）を、設定ファイルのフォルダからの相対パスのずれにして返却する。索引を読み込めないときは索引を指す `schema` のずれにする */
async function checkIndexFile(
  loaded: LoadedConfig,
  base: string | undefined,
): Promise<CheckIssue[]> {
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
  // 比べる基準を指定したときだけ、基準から変わった文書を `change_together` の修正漏れの検査に指定する
  const changedPaths =
    base === undefined
      ? undefined
      : await changedPathsSince({
          cwd: loaded.dir,
          base,
          indexDir: read.indexDir,
        });
  return checkIndex({
    index: read.raw,
    documents: read.documents,
    indexFile: read.indexFile,
    ...(changedPaths !== undefined && { changedPaths }),
  }).map((issue) => ({
    ...issue,
    // 索引のずれは設定ファイルのフォルダからの相対パスで出ているので、文書のずれだけ索引のフォルダの分を追加する
    file:
      issue.file === read.indexFile || indexDirFromConfig === ""
        ? issue.file
        : join(indexDirFromConfig, issue.file).split(sep).join("/"),
  }));
}

/** まとめたコードを `data:` の URL にして `import()` し、モジュールの名前空間を返却する */
export async function importBundledCode(code: string): Promise<unknown> {
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  return import(url);
}

/** 設定の `extensions` の拡張をまとめて Node で読み込み、既定の書き出しの `directive` を集める。まとめられない・読み込めない・`directive` がマーカーの名前でない拡張は `schema` のずれにする */
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
    const bundled = await bundleModule(path, loaded.dir, undefined, build);
    if ("error" in bundled) {
      issues.push({
        file,
        where,
        kind: "schema",
        message: `\`${where}\` の \`${path}\` をまとめられません（${bundled.error}）。拡張のモジュールを修正してください。`,
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
        message: `\`${where}\` の \`${path}\` を読み込めません（${reason}）。モジュールの読み込みの時点でブラウザの API を使用する処理は、\`load\` の中へ移してください。`,
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
        message: `\`${where}\` の \`${path}\` の既定の書き出しに \`directive\` がありません。英小文字で始まるマーカーの名前を \`directive\` に記載してください。`,
      });
    }
  }
  return { directives, issues };
}

/** 設定の `colorTheme` が選べるテーマの名前に無いときの、`unknown_color_theme` のずれを返却する */
function checkColorTheme(config: CliConfig, file: string): CheckIssue[] {
  const name = config.colorTheme;
  if (name === undefined || COLOR_THEMES.some((theme) => theme === name)) {
    return [];
  }
  return [
    {
      file,
      where: "colorTheme",
      kind: "unknown_color_theme",
      message: `不明なテーマ名 ${name} です。${COLOR_THEMES.join("・")} のいずれかに修正してください。`,
    },
  ];
}

/** 設定の `colorScheme` が記載できる値に無いときの、`unknown_color_scheme` のずれを返却する */
function checkColorScheme(config: CliConfig, file: string): CheckIssue[] {
  const value = config.colorScheme;
  if (value === undefined || COLOR_SCHEMES.some((scheme) => scheme === value)) {
    return [];
  }
  return [
    {
      file,
      where: "colorScheme",
      kind: "unknown_color_scheme",
      message: `不明な明暗 ${value} です。${COLOR_SCHEMES.join("・")} のいずれかに修正してください。`,
    },
  ];
}

/** 索引の点検に指定する文書と `build` の対象の文書を合わせ、設定ファイルのフォルダからの相対パスの順に、重なりを除いて読み込む */
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
    // 索引を読み込めないときのずれは `checkIndexFile` が出す
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

/** 文書ごとに取得したマーカーのうち、知っているマーカーに該当しないものを 1 つにつき 1 件の `unknown_mark` のずれにする */
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
          message: `マーカー \`${mark.name}\` は知らないマーカーで、描くときに取り除かれます。名前を修正するか、拡張・\`libraries\`・\`check.ignore\` に追加してください。`,
        });
      }
    }
  }
  return issues;
}

/** フロー図の配置のずれ 1 件の内容（図のタイトル・対象の `id`・修正方法の 1 文） */
function flowLayoutMessage(title: string, issue: FlowLayoutIssue): string {
  const [first = "", second = ""] = issue.ids;
  switch (issue.kind) {
    case "diagram_node_overlap":
      return `${title}: ノード \`${first}\` と \`${second}\` が重なっています。どちらかの \`x\`・\`y\`・\`w\`・\`h\` を修正してください。`;
    case "diagram_node_overflow":
      return `${title}: ノード \`${first}\` が図の幅・高さの外に出ているか、システムの枠の縁にまたがっています。ノードの \`x\`・\`y\`・\`w\`・\`h\` か、図の \`width\`・\`height\`・\`frame\` を修正してください。`;
    case "diagram_wire_crosses_node":
      return `${title}: 線 \`${first}\` がノード \`${second}\` の中を通っています。線の \`points\` か、ノードの \`x\`・\`y\` を修正してください。`;
    case "diagram_label_too_long":
      return `${title}: ノード \`${first}\` の文字が、折り返してもノードに収まりません。ノードの \`w\`・\`h\` を広げるか、文字を短くしてください。`;
  }
}

/** 文書ごとに図の部品の範囲を読み込み、読み込めない定義を 1 件の `diagram_invalid`、読み込めたフロー図の定義を `checkFlowLayout` のずれにする。並びは文書の順、同じ文書の中は行の順 */
export function checkDiagrams(
  documents: Array<{ path: string; markdown: string }>,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const document of documents) {
    for (const found of findDiagramBlocks(document.markdown)) {
      const where = String(found.line);
      const result = readDefinition(found.directive, found.blocks);
      if (!result.ok || result.definition === undefined) {
        const warning = definitionWarning(found.directive, result.problems);
        issues.push({
          file: document.path,
          where,
          kind: "diagram_invalid",
          message: [
            warning.message,
            ...warning.items.map((item) => item.message),
          ].join(" "),
        });
        continue;
      }
      if (found.directive !== "flow") {
        continue;
      }
      const definition = result.definition as MdmarkFlowDefinition;
      const title = definition.title || found.directive;
      for (const issue of checkFlowLayout(definition)) {
        issues.push({
          file: document.path,
          where,
          kind: issue.kind,
          message: flowLayoutMessage(title, issue),
        });
      }
    }
  }
  return issues;
}

/** 点検する文書ごとに取り込み先を集め、循環を `include_circular`、それ以外を `include_target_missing` のずれにして、マーカーを記載したファイルと行の順に返却する */
export async function checkIncludes(options: {
  /** `collectCheckDocuments` の文書 */
  documents: Array<{ path: string; markdown: string }>;
  /** 設定ファイルのフォルダ */
  root: string;
}): Promise<CheckIssue[]> {
  const { documents, root } = options;
  const issues = new Map<string, CheckIssue & { line: number }>();
  for (const doc of documents) {
    const docPath = resolve(root, doc.path);
    const { problems } = await collectIncludes({
      docPath,
      markdown: doc.markdown,
      root,
    });
    for (const problem of problems) {
      const file =
        problem.file === ""
          ? doc.path
          : toPosix(relative(root, resolve(dirname(docPath), problem.file)));
      const kind =
        problem.kind === "circular"
          ? "include_circular"
          : "include_target_missing";
      // 同じマーカーを複数の文書からたどったときは 1 件にする
      issues.set(`${file}\u0000${problem.line}\u0000${kind}`, {
        file,
        where: String(problem.line),
        kind,
        message: includeProblemMessage(problem),
        line: problem.line,
      });
    }
  }
  return [...issues.values()]
    .sort((a, b) =>
      a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1,
    )
    .map(({ line: _line, ...issue }) => issue);
}

/** 端末の設定と上のフォルダの設定ファイルを重ねて読み込み、重ねた設定ファイルのそれぞれと端末の設定の構造・設定が指すファイル・`build` の対象・`checkIndex`・文書の本文の知らないマーカー・取り込み先・図の部品の定義のずれをこの並びで返却する。`unknownMarks` が `false` なら、拡張を読み込まず、知らないマーカーを点検しない。`base` があり設定に `index` があれば、`change_together` の修正漏れも確認する。`explicit` のときは `path` と端末の設定だけを重ねる */
export async function collectCheckIssues(
  path: string,
  options: {
    unknownMarks?: boolean;
    base?: string;
    cwd?: string;
    explicit?: boolean;
  } = {},
): Promise<CheckIssue[]> {
  const cwd = options.cwd ?? dirname(path);
  const layered = options.explicit
    ? await readLayeredConfig(cwd, path, "export", true)
    : await readLayeredConfig(dirname(path), undefined, "export", true);
  const shown = (target: string) =>
    displayConfigPath({ path: target, base: cwd, home: homedir() });
  if (layered.unreadable) {
    const { path: target, line, message } = layered.unreadable;
    throw new CliError(
      `${shown(target)} の ${line} 行目を YAML として読み込めません（${message}）。字下げと記載方法を修正してください。`,
    );
  }
  const shapeIssues = layered.issues.map((issue) => ({
    ...issue,
    file: shown(issue.file),
  }));
  const file = basename(path);
  const config = relativizeConfigPaths({
    config: layered.config,
    dir: dirname(path),
  });
  const loaded: LoadedConfig = { path, dir: dirname(path), config };
  const referenced = await checkReferencedFiles(loaded, file);
  const build = await checkBuild(loaded, file);
  const indexIssues = await checkIndexFile(loaded, options.base);
  const aliasIssues = (await loadAliases(loaded)).issues;
  const missingFiles = await checkDocumentFiles(loaded);
  const checkMarks = options.unknownMarks !== false;
  const extensions = checkMarks
    ? await loadExtensionDirectives(loaded, file)
    : { directives: new Set<string>(), issues: [] };
  const documents = await collectCheckDocuments(loaded);
  const unknownMarks = checkMarks
    ? checkUnknownMarks(documents, config, extensions.directives)
    : [];
  const includes = await checkIncludes({ documents, root: loaded.dir });
  const diagrams = checkDiagrams(documents);
  return [
    ...shapeIssues,
    ...referenced,
    ...build.schema,
    ...extensions.issues,
    ...checkColorTheme(config, file),
    ...checkColorScheme(config, file),
    ...build.noDocuments,
    ...indexIssues,
    ...aliasIssues,
    ...missingFiles,
    ...unknownMarks,
    ...includes,
    ...diagrams,
  ];
}

/** `--text`・`--file`・`--key`・`--base` の組を確認し、一緒に指定できない引数か足りない引数があれば `CliError` を投げる */
export function validateSourceArgs(options: {
  text?: string | undefined;
  file?: string | undefined;
  key?: string | undefined;
  base?: string | undefined;
}): void {
  const { text, file, key, base } = options;
  if (text !== undefined) {
    const others = [
      ...(base !== undefined ? ["--base"] : []),
      ...(file !== undefined ? ["--file"] : []),
      ...(key !== undefined ? ["--key"] : []),
    ];
    if (others.length > 0) {
      throw new CliError(
        `--text は ${others.join("・")} と一緒に指定できません。Markdown の文字列は --text だけで、YAML のキーの値は --file と --key で点検してください。`,
      );
    }
    return;
  }
  if (file === undefined && key === undefined) {
    return;
  }
  if (file === undefined || key === undefined) {
    throw new CliError(
      "--file と --key は一緒に指定してください（例 --file records.yaml --key items[0].body）。",
    );
  }
  if (base !== undefined) {
    throw new CliError(
      "--file は --base と一緒に指定できません。--base は設定と索引の点検だけで使用できます。",
    );
  }
}

/** 設定の構造・設定が指すファイル・`build` の対象・`checkIndex`・文書の本文の知らないマーカーのずれを集め、`{ファイル}:{場所}: {種類}: {内容}` の行と `ずれ {件数} 件` を出す。`text` か `file` を指定したときは、指定した Markdown の記法だけを点検する */
export async function runCheck(
  options: {
    config?: string | undefined;
    base?: string | undefined;
    text?: string | undefined;
    file?: string | undefined;
    key?: string | undefined;
  },
  io: CliIo,
): Promise<0 | 1> {
  validateSourceArgs(options);
  const fromSource = options.text !== undefined || options.file !== undefined;
  const issues = fromSource
    ? await checkMarkdownSource({
        cwd: io.cwd,
        config: options.config,
        text: options.text,
        file: options.file,
        key: options.key,
        importCode: importBundledCode,
      })
    : await collectCheckIssues(await findConfigFile(io.cwd, options.config), {
        cwd: io.cwd,
        explicit: options.config !== undefined,
        ...(options.base === undefined ? {} : { base: options.base }),
      });
  for (const issue of issues) {
    io.stdout(formatCheckIssue(issue));
  }
  io.stdout(`ずれ ${issues.length} 件`);
  return issues.length === 0 ? 0 : 1;
}
