import { parse } from "yaml";

/** 設定ファイルを既定と違う場所に置くときにパスを記載する環境変数の名前。`$.env.get` には文字列リテラルで記載する */
export const CONFIG_ENV = "MDMARK_STYLE_CONFIG";

/** 既定の設定ファイルのパス */
export const DEFAULT_CONFIG_PATH =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: シェルの既定値の書き方で、設定の設計書と同じ表記にする
  "${XDG_CONFIG_HOME:-~/.config}/mdmark-style/settings.yaml";

/** 部品ごとのオン・オフのキー */
export type PartName =
  | "table"
  | "heading"
  | "callout"
  | "code"
  | "fold"
  | "terms"
  | "hover_card"
  | "footnote";

/** 描き換える場所 */
export type Target = "assistant" | "user";

/** 重ねた後の設定 */
export type StyleSettings = {
  enabled: boolean;
  targets: Target[];
  parts: Record<PartName, boolean>;
  glossary: string | undefined;
  inject_marker_guide: boolean;
};

/** 設定の既定値 */
export const DEFAULT_SETTINGS: StyleSettings = {
  enabled: true,
  targets: ["assistant", "user"],
  parts: {
    table: true,
    heading: true,
    callout: true,
    code: true,
    fold: true,
    terms: true,
    hover_card: true,
    footnote: true,
  },
  glossary: undefined,
  inject_marker_guide: true,
};

/** 設定ファイルを読めないとき・キーの型が合わないときの例外 */
export class SettingsError extends Error {
  override name = "SettingsError";
}

/** 設定を読み込むのに使う `$` の機能 */
export type SettingsEngine = {
  env: { get: (name: string) => Promise<string | undefined> };
  fs: {
    exists: (path: string) => Promise<boolean>;
    read: (path: string) => Promise<string>;
  };
  session: { root: () => Promise<string> };
};

const PART_NAMES = Object.keys(DEFAULT_SETTINGS.parts) as PartName[];

const TARGETS: readonly string[] = ["assistant", "user"];

const WORKTREES = "/.claude/worktrees/";

/** 先頭の `~` をホームに展開する */
const expandHome = (path: string, home: string): string =>
  path === "~" || path.startsWith("~/") ? `${home}${path.slice(1)}` : path;

/** フォルダとパスをつなぎ、`.`・`..` をたどる */
export const joinPath = (dir: string, path: string): string => {
  const parts: string[] = [];
  for (const part of `${dir}/${path}`.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return `/${parts.join("/")}`;
};

/** ファイルのパスのフォルダ */
export const dirOf = (path: string): string =>
  path.slice(0, path.lastIndexOf("/")) || "/";

/** `MDMARK_STYLE_CONFIG` があればそのパス、無ければ `DEFAULT_CONFIG_PATH` を、先頭の `~` をホームに展開して返却する */
export async function settingsPath($: SettingsEngine): Promise<string> {
  const home = (await $.env.get("HOME")) ?? "";
  const given = await $.env.get("MDMARK_STYLE_CONFIG");
  if (given !== undefined && given !== "") {
    return expandHome(given, home);
  }
  const base = (await $.env.get("XDG_CONFIG_HOME")) || `${home}/.config`;
  return `${expandHome(base, home)}/mdmark-style/settings.yaml`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 型の合わないキーの例外 */
const keyError = (where: string, expected: string): SettingsError =>
  new SettingsError(
    `mdmark-style の設定ファイルのキーが読めない: ${where}（${expected}）`,
  );

/** 真偽値のキーを重ねる */
const overlayFlags = (options: {
  next: StyleSettings;
  layer: Record<string, unknown>;
  where: string;
}): void => {
  const { next, layer, where } = options;
  for (const key of ["enabled", "inject_marker_guide"] as const) {
    const value = layer[key];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== "boolean") {
      throw keyError(`${where}.${key}`, "真偽値");
    }
    next[key] = value;
  }
};

/** `targets` を重ねる。`global` は置き換え、`projects` は後ろに追加して重なりを除く */
const overlayTargets = (options: {
  next: StyleSettings;
  value: unknown;
  where: string;
}): void => {
  const { next, value, where } = options;
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw keyError(`${where}.targets`, "assistant・user の並び");
  }
  // assistant・user 以外の値は無視する
  const given = value.filter((target): target is Target =>
    TARGETS.includes(String(target)),
  );
  next.targets =
    where === "global" ? [...given] : [...new Set([...next.targets, ...given])];
};

/** `parts` をキーごとに重ねる */
const overlayParts = (options: {
  next: StyleSettings;
  value: unknown;
  where: string;
}): void => {
  const { next, value, where } = options;
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    throw keyError(`${where}.parts`, "辞書");
  }
  for (const [name, flag] of Object.entries(value)) {
    if (!PART_NAMES.includes(name as PartName) || typeof flag !== "boolean") {
      throw keyError(`${where}.parts.${name}`, "部品の名前と真偽値");
    }
    next.parts[name as PartName] = flag;
  }
};

/** 1 つの層（`global` か `projects[]` の要素）を設定に重ねる */
const overlay = (options: {
  base: StyleSettings;
  layer: unknown;
  where: string;
  resolveGlossary: (path: string) => string;
}): StyleSettings => {
  const { base, layer, where, resolveGlossary } = options;
  if (layer === undefined || layer === null) {
    return base;
  }
  if (!isRecord(layer)) {
    throw keyError(where, "辞書");
  }
  const next: StyleSettings = {
    ...base,
    parts: { ...base.parts },
    targets: [...base.targets],
  };
  overlayFlags({ next, layer, where });
  overlayTargets({ next, value: layer.targets, where });
  overlayParts({ next, value: layer.parts, where });
  if (layer.glossary !== undefined) {
    if (typeof layer.glossary !== "string" || layer.glossary === "") {
      throw keyError(`${where}.glossary`, "パスの文字列");
    }
    next.glossary = resolveGlossary(layer.glossary);
  }
  return next;
};

/** `match` が起動したプロジェクトに該当するか。`.claude/worktrees/` の下は本体で照合する */
const matches = (match: unknown, projectRoot: string): boolean => {
  if (typeof match !== "string" || match === "") {
    return false;
  }
  const at = projectRoot.indexOf(WORKTREES);
  const root = at >= 0 ? projectRoot.slice(0, at) : projectRoot;
  if (match.startsWith("/")) {
    const target = match.replace(/\/$/, "");
    return root === target || root.startsWith(`${target}/`);
  }
  return root.slice(root.lastIndexOf("/") + 1) === match;
};

/** 読み込んだ YAML の `global` に、`match` が起動したプロジェクトに該当した `projects` の要素を並びの順に重ね、既定値で埋める */
export const mergeSettings = (options: {
  raw: unknown;
  projectRoot: string;
  configDir: string;
  home: string;
}): StyleSettings => {
  const { raw, projectRoot, configDir, home } = options;
  if (raw === undefined || raw === null) {
    return DEFAULT_SETTINGS;
  }
  if (!isRecord(raw)) {
    throw keyError("(最上位)", "global と projects の辞書");
  }
  const resolveFrom = (dir: string) => (path: string) => {
    const expanded = expandHome(path, home);
    return expanded.startsWith("/") ? expanded : joinPath(dir, expanded);
  };
  let settings = overlay({
    base: DEFAULT_SETTINGS,
    layer: raw.global,
    where: "global",
    resolveGlossary: resolveFrom(configDir),
  });
  if (raw.projects !== undefined && !Array.isArray(raw.projects)) {
    throw keyError("projects", "並び");
  }
  const projects: unknown[] = Array.isArray(raw.projects) ? raw.projects : [];
  for (const [position, project] of projects.entries()) {
    if (!isRecord(project) || !matches(project.match, projectRoot)) {
      continue;
    }
    const { match: _match, ...layer } = project;
    settings = overlay({
      base: settings,
      layer,
      where: `projects[${position}]`,
      resolveGlossary: resolveFrom(projectRoot),
    });
  }
  return settings;
};

/** 設定ファイルを呼ばれるたびに `$.fs.read` で読み込み、重ねた設定を返却する */
export async function readSettings($: SettingsEngine): Promise<StyleSettings> {
  const path = await settingsPath($);
  if (!(await $.fs.exists(path))) {
    return DEFAULT_SETTINGS;
  }
  const text = await $.fs.read(path);
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message.split("\n")[0] : "";
    throw new SettingsError(
      `mdmark-style の設定ファイルを YAML として読めない: ${path}（${reason}）`,
    );
  }
  return mergeSettings({
    raw,
    projectRoot: await $.session.root(),
    configDir: dirOf(path),
    home: (await $.env.get("HOME")) ?? "",
  });
}
