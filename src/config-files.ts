import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse, YAMLParseError } from "yaml";
import { validateAliasRows } from "./cli/alias-schema.ts";
import type { CheckIssue } from "./cli/check.ts";
import { VERSION_PATTERN } from "./cli/versions.ts";
import { MARK_NAME_PATTERN, type MdmarkConfig } from "./config.ts";

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

  // 知らない名前はここでは拒まず、設定に残す（`mdmark check` と書き出しの警告が知らせる）
  if (raw.colorTheme !== undefined && typeof raw.colorTheme !== "string") {
    issues.push(
      schemaIssue(
        file,
        "colorTheme",
        "`colorTheme` はテーマの名前の文字列で書いてください。",
      ),
    );
    delete config.colorTheme;
  }

  // 知らない値はここでは拒まず、設定に残す（`mdmark check` が知らせる）
  if (raw.colorScheme !== undefined && typeof raw.colorScheme !== "string") {
    issues.push(
      schemaIssue(
        file,
        "colorScheme",
        "`colorScheme` は `light`・`dark`・`auto` のどれかの文字列で書いてください。",
      ),
    );
    delete config.colorScheme;
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

  if (raw.labels !== undefined && !isValidLabels(raw.labels, file, issues)) {
    delete config.labels;
  }

  if (raw.syntax !== undefined && !isValidSyntax(raw.syntax, file, issues)) {
    delete config.syntax;
  }

  if (
    raw["html-scripts"] !== undefined &&
    !isValidHtmlScripts(raw["html-scripts"], file, issues)
  ) {
    delete config["html-scripts"];
  }

  if (raw.assets !== undefined && !isValidAssets(raw.assets, file, issues)) {
    delete config.assets;
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

/** 設定の `tooltips` を検める。キーと値の形でなければ、`placement`・`diagramPlacement` が `top` と `bottom` のどちらでもなければ、`schema` のずれを積んで `false` を返す */
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
        "`tooltips` は `placement`・`diagramPlacement` を持つキーと値で書いてください。",
      ),
    );
    return false;
  }
  let valid = true;
  for (const key of ["placement", "diagramPlacement"] as const) {
    const placement = value[key];
    if (
      placement !== undefined &&
      placement !== "top" &&
      placement !== "bottom"
    ) {
      issues.push(
        schemaIssue(
          file,
          `tooltips.${key}`,
          `\`tooltips.${key}\` は \`top\` か \`bottom\` で書いてください。`,
        ),
      );
      valid = false;
    }
  }
  return valid;
}

/** 設定の `labels` を検める。キーと値の形でなければ、`paramCopy` が空でない文字列でなければ、`schema` のずれを積んで `false` を返す（知らないキーは拒まない） */
function isValidLabels(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "labels",
        "`labels` は部品の文言のキーと値で書いてください。",
      ),
    );
    return false;
  }
  if (
    value.paramCopy !== undefined &&
    (typeof value.paramCopy !== "string" || value.paramCopy === "")
  ) {
    issues.push(
      schemaIssue(
        file,
        "labels.paramCopy",
        "`labels.paramCopy` は空でない文字列で書いてください。",
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

/** 設定の `assets` を検める。キーと値の形でなければ、`root` が文字列でなければ、`schema` のずれを積んで `false` を返す */
function isValidAssets(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "assets",
        "`assets` は `root` を持つキーと値で書いてください。",
      ),
    );
    return false;
  }
  if (value.root !== undefined && typeof value.root !== "string") {
    issues.push(
      schemaIssue(
        file,
        "assets.root",
        "`assets.root` は設定ファイルのフォルダからのフォルダのパスの文字列で書いてください。",
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

/** 設定の `html-scripts` を検める。キーと値の形でなければ、`url` が文字列でなければ、`schema` のずれを積んで `false` を返す */
function isValidHtmlScripts(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "html-scripts",
        "`html-scripts` は `url` を持つキーと値で書いてください。",
      ),
    );
    return false;
  }
  if (value.url !== undefined && typeof value.url !== "string") {
    issues.push(
      schemaIssue(
        file,
        "html-scripts.url",
        "`html-scripts.url` は変換のライブラリの ES モジュールの URL かパスの文字列で書いてください。",
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

/** 設定ファイルの名前 */
export const CONFIG_FILE = "mdmark.config.yaml";

/** `${XDG_CONFIG_HOME:-~/.config}/mdmark/` の下の端末の設定のファイル名 */
export const SETTINGS_FILE = "settings.yaml";

/** `http:`・`https:` の URL か */
const HTTP_PATTERN = /^https?:/i;

/** 重ねた設定ファイル 1 つの場所と層 */
export type ConfigFile = {
  /** 絶対パス */
  path: string;
  /** 端末の設定か、フォルダの `mdmark.config.yaml` か */
  layer: "settings" | "folder";
};

/** `loadLayeredConfig` の戻り値 */
export type LayeredConfig = {
  /** 重ねた設定。相対パスの値はその値を書いた設定ファイルのフォルダから解決した絶対パス */
  config: CliConfig;
  /** 重ねた設定ファイルを重ねた順（端末の設定 → 上 → 近い）に並べたもの */
  files: ConfigFile[];
  /** 最も近い `mdmark.config.yaml` の絶対パス（`explicit` のときはそのパス） */
  nearest: string | undefined;
  /** YAML として読めなかった最初の設定ファイル */
  unreadable: { path: string; line: number; message: string } | undefined;
  /** 重ねた設定ファイルごとの `schema` のずれ（`file` は絶対パス） */
  issues: CheckIssue[];
};

/** `explicit` のファイルが無い */
export class ConfigNotFoundError extends Error {
  override name = "ConfigNotFoundError";
}

/** `MDMARK_CONFIG`、無ければ `${XDG_CONFIG_HOME:-{home}/.config}/mdmark/settings.yaml` を返す */
export const resolveSettingsPath = (options: {
  env: Record<string, string | undefined>;
  home: string;
}): string => {
  const { env, home } = options;
  if (env.MDMARK_CONFIG) {
    return env.MDMARK_CONFIG;
  }
  const base = env.XDG_CONFIG_HOME || join(home, ".config");
  return join(base, "mdmark", SETTINGS_FILE);
};

/** `cwd` から上へ `mdmark.config.yaml` を探し、上 → 近いの順に返す */
export const findConfigChain = async (options: {
  cwd: string;
  cascade: boolean;
  isFile: (path: string) => Promise<boolean>;
}): Promise<string[]> => {
  const found: string[] = [];
  let dir = options.cwd;
  for (;;) {
    const path = join(dir, CONFIG_FILE);
    if (await options.isFile(path)) {
      found.push(path);
      if (!options.cascade) {
        break;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return found.reverse();
};

/** パスの値を `dir` から絶対パスにする。URL は替えない */
const absolutize = (value: string, dir: string): string =>
  HTTP_PATTERN.test(value) || isAbsolute(value) ? value : resolve(dir, value);

/** `dir` の下の絶対パスを `dir` からの相対パス（区切りは `/`）にする。URL と外のパスは替えない */
const relativize = (value: string, dir: string): string =>
  isAbsolute(value) && isInside(value, dir)
    ? relative(dir, value).split(sep).join("/")
    : value;

/** 設定のパスの値（`theme`・`index`・`assets.root`・`build`・`extensions`・`libraries`・`html-scripts.url`・`syntax.url`・`aliases` の `paths`）を `map` で替えた設定を返す（渡した設定は書き換えない） */
const mapConfigPaths = (
  config: CliConfig,
  map: (value: string) => string,
): CliConfig => {
  const all = (values: string[]) => values.map(map);
  const result: CliConfig = { ...config };
  if (typeof config.theme === "string") {
    result.theme = map(config.theme);
  }
  if (typeof config.index === "string") {
    result.index = map(config.index);
  }
  if (config.extensions) {
    result.extensions = all(config.extensions);
  }
  if (isRecord(config.libraries)) {
    result.libraries = Object.fromEntries(
      Object.entries(config.libraries).map(([name, url]) => [
        name,
        typeof url === "string" ? map(url) : url,
      ]),
    ) as CliConfig["libraries"];
  }
  const htmlScripts = config["html-scripts"];
  if (isRecord(htmlScripts) && typeof htmlScripts.url === "string") {
    result["html-scripts"] = { ...htmlScripts, url: map(htmlScripts.url) };
  }
  if (isRecord(config.syntax) && typeof config.syntax.url === "string") {
    result.syntax = { ...config.syntax, url: map(config.syntax.url) };
  }
  if (isRecord(config.assets) && typeof config.assets.root === "string") {
    result.assets = { ...config.assets, root: map(config.assets.root) };
  }
  if (config.build) {
    const build = { ...config.build };
    build.include = all(build.include);
    build.out = map(build.out);
    if (build.exclude) {
      build.exclude = all(build.exclude);
    }
    if (build.glossary) {
      build.glossary = all(build.glossary);
    }
    if (build.entry !== undefined) {
      build.entry = map(build.entry);
    }
    result.build = build;
  }
  if (config.aliases) {
    result.aliases = config.aliases.map((row) =>
      isRecord(row) && Array.isArray(row.paths)
        ? {
            ...row,
            paths: row.paths.map((path: unknown) =>
              typeof path === "string" ? map(path) : path,
            ),
          }
        : row,
    );
  }
  return result;
};

/** 1 つの層の設定の相対パスの値を、その層のファイルのフォルダから絶対パスにする（渡した設定は書き換えない） */
export const absolutizeConfigPaths = (options: {
  config: CliConfig;
  dir: string;
}): CliConfig =>
  mapConfigPaths(options.config, (value) => absolutize(value, options.dir));

/** 重ねた設定のパスの値のうち `dir` の下のものを `dir` からの相対パスに戻す（CLI が最も近い設定ファイルのフォルダを基準に読むため） */
export const relativizeConfigPaths = (options: {
  config: CliConfig;
  dir: string;
}): CliConfig =>
  mapConfigPaths(options.config, (value) => relativize(value, options.dir));

/** 前の値と後の値を重ねる。どちらもマップならキーごとに、それ以外は後の値 */
const mergeValue = (before: unknown, after: unknown): unknown => {
  if (!isRecord(before) || !isRecord(after)) {
    return after;
  }
  const merged: Record<string, unknown> = { ...before };
  for (const [key, value] of Object.entries(after)) {
    merged[key] = key in merged ? mergeValue(merged[key], value) : value;
  }
  return merged;
};

/** 層を前から順に重ね、マップはキーごとに、それ以外は後の値で置き換える */
export const mergeConfigs = (layers: CliConfig[]): CliConfig =>
  layers.reduce<CliConfig>(
    (merged, layer) => mergeValue(merged, layer) as CliConfig,
    {},
  );

/** `path` が `dir` の下にあるか */
function isInside(path: string, dir: string): boolean {
  const rel = relative(dir, path);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** 基準のフォルダの中なら相対パス、外ならホームを `~` にしたパスを返す（区切りは `/`） */
export const displayConfigPath = (options: {
  path: string;
  base: string;
  home: string;
}): string => {
  const { path, base, home } = options;
  if (isInside(path, base)) {
    return relative(base, path).split(sep).join("/");
  }
  if (isInside(path, home)) {
    return `~/${relative(home, path).split(sep).join("/")}`;
  }
  return path.split(sep).join("/");
};

/** 端末の設定の `serve.tmuxSession` に使える文字 */
const TMUX_SESSION_PATTERN = /^[A-Za-z0-9_-]+$/;

/** 端末の設定の `serve` がマップで、`serve.tmuxSession` が英数字・`_`・`-` の文字列かを検める */
const validateServeKeys = (
  raw: Record<string, unknown>,
  file: string,
): CheckIssue[] => {
  if (raw.serve === undefined) {
    return [];
  }
  if (!isRecord(raw.serve)) {
    return [
      schemaIssue(
        file,
        "serve",
        "`serve` は `tmuxSession` を持つキーと値で書いてください。",
      ),
    ];
  }
  const session = raw.serve.tmuxSession;
  if (
    session !== undefined &&
    (typeof session !== "string" || !TMUX_SESSION_PATTERN.test(session))
  ) {
    return [
      schemaIssue(
        file,
        "serve.tmuxSession",
        "`serve.tmuxSession` は英数字・`_`・`-` の文字列で書いてください。",
      ),
    ];
  }
  return [];
};

/** 端末の設定の `config` がマップで、`config.cascade`・`config.applyToExport` が真偽値か、`serve.tmuxSession` が使える名前かを検める */
export const validateSettingsKeys = (
  raw: unknown,
  file: string,
): CheckIssue[] => {
  if (!isRecord(raw)) {
    return [];
  }
  const serveIssues = validateServeKeys(raw, file);
  if (raw.config === undefined) {
    return serveIssues;
  }
  if (!isRecord(raw.config)) {
    return [
      ...serveIssues,
      schemaIssue(
        file,
        "config",
        "`config` は `cascade`・`applyToExport` を持つキーと値で書いてください。",
      ),
    ];
  }
  const issues: CheckIssue[] = [...serveIssues];
  for (const key of ["cascade", "applyToExport"] as const) {
    const value = raw.config[key];
    if (value !== undefined && typeof value !== "boolean") {
      issues.push(
        schemaIssue(
          file,
          `config.${key}`,
          `\`config.${key}\` は true か false で書いてください。`,
        ),
      );
    }
  }
  return issues;
};

/** 読んだ 1 つの層 */
type ReadLayer =
  | { kind: "missing" }
  | { kind: "unreadable"; line: number; message: string }
  | { kind: "read"; raw: unknown };

/** 設定ファイルを読み、YAML として読む。`ENOENT` は `missing` */
const readLayer = async (
  path: string,
  readFile: (path: string) => Promise<string>,
): Promise<ReadLayer> => {
  let text: string;
  try {
    text = await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing" };
    }
    throw error;
  }
  try {
    return { kind: "read", raw: parse(text) };
  } catch (error) {
    if (error instanceof YAMLParseError) {
      return {
        kind: "unreadable",
        line: error.linePos?.[0].line ?? 1,
        message: error.message.split("\n")[0] ?? "",
      };
    }
    throw error;
  }
};

/** 端末の設定と上のフォルダの設定ファイルを読み、形を検めて、相対パスを絶対パスにしてから重ねる */
export const loadLayeredConfig = async (options: {
  cwd: string;
  explicit?: string | undefined;
  purpose: "preview" | "export";
  env: Record<string, string | undefined>;
  home: string;
  readFile: (path: string) => Promise<string>;
  isFile: (path: string) => Promise<boolean>;
  explicitName: string;
  /** 形の合わない設定ファイルも、合うところだけを重ねるか（`mdmark check` が残りを点検するため） */
  keepInvalid?: boolean;
}): Promise<LayeredConfig> => {
  const issues: CheckIssue[] = [];
  let unreadable: LayeredConfig["unreadable"];
  const layers: Array<{ file: ConfigFile; config: CliConfig }> = [];

  // 1 つの層を読んで検める。読めて形が合えば検めた設定を返す
  const take = async (
    path: string,
    layer: ConfigFile["layer"],
  ): Promise<{ raw: unknown; config: CliConfig } | undefined> => {
    const read = await readLayer(path, options.readFile);
    if (read.kind === "missing") {
      return undefined;
    }
    if (read.kind === "unreadable") {
      unreadable ??= { path, line: read.line, message: read.message };
      return undefined;
    }
    const raw =
      layer === "folder" && isRecord(read.raw) && "config" in read.raw
        ? Object.fromEntries(
            Object.entries(read.raw).filter(([key]) => key !== "config"),
          )
        : read.raw;
    const shape = validateConfig(raw, path);
    const own =
      layer === "settings" ? validateSettingsKeys(read.raw, path) : [];
    const found = [...shape.issues, ...own];
    issues.push(...found);
    if (found.length > 0 && !options.keepInvalid) {
      return undefined;
    }
    return { raw: read.raw, config: shape.config };
  };

  const settingsPath = resolveSettingsPath(options);
  const settings = await take(settingsPath, "settings");
  const settingsRaw = settings && isRecord(settings.raw) ? settings.raw : {};
  const switches = isRecord(settingsRaw.config) ? settingsRaw.config : {};
  const cascade = switches.cascade === true;
  const applyToExport = switches.applyToExport !== false;
  if (settings) {
    const { config: _config, ...config } = settings.config as CliConfig & {
      config?: unknown;
    };
    layers.push({
      file: { path: settingsPath, layer: "settings" },
      config: absolutizeConfigPaths({ config, dir: dirname(settingsPath) }),
    });
  }

  let paths: string[];
  if (options.explicit !== undefined) {
    const path = resolve(options.cwd, options.explicit);
    if (!(await options.isFile(path))) {
      throw new ConfigNotFoundError(
        `${options.explicit} が見つかりません（${options.explicitName}）。パスを直すか、mdmark init で置いてください。`,
      );
    }
    paths = [path];
  } else {
    paths = await findConfigChain({
      cwd: options.cwd,
      cascade,
      isFile: options.isFile,
    });
  }
  for (const path of paths) {
    const taken = await take(path, "folder");
    if (taken) {
      layers.push({
        file: { path, layer: "folder" },
        config: absolutizeConfigPaths({
          config: taken.config,
          dir: dirname(path),
        }),
      });
    }
  }

  const used =
    options.purpose === "export" && !applyToExport
      ? layers.filter((layer) => layer.file.layer !== "settings")
      : layers;
  return {
    config: mergeConfigs(used.map((layer) => layer.config)),
    files: used.map((layer) => layer.file),
    nearest: paths.at(-1),
    unreadable,
    issues,
  };
};
