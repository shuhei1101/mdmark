import { readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import {
  type Document,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  type Node,
  parseDocument,
  Scalar,
} from "yaml";
import { resolveConfig } from "../config.ts";
import { collectWarnings } from "../render/index.ts";
import {
  type CheckIssue,
  checkMaps,
  checkUnknownMarks,
  loadExtensionDirectives,
} from "./check.ts";
import {
  type CliConfig,
  findConfigFile,
  type LoadedConfig,
  loadConfig,
  validateConfig,
} from "./config.ts";
import { CliError } from "./errors.ts";

/** `text` で指定した Markdown のずれの `file` */
const TEXT_FILE = "-";

/** キーのパスの 1 つ分（`.` で区切ったマップのキーと、`[位置]` の配列の要素） */
const KEY_PART_PATTERN = /([^.[\]]+)|\[(\d+)\]/g;

/** 読み込めるキーのパス（`items[0].body`） */
const KEY_PATH_PATTERN = /^[^.[\]]+(?:\[\d+\])*(?:\.[^.[\]]+(?:\[\d+\])*)*$/;

/** 同じ行のずれを並べる順（警告・知らないマーカーとスキップした引数・map のずれ） */
function issueRank(issue: CheckIssue): number {
  if (
    issue.kind === "diagram_invalid" ||
    issue.kind === "retired_diagram" ||
    issue.kind === "syntax_warning"
  ) {
    return 0;
  }
  return issue.kind === "unknown_mark" || issue.kind === "unknown_mark_arg"
    ? 1
    : 2;
}

/** キーのパスを、マップのキーの文字と配列の位置の並びに分ける */
function splitKeyPath(key: string): Array<string | number> {
  return [...key.matchAll(KEY_PART_PATTERN)].map((match) =>
    match[2] === undefined ? (match[1] ?? "") : Number(match[2]),
  );
}

/** たどったキーのパスの文字（`items[0]`） */
function joinKeyPath(parts: Array<string | number>): string {
  return parts
    .map((part, position) =>
      typeof part === "number"
        ? `[${part}]`
        : position === 0
          ? part
          : `.${part}`,
    )
    .join("");
}

/** 値の YAML の型の名前（文字列でないときの通知に記載する） */
function nodeTypeName(node: Node | null | undefined): string {
  if (isMap(node)) {
    return "マップ";
  }
  if (isSeq(node)) {
    return "配列";
  }
  if (isScalar(node)) {
    return node.value === null ? "null" : typeof node.value;
  }
  return "値なし";
}

/** YAML のファイルを読み込み、文書と行の数え方を返却する。開けない・YAML として読めないときは例外を投げる */
async function readYamlDocument(
  path: string,
  name: string,
): Promise<{ document: Document.Parsed; lineCounter: LineCounter }> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliError(
      `${name} を開けません（${error instanceof Error ? error.message : String(error)}）。--file のパスを確認してください。`,
    );
  }
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { lineCounter });
  const [parseError] = document.errors;
  if (parseError) {
    const line = parseError.linePos?.[0].line ?? "?";
    const reason = parseError.message.split("\n")[0] ?? "";
    throw new CliError(
      `${name} の ${line} 行目を YAML として読み込めません（${reason}）。字下げと記載方法を修正してください。`,
    );
  }
  return { document, lineCounter };
}

/** キーのパスをたどる 1 歩: 配列の要素かマップのキーへ進み、進んだ値と、値を持つキーの位置を返却する。たどれなければ例外を投げる */
function stepKeyPath(options: {
  node: Node | null | undefined;
  part: string | number;
  /** ずれの文言の、ファイル名・キーのパス・たどった親 */
  names: { name: string; key: string; parent: string };
}): { node: Node | null | undefined; offset: number | undefined } {
  const { node, part } = options;
  const { name, key, parent } = options.names;
  if (typeof part === "number") {
    if (!isSeq(node)) {
      throw new CliError(
        `${name} に ${key} がありません（${parent} は配列ではありません）。キーのパスを確認してください。`,
      );
    }
    const item: unknown = node.items[part];
    if (item === undefined) {
      throw new CliError(
        `${name} に ${key} がありません（${parent} は ${node.items.length} 要素です）。位置を 0〜${node.items.length - 1} で記載してください。`,
      );
    }
    const next = item as Node;
    return { node: next, offset: next?.range?.[0] };
  }
  if (!isMap(node)) {
    throw new CliError(
      `${name} に ${key} がありません（${parent} はマップではありません）。キーのパスを確認してください。`,
    );
  }
  const pair = node.items.find(
    (candidate) => isScalar(candidate.key) && candidate.key.value === part,
  );
  if (pair === undefined) {
    throw new CliError(
      `${name} に ${key} がありません（${parent} にキー ${part} がありません）。キーのパスを確認してください。`,
    );
  }
  return {
    node: pair.value as Node | null,
    offset: (pair.key as Scalar).range?.[0],
  };
}

/** YAML のファイルを読み込み、キーのパスをたどって文字列の値と、値の中の行（1 から）をファイルの行（1 から）に置き換える関数を返却する */
export async function readYamlKey(options: {
  path: string;
  key: string;
}): Promise<{ value: string; lineOf: (line: number) => number }> {
  const { path, key } = options;
  const name = basename(path);
  const { document, lineCounter } = await readYamlDocument(path, name);
  if (!KEY_PATH_PATTERN.test(key)) {
    throw new CliError(
      `--key の ${key} をキーのパスとして読み込めません。マップのキーを . で、配列の要素を [位置] でつないでください（例 items[0].body）。`,
    );
  }
  const parts = splitKeyPath(key);
  let node: Node | null | undefined = document.contents;
  // 値を持つキーの行（ブロックスカラーでない値の行にする）
  let keyOffset = 0;
  for (const [position, part] of parts.entries()) {
    const walked = joinKeyPath(parts.slice(0, position));
    const parent = walked === "" ? "ファイルの先頭" : walked;
    const step = stepKeyPath({ node, part, names: { name, key, parent } });
    node = step.node;
    keyOffset = step.offset ?? keyOffset;
  }
  if (!isScalar(node) || typeof node.value !== "string") {
    throw new CliError(
      `${name} の ${key} の値は文字列ではありません（${nodeTypeName(node)}）。Markdown の文字列を持つキーを指定してください。`,
    );
  }
  return {
    value: node.value,
    lineOf: valueLineOf({ node, lineCounter, keyOffset }),
  };
}

/** 値の行から YAML のファイルの行を返却する関数。ブロックスカラーは値の行ごと、それ以外は値を持つキーの行 */
function valueLineOf(options: {
  node: Scalar;
  lineCounter: LineCounter;
  keyOffset: number;
}): (line: number) => number {
  const { node, lineCounter, keyOffset } = options;
  const block =
    node.type === Scalar.BLOCK_LITERAL || node.type === Scalar.BLOCK_FOLDED;
  if (block) {
    // 値の 1 行目はインジケータ（`|`・`>`）の次の行
    const indicatorLine = lineCounter.linePos(node.range?.[0] ?? 0).line;
    return (line) => indicatorLine + line;
  }
  const keyLine = lineCounter.linePos(keyOffset).line;
  return () => keyLine;
}

/** `cwd` から上へ探した設定ファイル（`config` を指定すればそのファイル）を読み込む。`config` を指定せずに見つからなければ `undefined` */
async function readConfigIfAny(
  cwd: string,
  config: string | undefined,
): Promise<LoadedConfig | undefined> {
  let path: string;
  try {
    path = await findConfigFile(cwd, config);
  } catch (error) {
    if (config === undefined && error instanceof CliError) {
      return undefined;
    }
    throw error;
  }
  const read = await loadConfig(path);
  const { config: validated } = validateConfig(read.raw, basename(path));
  return { path, dir: read.dir, config: validated };
}

/** 点検する Markdown と、ずれの `file`・行の直し方。`--file` は YAML のキーの値、それ以外は `--text` の文字列 */
async function readMarkdownSource(
  options: {
    cwd: string;
    text?: string | undefined;
    file?: string | undefined;
    key?: string | undefined;
  },
  loaded: LoadedConfig | undefined,
): Promise<{
  markdown: string;
  file: string;
  lineOf: (line: number) => number;
}> {
  const { cwd } = options;
  if (options.file === undefined) {
    return {
      markdown: options.text ?? "",
      file: TEXT_FILE,
      lineOf: (line) => line,
    };
  }
  const path = resolve(cwd, options.file);
  const read = await readYamlKey({ path, key: options.key ?? "" });
  return {
    markdown: read.value,
    file: relative(loaded?.dir ?? cwd, path)
      .split(sep)
      .join("/"),
    lineOf: read.lineOf,
  };
}

/** 描いたときの警告のずれ。取り込み先を読み込まないため、include の取り込み先が無い警告は出さない。map の警告は checkMaps の項目ごとのずれにする */
function markdownWarnings(options: {
  markdown: string;
  config: CliConfig;
  file: string;
}): CheckIssue[] {
  const { markdown, config, file } = options;
  return collectWarnings(markdown, {
    config: {
      ...(config.features ? { features: config.features } : {}),
      ...(config.libraries ? { libraries: config.libraries } : {}),
    },
  }).flatMap((warning) =>
    warning.includeTarget || warning.kind === "map"
      ? []
      : [
          {
            file,
            where: String(warning.line),
            kind: warning.kind,
            message: warning.message,
          },
        ],
  );
}

/** Markdown の文字列か、YAML のファイルのキーの値を、描いたときの記載の警告・スキップした記法のマーカーの引数・知らないマーカー・図の配置のずれにして返却する */
export async function checkMarkdownSource(options: {
  cwd: string;
  config?: string | undefined;
  text?: string | undefined;
  file?: string | undefined;
  key?: string | undefined;
  importCode: (code: string) => Promise<unknown>;
}): Promise<CheckIssue[]> {
  const { cwd, importCode } = options;
  const loaded = await readConfigIfAny(cwd, options.config);
  const config: CliConfig = loaded?.config ?? {};
  const { markdown, file, lineOf } = await readMarkdownSource(options, loaded);
  const directives = loaded
    ? (await loadExtensionDirectives(loaded, basename(loaded.path), importCode))
        .directives
    : new Set<string>();
  const document = [{ path: file, markdown }];
  const warnings = markdownWarnings({ markdown, config, file });
  const maps = checkMaps(document, resolveConfig({ config }));
  const unknownMarks = checkUnknownMarks(document, config, directives);
  return [...warnings, ...unknownMarks, ...maps]
    .map((issue, order) => ({ issue, order }))
    .sort(
      (a, b) =>
        Number(a.issue.where) - Number(b.issue.where) ||
        issueRank(a.issue) - issueRank(b.issue) ||
        a.order - b.order,
    )
    .map(({ issue }) => ({
      ...issue,
      where: String(lineOf(Number(issue.where))),
    }));
}
