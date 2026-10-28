import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parse, YAMLParseError } from "yaml";
import { MARK_NAME_PATTERN, type MdmarkConfig } from "../config.ts";
import { validateAliasRows } from "./alias-schema.ts";
import type { CheckIssue } from "./check.ts";
import { CliError } from "./errors.ts";
import { VERSION_PATTERN } from "./versions.ts";

/** `mdmark build` が読む設定の `build` */
export type BuildConfig = {
  /** まとめる Markdown の glob */
  include: string[];
  /** `include` に当たった文書から外す glob */
  exclude?: string[];
  /** 用語集の表を持つ文書のパス */
  glossary?: string[];
  /** 最初に開く文書のパス */
  entry?: string;
  /** 書き出す HTML のパス */
  out: string;
};

/** `MdmarkConfig` に CLI だけが読むキーを足した設定 */
export type CliConfig = MdmarkConfig & {
  /** この設定・索引・文書が合わせてある mdmark の版 */
  version?: string;
  /** 索引の YAML のパス */
  index?: string;
  /** 書き出しに埋める使う側の CSS のパス */
  theme?: string;
  /** 書き出しに埋める拡張のモジュールのパス */
  extensions?: string[];
  /** まとめる設定 */
  build?: BuildConfig;
  /** `mdmark check` の設定 */
  check?: CheckConfig;
  /** エイリアスの元の行の並び。Schema に合わない行は `null` */
  aliases?: unknown[];
};

/** `mdmark check` が読む設定の `check` */
export type CheckConfig = {
  /** 知らない印として知らせない印の名前の並び */
  ignore?: string[];
};

/** 見つけた設定ファイルの場所と、読んだ値 */
export type LoadedConfig = {
  /** 設定ファイルの絶対パス */
  path: string;
  /** 設定ファイルのあるフォルダ（設定のパスと glob の基準） */
  dir: string;
  /** 読んだ値 */
  config: CliConfig;
};

/** 設定ファイルの名前 */
export const CONFIG_FILE = "mdmark.config.yaml";

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 値が文字列だけの並びか */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/** ファイルが在るか */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** `--config` があればそのパスを、無ければ今のフォルダから上へ順に最初に見つかった設定ファイルの絶対パスを返す */
export async function findConfigFile(
  cwd: string,
  explicit: string | undefined,
): Promise<string> {
  if (explicit !== undefined) {
    const path = resolve(cwd, explicit);
    if (await isFile(path)) {
      return path;
    }
    throw new CliError(
      `${explicit} が見つかりません（--config のパス）。パスを直すか、mdmark init で置いてください。`,
    );
  }
  let dir = cwd;
  for (;;) {
    const path = join(dir, CONFIG_FILE);
    if (await isFile(path)) {
      return path;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new CliError(
        `${CONFIG_FILE} が見つかりません（${cwd} から上を探しました）。mdmark init で置けます。`,
      );
    }
    dir = parent;
  }
}

/** 設定ファイルを YAML として読み、形を検めずに返す */
export async function loadConfig(
  path: string,
): Promise<{ path: string; dir: string; raw: unknown }> {
  const name = basename(path);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new CliError(
      `${name} を開けません（${error instanceof Error ? error.message : String(error)}）。パスを確かめてください。`,
    );
  }
  try {
    return { path, dir: dirname(path), raw: parse(text) };
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0].line;
      const reason = error.message.split("\n")[0] ?? "";
      throw new CliError(
        `${name} の ${line ?? "?"} 行目を YAML として読めません（${reason}）。字下げと書き方を直してください。`,
      );
    }
    throw error;
  }
}

/** 設定のずれ 1 件を作る */
function schemaIssue(file: string, where: string, message: string): CheckIssue {
  return { file, where, kind: "schema", message };
}

/** `build` の形を検め、合うときだけ `build` を返す。合わないところは `issues` に足す */
function validateBuild(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): BuildConfig | undefined {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(file, "build", "`build` はキーと値で書いてください。"),
    );
    return undefined;
  }
  const before = issues.length;
  if (value.include === undefined) {
    issues.push(
      schemaIssue(
        file,
        "build",
        "`build.include` がありません。まとめる Markdown の glob を書いてください。",
      ),
    );
  } else if (!isStringArray(value.include) || value.include.length === 0) {
    issues.push(
      schemaIssue(
        file,
        "build.include",
        "`build.include` は 1 つ以上の glob の並びで書いてください。",
      ),
    );
  }
  if (value.out === undefined) {
    issues.push(
      schemaIssue(
        file,
        "build",
        "`build.out` がありません。書き出す HTML のパスを書いてください。",
      ),
    );
  } else if (typeof value.out !== "string" || !value.out.endsWith(".html")) {
    issues.push(
      schemaIssue(
        file,
        "build.out",
        "`build.out` は拡張子 `.html` のパスで書いてください。",
      ),
    );
  }
  for (const key of ["exclude", "glossary"] as const) {
    if (value[key] !== undefined && !isStringArray(value[key])) {
      issues.push(
        schemaIssue(
          file,
          `build.${key}`,
          `\`build.${key}\` は文字列の並びで書いてください。`,
        ),
      );
    }
  }
  if (value.entry !== undefined && typeof value.entry !== "string") {
    issues.push(
      schemaIssue(
        file,
        "build.entry",
        "`build.entry` は文書のパスの文字列で書いてください。",
      ),
    );
  }
  return issues.length === before ? (value as BuildConfig) : undefined;
}

/** 読んだ値を `schemas/mdmark.config.schema.json` と同じ形で検め、合うところだけを残した設定と、合わないところごとの `schema` のずれを返す */
export function validateConfig(
  raw: unknown,
  file: string,
): { config: CliConfig; issues: CheckIssue[] } {
  const issues: CheckIssue[] = [];
  if (!isRecord(raw)) {
    issues.push(
      schemaIssue(
        file,
        "",
        `${file} が空か、キーと値の形ではありません。設定のキーを書いてください。`,
      ),
    );
    return { config: {}, issues };
  }
  // 知らないキーは拒まず、そのまま残す
  const config: Record<string, unknown> = { ...raw };

  if (raw.features !== undefined) {
    const features: Record<string, boolean> = {};
    if (isRecord(raw.features)) {
      for (const [name, value] of Object.entries(raw.features)) {
        if (typeof value === "boolean") {
          features[name] = value;
        } else {
          issues.push(
            schemaIssue(
              file,
              `features.${name}`,
              `\`features.${name}\` は true か false で書いてください。`,
            ),
          );
        }
      }
      config.features = features;
    } else {
      issues.push(
        schemaIssue(
          file,
          "features",
          "`features` は機能名と true / false で書いてください。",
        ),
      );
      delete config.features;
    }
  }

  if (raw.libraries !== undefined) {
    if (isRecord(raw.libraries)) {
      const libraries: Record<string, string> = {};
      for (const [name, url] of Object.entries(raw.libraries)) {
        if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
          issues.push(
            schemaIssue(
              file,
              `libraries.${name}`,
              `\`libraries.${name}\` は、英小文字で始まる印の名前と URL の文字列で書いてください。`,
            ),
          );
        } else {
          libraries[name] = url;
        }
      }
      config.libraries = libraries;
    } else {
      issues.push(
        schemaIssue(
          file,
          "libraries",
          "`libraries` は印の名前と URL で書いてください。",
        ),
      );
      delete config.libraries;
    }
  }

  if (raw.version !== undefined) {
    if (typeof raw.version !== "string" || !VERSION_PATTERN.test(raw.version)) {
      issues.push(
        schemaIssue(
          file,
          "version",
          "`version` は v{MAJOR}.{MINOR}.{PATCH} の形で書いてください。",
        ),
      );
      delete config.version;
    }
  }

  for (const key of ["index", "theme"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      issues.push(
        schemaIssue(
          file,
          key,
          `\`${key}\` はファイルのパスの文字列で書いてください。`,
        ),
      );
      delete config[key];
    }
  }

  if (raw.extensions !== undefined && !isStringArray(raw.extensions)) {
    issues.push(
      schemaIssue(
        file,
        "extensions",
        "`extensions` は拡張のモジュールのパスの並びで書いてください。",
      ),
    );
    delete config.extensions;
  }

  if (raw.build !== undefined) {
    const build = validateBuild(raw.build, file, issues);
    if (build) {
      config.build = build;
    } else {
      delete config.build;
    }
  }

  if (
    raw.tooltips !== undefined &&
    !isValidTooltips(raw.tooltips, file, issues)
  ) {
    delete config.tooltips;
  }

  if (raw.syntax !== undefined && !isValidSyntax(raw.syntax, file, issues)) {
    delete config.syntax;
  }

  if (
    raw["side-toc"] !== undefined &&
    !isValidSideToc(raw["side-toc"], file, issues)
  ) {
    delete config["side-toc"];
  }

  if (raw.aliases !== undefined) {
    if (Array.isArray(raw.aliases)) {
      const checked = validateAliasRows(raw.aliases, file);
      issues.push(...checked.issues);
      config.aliases = checked.rows;
    } else {
      issues.push(
        schemaIssue(
          file,
          "aliases",
          "`aliases` はエイリアスの元の行の並びで書いてください。",
        ),
      );
      delete config.aliases;
    }
  }

  if (raw.check !== undefined) {
    const check = validateCheck(raw.check, file, issues);
    if (check) {
      config.check = check;
    } else {
      delete config.check;
    }
  }

  return { config: config as CliConfig, issues };
}

/** 設定の `tooltips` を検める。キーと値の形でなければ、`placement` が `top` と `bottom` のどちらでもなければ、`schema` のずれを積んで `false` を返す */
function isValidTooltips(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "tooltips",
        "`tooltips` は `placement` を持つキーと値で書いてください。",
      ),
    );
    return false;
  }
  if (
    value.placement !== undefined &&
    value.placement !== "top" &&
    value.placement !== "bottom"
  ) {
    issues.push(
      schemaIssue(
        file,
        "tooltips.placement",
        "`tooltips.placement` は `top` か `bottom` で書いてください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `side-toc` を検める。キーと値の形でなければ、`mode` が `hover` と `fixed` のどちらでもなければ、`schema` のずれを積んで `false` を返す */
function isValidSideToc(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "side-toc",
        "`side-toc` は `mode` を持つキーと値で書いてください。",
      ),
    );
    return false;
  }
  if (
    value.mode !== undefined &&
    value.mode !== "hover" &&
    value.mode !== "fixed"
  ) {
    issues.push(
      schemaIssue(
        file,
        "side-toc.mode",
        "`side-toc.mode` は `hover` か `fixed` で書いてください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `syntax` を検める。キーと値の形でなければ、`url` が文字列でなければ、`schema` のずれを積んで `false` を返す */
function isValidSyntax(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "syntax",
        "`syntax` は `url` を持つキーと値で書いてください。",
      ),
    );
    return false;
  }
  if (value.url !== undefined && typeof value.url !== "string") {
    issues.push(
      schemaIssue(
        file,
        "syntax.url",
        "`syntax.url` は色分けのライブラリの `es/` フォルダの URL かパスの文字列で書いてください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `check` を検める。オブジェクトでなければ `schema` のずれにして `undefined` を返し、`ignore` は印の名前の書式に合う値だけを残す */
function validateCheck(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): CheckConfig | undefined {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "check",
        "`check` は `ignore` を持つキーと値で書いてください。",
      ),
    );
    return undefined;
  }
  if (value.ignore === undefined) {
    return value as CheckConfig;
  }
  if (!Array.isArray(value.ignore)) {
    issues.push(
      schemaIssue(
        file,
        "check.ignore",
        "`check.ignore` は印の名前の並びで書いてください。",
      ),
    );
    const rest = { ...value };
    delete rest.ignore;
    return rest as CheckConfig;
  }
  const ignore: string[] = [];
  for (const [position, name] of value.ignore.entries()) {
    if (typeof name === "string" && MARK_NAME_PATTERN.test(name)) {
      ignore.push(name);
    } else {
      issues.push(
        schemaIssue(
          file,
          `check.ignore[${position}]`,
          `\`check.ignore[${position}]\` は、英小文字で始まり、英小文字・数字・\`-\` が続く印の名前で書いてください。`,
        ),
      );
    }
  }
  return { ...value, ignore };
}

/** 設定ファイルを探して読み、形が合わなければ `mdmark check` で確かめられることを添えた誤りを投げる */
export async function requireConfig(
  cwd: string,
  explicit: string | undefined,
): Promise<LoadedConfig> {
  const loaded = await loadConfig(await findConfigFile(cwd, explicit));
  const file = basename(loaded.path);
  const { config, issues } = validateConfig(loaded.raw, file);
  const first = issues[0];
  if (first) {
    const where = first.where === "" ? "全体" : first.where;
    throw new CliError(
      `${file} の ${where} が設定の形に合いません（${first.message}）。mdmark check で合わないところを確かめられます。`,
    );
  }
  return { path: loaded.path, dir: loaded.dir, config };
}
