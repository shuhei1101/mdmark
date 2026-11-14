import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse, YAMLParseError } from "yaml";
import { validateAliasRows } from "./cli/alias-schema.ts";
import type { CheckIssue } from "./cli/check.ts";
import { VERSION_PATTERN } from "./cli/versions.ts";
import { MARK_NAME_PATTERN, type MdmarkConfig } from "./config.ts";

/** `mdmark build` が読み込む設定の `build` */
export type BuildConfig = {
  /** まとめる Markdown の glob */
  include: string[];
  /** `include` に該当した文書から除外する glob */
  exclude?: string[];
  /** 用語集の表を持つ文書のパス */
  glossary?: string[];
  /** 最初に開く文書のパス */
  entry?: string;
  /** 書き出す HTML のパス */
  out: string;
};

/** `MdmarkConfig` に CLI だけが読み込むキーを追加した設定 */
export type CliConfig = MdmarkConfig & {
  /** この設定・索引・文書が合わせてある mdmark のバージョン */
  version?: string;
  /** 索引の YAML のパス */
  index?: string;
  /** 書き出しに埋める利用側の CSS のパス */
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

/** `mdmark check` が読み込む設定の `check` */
export type CheckConfig = {
  /** 知らないマーカーとして通知しないマーカーの名前の並び */
  ignore?: string[];
  /** 記法を含む純粋な `.md` に、拡張子を `.mark.md` に変えるよう提案するか（省略時は提案する） */
  suggestMarkExtension?: boolean;
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

/** `build` のキー 1 つを検め、合わなければ通知する場所と文言を返却する */
type BuildRule = (
  value: Record<string, unknown>,
) => { where: string; message: string } | undefined;

/** `build` のキーの検め方を、検める順に並べた表 */
const BUILD_RULES: BuildRule[] = [
  ({ include }) => {
    if (include === undefined) {
      return {
        where: "build",
        message:
          "`build.include` がありません。まとめる Markdown の glob を記載してください。",
      };
    }
    return isStringArray(include) && include.length > 0
      ? undefined
      : {
          where: "build.include",
          message:
            "`build.include` は 1 つ以上の glob の並びで記載してください。",
        };
  },
  ({ out }) => {
    if (out === undefined) {
      return {
        where: "build",
        message:
          "`build.out` がありません。書き出す HTML のパスを記載してください。",
      };
    }
    return typeof out === "string" && out.endsWith(".html")
      ? undefined
      : {
          where: "build.out",
          message: "`build.out` は拡張子 `.html` のパスで記載してください。",
        };
  },
  ...(["exclude", "glossary"] as const).map(
    (key): BuildRule =>
      (value) =>
        value[key] === undefined || isStringArray(value[key])
          ? undefined
          : {
              where: `build.${key}`,
              message: `\`build.${key}\` は文字列の並びで記載してください。`,
            },
  ),
  ({ entry }) =>
    entry === undefined || typeof entry === "string"
      ? undefined
      : {
          where: "build.entry",
          message: "`build.entry` は文書のパスの文字列で記載してください。",
        },
];

/** `build` の構造を検め、合うときだけ `build` を返却する。合わないところは `issues` に追加する */
function validateBuild(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): BuildConfig | undefined {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(file, "build", "`build` はキーと値で記載してください。"),
    );
    return undefined;
  }
  const before = issues.length;
  for (const rule of BUILD_RULES) {
    const found = rule(value);
    if (found) {
      issues.push(schemaIssue(file, found.where, found.message));
    }
  }
  return issues.length === before ? (value as BuildConfig) : undefined;
}

/** 設定のキーの値を検めた結果。`value` があればその値で残し、`undefined` なら設定から取り除く */
type KeyChecked = { value: unknown } | undefined;

/** 設定のキー 1 つの値を検める。合わないところは `at.issues` に追加する */
type KeyValidator = (
  value: unknown,
  at: { key: string; file: string; issues: CheckIssue[] },
) => KeyChecked;

/** 値が型に合えば残し、合わなければ `message` を通知して取り除く検め方 */
function typed(
  test: (value: unknown) => boolean,
  message: string,
): KeyValidator {
  return (value, { key, file, issues }) => {
    if (test(value)) {
      return { value };
    }
    issues.push(schemaIssue(file, key, message));
    return undefined;
  };
}

/** 真偽を返却する検め方から、合えば値をそのまま残す検め方を作る */
function kept(
  valid: (value: unknown, file: string, issues: CheckIssue[]) => boolean,
): KeyValidator {
  return (value, { file, issues }) =>
    valid(value, file, issues) ? { value } : undefined;
}

/** 合うときだけ検めた値を返却する検め方から、検めた値に置き換える検め方を作る */
function replaced(
  validate: (value: unknown, file: string, issues: CheckIssue[]) => unknown,
): KeyValidator {
  return (value, { file, issues }) => {
    const checked = validate(value, file, issues);
    return checked === undefined ? undefined : { value: checked };
  };
}

/** `features` を検め、真偽の機能だけを残す */
const validateFeatures: KeyValidator = (value, { file, issues }) => {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "features",
        "`features` は機能名と true / false で記載してください。",
      ),
    );
    return undefined;
  }
  const features: Record<string, boolean> = {};
  for (const [name, enabled] of Object.entries(value)) {
    if (typeof enabled === "boolean") {
      features[name] = enabled;
    } else {
      issues.push(
        schemaIssue(
          file,
          `features.${name}`,
          `\`features.${name}\` は true か false で記載してください。`,
        ),
      );
    }
  }
  return { value: features };
};

/** `libraries` を検め、マーカーの名前と URL の行だけを残す */
const validateLibraries: KeyValidator = (value, { file, issues }) => {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "libraries",
        "`libraries` はマーカーの名前と URL で記載してください。",
      ),
    );
    return undefined;
  }
  const libraries: Record<string, string> = {};
  for (const [name, url] of Object.entries(value)) {
    if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
      issues.push(
        schemaIssue(
          file,
          `libraries.${name}`,
          `\`libraries.${name}\` は、英小文字で始まるマーカーの名前と URL の文字列で記載してください。`,
        ),
      );
    } else {
      libraries[name] = url;
    }
  }
  return { value: libraries };
};

/** `aliases` を検め、Schema に合わない行を `null` にした並びにする */
const validateAliases: KeyValidator = (value, { file, issues }) => {
  if (!Array.isArray(value)) {
    issues.push(
      schemaIssue(
        file,
        "aliases",
        "`aliases` はエイリアスの元の行の並びで記載してください。",
      ),
    );
    return undefined;
  }
  const checked = validateAliasRows(value, file);
  issues.push(...checked.issues);
  return { value: checked.rows };
};

/** 文字列か */
const isString = (value: unknown): boolean => typeof value === "string";

/** 設定のキーと検め方を、検める順に並べた表 */
const CONFIG_KEY_VALIDATORS: Array<[string, KeyValidator]> = [
  ["features", validateFeatures],
  ["libraries", validateLibraries],
  [
    "version",
    typed(
      (value) => typeof value === "string" && VERSION_PATTERN.test(value),
      "`version` は v{MAJOR}.{MINOR}.{PATCH} の構造で記載してください。",
    ),
  ],
  [
    "index",
    typed(isString, "`index` はファイルのパスの文字列で記載してください。"),
  ],
  [
    "theme",
    typed(isString, "`theme` はファイルのパスの文字列で記載してください。"),
  ],
  // 知らない名前はここでは拒まず、設定に残す（`mdmark check` と書き出しの警告が通知する）
  [
    "colorTheme",
    typed(isString, "`colorTheme` はテーマの名前の文字列で記載してください。"),
  ],
  // 知らない値はここでは拒まず、設定に残す（`mdmark check` が通知する）
  [
    "colorScheme",
    typed(
      isString,
      "`colorScheme` は `light`・`dark`・`auto` のどれかの文字列で記載してください。",
    ),
  ],
  [
    "extensions",
    typed(
      isStringArray,
      "`extensions` は拡張のモジュールのパスの並びで記載してください。",
    ),
  ],
  ["build", replaced(validateBuild)],
  ["tooltips", kept(isValidTooltips)],
  ["labels", kept(isValidLabels)],
  ["syntax", kept(isValidSyntax)],
  ["html-scripts", kept(isValidHtmlScripts)],
  ["mermaid", kept(isValidMermaid)],
  ["assets", kept(isValidAssets)],
  ["side-toc", kept(isValidSideToc)],
  ["table", kept(isValidTable)],
  ["map", kept(isValidMap)],
  ["aliases", validateAliases],
  ["check", replaced(validateCheck)],
];

/** 読み込んだ値を `schemas/mdmark.config.schema.json` と同じ構造で検め、合うところだけを残した設定と、合わないところごとの `schema` のずれを返却する */
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
        `${file} が空か、キーと値の構造ではありません。設定のキーを記載してください。`,
      ),
    );
    return { config: {}, issues };
  }
  // 知らないキーは拒まず、そのまま残す
  const config: Record<string, unknown> = { ...raw };
  for (const [key, validate] of CONFIG_KEY_VALIDATORS) {
    if (raw[key] === undefined) {
      continue;
    }
    const checked = validate(raw[key], { key, file, issues });
    if (checked) {
      config[key] = checked.value;
    } else {
      delete config[key];
    }
  }
  return { config: config as CliConfig, issues };
}

/** 設定の `map` を検める。オブジェクトでなければ `schema` のずれを追加して `false` を返却する（値はここでは拒まず設定に残し、`mdmark check` が点検する） */
function isValidMap(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (isRecord(value)) return true;
  issues.push(
    schemaIssue(
      file,
      "map",
      "`map` は `node_fit`・`url_state`・`kinds`・`lines` を持つキーと値で記載してください。",
    ),
  );
  return false;
}

/** 設定の `tooltips` を検める。キーと値の構造でなければ、`placement`・`diagramPlacement` が `top` と `bottom` のどちらでもなければ、`schema` のずれを追加して `false` を返却する */
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
        "`tooltips` は `placement`・`diagramPlacement` を持つキーと値で記載してください。",
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
          `\`tooltips.${key}\` は \`top\` か \`bottom\` で記載してください。`,
        ),
      );
      valid = false;
    }
  }
  return valid;
}

/** 設定の `labels` を検める。キーと値の構造でなければ、`paramCopy` が空でない文字列でなければ、`schema` のずれを追加して `false` を返却する（知らないキーは拒まない） */
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
        "`labels` は部品の文言のキーと値で記載してください。",
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
        "`labels.paramCopy` は空でない文字列で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `side-toc` を検める。キーと値の構造でなければ、`mode` が `hover` と `fixed` のどちらでもなければ、`schema` のずれを追加して `false` を返却する */
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
        "`side-toc` は `mode` を持つキーと値で記載してください。",
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
        "`side-toc.mode` は `hover` か `fixed` で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `table` を検める。キーと値の構造でなければ、`pin` が `each` と `through` のどちらでもなければ、`long_column_min` が 0 より大きい有限の数でなければ、`schema` のずれを追加して `false` を返却する */
function isValidTable(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "table",
        "`table` は `pin` を持つキーと値で記載してください。",
      ),
    );
    return false;
  }
  if (
    value.pin !== undefined &&
    value.pin !== "each" &&
    value.pin !== "through"
  ) {
    issues.push(
      schemaIssue(
        file,
        "table.pin",
        "`table.pin` は `each` か `through` で記載してください。",
      ),
    );
    return false;
  }
  const min = value.long_column_min;
  if (
    min !== undefined &&
    (typeof min !== "number" || !Number.isFinite(min) || min <= 0)
  ) {
    issues.push(
      schemaIssue(
        file,
        "table.long_column_min",
        "`table.long_column_min` は 0 より大きい数で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `assets` を検める。キーと値の構造でなければ、`root` が文字列でなければ、`schema` のずれを追加して `false` を返却する */
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
        "`assets` は `root` を持つキーと値で記載してください。",
      ),
    );
    return false;
  }
  if (value.root !== undefined && typeof value.root !== "string") {
    issues.push(
      schemaIssue(
        file,
        "assets.root",
        "`assets.root` は設定ファイルのフォルダからのフォルダのパスの文字列で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `syntax` を検める。キーと値の構造でなければ、`url` が文字列でなければ、`schema` のずれを追加して `false` を返却する */
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
        "`syntax` は `url` を持つキーと値で記載してください。",
      ),
    );
    return false;
  }
  if (value.url !== undefined && typeof value.url !== "string") {
    issues.push(
      schemaIssue(
        file,
        "syntax.url",
        "`syntax.url` は色分けのライブラリの `es/` フォルダの URL かパスの文字列で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `html-scripts` を検める。キーと値の構造でなければ、`url` が文字列でなければ、`schema` のずれを追加して `false` を返却する */
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
        "`html-scripts` は `url` を持つキーと値で記載してください。",
      ),
    );
    return false;
  }
  if (value.url !== undefined && typeof value.url !== "string") {
    issues.push(
      schemaIssue(
        file,
        "html-scripts.url",
        "`html-scripts.url` は変換のライブラリの ES モジュールの URL かパスの文字列で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `mermaid` を検める。キーと値の構造でなければ、`url`・`theme` が文字列でなければ、`themeVariables` がキーと値の構造でなければ、`schema` のずれを追加して `false` を返却する。`theme` の知らない名前は拒まない */
function isValidMermaid(
  value: unknown,
  file: string,
  issues: CheckIssue[],
): boolean {
  if (!isRecord(value)) {
    issues.push(
      schemaIssue(
        file,
        "mermaid",
        "`mermaid` は `url`・`theme`・`themeVariables` を持つキーと値で記載してください。",
      ),
    );
    return false;
  }
  if (value.url !== undefined && typeof value.url !== "string") {
    issues.push(
      schemaIssue(
        file,
        "mermaid.url",
        "`mermaid.url` は mermaid の ES モジュールの URL かパスの文字列で記載してください。",
      ),
    );
    return false;
  }
  if (value.theme !== undefined && typeof value.theme !== "string") {
    issues.push(
      schemaIssue(
        file,
        "mermaid.theme",
        "`mermaid.theme` は `mdmark` か mermaid のテーマの名前の文字列で記載してください。",
      ),
    );
    return false;
  }
  if (value.themeVariables !== undefined && !isRecord(value.themeVariables)) {
    issues.push(
      schemaIssue(
        file,
        "mermaid.themeVariables",
        "`mermaid.themeVariables` は、mermaid のテーマの変数の名前と値のキーと値で記載してください。",
      ),
    );
    return false;
  }
  return true;
}

/** 設定の `check` を検める。オブジェクトでなければ `schema` のずれにして `undefined` を返却し、`ignore` はマーカーの名前の書式に合う値だけを残し、真偽値でない `suggestMarkExtension` を落とす */
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
        "`check` は `ignore` を持つキーと値で記載してください。",
      ),
    );
    return undefined;
  }
  if (
    value.suggestMarkExtension !== undefined &&
    typeof value.suggestMarkExtension !== "boolean"
  ) {
    issues.push(
      schemaIssue(
        file,
        "check.suggestMarkExtension",
        "`check.suggestMarkExtension` は `true` か `false` で記載してください。",
      ),
    );
    const rest = { ...value };
    delete rest.suggestMarkExtension;
    return validateCheck(rest, file, issues);
  }
  if (value.ignore === undefined) {
    return value as CheckConfig;
  }
  if (!Array.isArray(value.ignore)) {
    issues.push(
      schemaIssue(
        file,
        "check.ignore",
        "`check.ignore` はマーカーの名前の並びで記載してください。",
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
          `\`check.ignore[${position}]\` は、英小文字で始まり、英小文字・数字・\`-\` が続くマーカーの名前で記載してください。`,
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
  /** 重ねた設定。相対パスの値はその値を記載した設定ファイルのフォルダから解決した絶対パス */
  config: CliConfig;
  /** 重ねた設定ファイルを重ねた順（端末の設定 → 上 → 近い）に並べたもの */
  files: ConfigFile[];
  /** 最も近い `mdmark.config.yaml` の絶対パス（`explicit` のときはそのパス） */
  nearest: string | undefined;
  /** YAML として読み込めなかった最初の設定ファイル */
  unreadable: { path: string; line: number; message: string } | undefined;
  /** 重ねた設定ファイルごとの `schema` のずれ（`file` は絶対パス） */
  issues: CheckIssue[];
};

/** `explicit` のファイルが無い */
export class ConfigNotFoundError extends Error {
  override name = "ConfigNotFoundError";
}

/** `MDMARK_CONFIG`、無ければ `${XDG_CONFIG_HOME:-{home}/.config}/mdmark/settings.yaml` を返却する */
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

/** `cwd` から上へ `mdmark.config.yaml` を探し、上 → 近いの順に返却する */
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

/** 設定の値が `url`（`root`）の文字列を持つときだけ、そのパスを `map` で写す */
function mapNestedPath<T>(
  value: T,
  key: "url" | "root",
  map: (value: string) => string,
): T | undefined {
  if (!isRecord(value) || typeof value[key] !== "string") {
    return undefined;
  }
  return { ...value, [key]: map(value[key]) } as T;
}

/** `build` のパスを `map` で写す */
function mapBuildPaths(
  config: BuildConfig,
  map: (value: string) => string,
): BuildConfig {
  const build = { ...config };
  build.include = build.include.map(map);
  build.out = map(build.out);
  if (build.exclude) {
    build.exclude = build.exclude.map(map);
  }
  if (build.glossary) {
    build.glossary = build.glossary.map(map);
  }
  if (build.entry !== undefined) {
    build.entry = map(build.entry);
  }
  return build;
}

/** エイリアスの元の行の `paths` を `map` で写す */
function mapAliasPaths(
  rows: unknown[],
  map: (value: string) => string,
): unknown[] {
  return rows.map((row) =>
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

/** `url`・`root` の文字列を持つ設定のキーと、そのパスのキー */
const NESTED_PATH_KEYS = [
  ["html-scripts", "url"],
  ["mermaid", "url"],
  ["syntax", "url"],
  ["assets", "root"],
] as const;

/** 設定のパスの値（`theme`・`index`・`assets.root`・`build`・`extensions`・`libraries`・`html-scripts.url`・`mermaid.url`・`syntax.url`・`aliases` の `paths`）を `map` で替えた設定を返却する（指定した設定は書き換えない） */
const mapConfigPaths = (
  config: CliConfig,
  map: (value: string) => string,
): CliConfig => {
  const result: CliConfig = { ...config };
  if (typeof config.theme === "string") {
    result.theme = map(config.theme);
  }
  if (typeof config.index === "string") {
    result.index = map(config.index);
  }
  if (config.extensions) {
    result.extensions = config.extensions.map(map);
  }
  if (isRecord(config.libraries)) {
    result.libraries = Object.fromEntries(
      Object.entries(config.libraries).map(([name, url]) => [
        name,
        typeof url === "string" ? map(url) : url,
      ]),
    ) as CliConfig["libraries"];
  }
  const nested = result as Record<string, unknown>;
  for (const [key, pathKey] of NESTED_PATH_KEYS) {
    const mapped = mapNestedPath(config[key], pathKey, map);
    if (mapped !== undefined) {
      nested[key] = mapped;
    }
  }
  if (config.build) {
    result.build = mapBuildPaths(config.build, map);
  }
  if (config.aliases) {
    result.aliases = mapAliasPaths(config.aliases, map);
  }
  return result;
};

/** 1 つの層の設定の相対パスの値を、その層のファイルのフォルダから絶対パスにする（指定した設定は書き換えない） */
export const absolutizeConfigPaths = (options: {
  config: CliConfig;
  dir: string;
}): CliConfig =>
  mapConfigPaths(options.config, (value) => absolutize(value, options.dir));

/** 重ねた設定のパスの値のうち `dir` の下のものを `dir` からの相対パスに戻す（CLI が最も近い設定ファイルのフォルダを基準に読み込むため） */
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

/** 基準のフォルダの中なら相対パス、外ならホームを `~` にしたパスを返却する（区切りは `/`） */
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

/** 端末の設定の `serve.tmuxSession` に使用できる文字 */
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
        "`serve` は `tmuxSession` を持つキーと値で記載してください。",
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
        "`serve.tmuxSession` は英数字・`_`・`-` の文字列で記載してください。",
      ),
    ];
  }
  return [];
};

/** 端末の設定の `config` がマップで、`config.cascade`・`config.applyToExport` が真偽値か、`serve.tmuxSession` が使用できる名前かを検める */
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
        "`config` は `cascade`・`applyToExport` を持つキーと値で記載してください。",
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
          `\`config.${key}\` は true か false で記載してください。`,
        ),
      );
    }
  }
  return issues;
};

/** 読み込んだ 1 つの層 */
type ReadLayer =
  | { kind: "missing" }
  | { kind: "unreadable"; line: number; message: string }
  | { kind: "read"; raw: unknown };

/** 設定ファイルを読み込み、YAML として読み込む。`ENOENT` は `missing` */
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

/** 端末の設定と上のフォルダの設定ファイルを読み込み、構造を検めて、相対パスを絶対パスにしてから重ねる */
/** 重ねる文書のフォルダの設定ファイルのパス（上のフォルダから順）。指定したファイルがあればそれだけ、無ければ見つからないエラーを投げる */
const folderConfigPaths = async (options: {
  cwd: string;
  explicit?: string | undefined;
  explicitName: string;
  cascade: boolean;
  isFile: (path: string) => Promise<boolean>;
}): Promise<string[]> => {
  if (options.explicit === undefined) {
    return findConfigChain({
      cwd: options.cwd,
      cascade: options.cascade,
      isFile: options.isFile,
    });
  }
  const path = resolve(options.cwd, options.explicit);
  if (!(await options.isFile(path))) {
    throw new ConfigNotFoundError(
      `${options.explicit} が見つかりません（${options.explicitName}）。パスを修正するか、mdmark init で配置してください。`,
    );
  }
  return [path];
};

export const loadLayeredConfig = async (options: {
  cwd: string;
  explicit?: string | undefined;
  purpose: "preview" | "export";
  env: Record<string, string | undefined>;
  home: string;
  readFile: (path: string) => Promise<string>;
  isFile: (path: string) => Promise<boolean>;
  explicitName: string;
  /** 構造の合わない設定ファイルも、合うところだけを重ねるか（`mdmark check` が残りを点検するため） */
  keepInvalid?: boolean;
}): Promise<LayeredConfig> => {
  const issues: CheckIssue[] = [];
  let unreadable: LayeredConfig["unreadable"];
  const layers: Array<{ file: ConfigFile; config: CliConfig }> = [];

  // 1 つの層を読み込んで検める。読み込めて構造が合えば検めた設定を返却する
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

  const paths = await folderConfigPaths({ ...options, cascade });
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
