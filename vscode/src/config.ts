import { stat } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { loadAliases } from "../../src/cli/aliases.ts";
import type { CheckIssue } from "../../src/cli/check.ts";
import {
  loadLayeredConfig,
  relativizeConfigPaths,
  resolveSettingsPath,
} from "../../src/config-files.ts";
import type { MdmarkAlias } from "../../src/knowledge/aliases.ts";
import type { PreviewSettings } from "./settings.ts";

/** `mount` に指定する設定。設定ファイルから取り出した `features`・`libraries`・`html-scripts`・`side-toc`・`table`・`labels`・`mermaid`・`map`・`tooltips`・`syntax`・`colorTheme`・`colorScheme` */
export type PreviewConfig = {
  /** 記載した値のまま（中の知らない名前と型の違う値は mdmark が無視する） */
  features?: Record<string, unknown>;
  /** 記載した値のまま。URL は呼ぶ側が修正する */
  libraries?: Record<string, unknown>;
  /** 記載した値のまま。`url` は呼ぶ側が修正する */
  "html-scripts"?: Record<string, unknown>;
  /** 記載した値のまま（`mode` の知らない値は mdmark が `hover` で描く） */
  "side-toc"?: Record<string, unknown>;
  /** 記載した値のまま（`pin` の知らない値は mdmark が `each` で描く） */
  table?: Record<string, unknown>;
  /** 記載した値のまま（中の知らないキーと、空文字・文字列でない値は mdmark が無視して既定の文言で描く） */
  labels?: Record<string, unknown>;
  /** 記載した値のまま。`url` は呼ぶ側が修正する（`theme` の知らない名前は mdmark が `mdmark` で描く） */
  mermaid?: Record<string, unknown>;
  /** 記載した値のまま（知らない値は mdmark が既定で描く） */
  map?: Record<string, unknown>;
  /** 記載した値のまま（`placement`・`diagramPlacement` の知らない値は mdmark が既定の場所に出す） */
  tooltips?: Record<string, unknown>;
  /** 記載した値のまま。`url` は呼ぶ側が修正する（文字列でない `url` は mdmark が無視して既定の URL から読み込む） */
  syntax?: Record<string, unknown>;
  /** 記載した値のまま。`mdmark.colorTheme` が空でないときは `applyColorTheme` がその値に置き換える（知らない名前は mdmark が dev-swiss で描く） */
  colorTheme?: string;
  /** 記載した値のまま。プレビューでは `mdmark.preview.theme` が `light`・`dark` のとき `applyPreviewTheme` が除く（知らない値は mdmark が `auto` で描く） */
  colorScheme?: string;
};

/** 帯に出す、読み込めない・構造の合わない設定ファイル 1 つ */
export type ConfigProblem = {
  /** 設定ファイルの絶対パス */
  path: string;
  /** YAML として読み込めない行（1 始まり）。構造に合わないときは無い */
  line?: number | undefined;
  /** 設定の構造に合わない最初のキー。YAML として読み込めないときは無い */
  settingKey?: string | undefined;
  /** 誤りの文（ログに出す） */
  message: string;
};

/** `loadConfig` の戻り値 */
export type ConfigLoad = {
  /** 重ねた設定のうち `mount` に指定するキー */
  config: PreviewConfig;
  /** 重ねた設定の `theme` の絶対パス */
  theme?: string | undefined;
  /** 重ねた設定の `extensions` の絶対パス */
  extensions: string[];
  /** 重ねた設定ファイルの絶対パス（端末の設定 → 上 → 近い） */
  files: string[];
  /** 最も近い `mdmark.config.yaml`（`mdmark.configPath` を記載したときはそのファイル）の絶対パス */
  nearest?: string | undefined;
  /** 重ねた設定の `assets.root` の絶対パス。`mount` には指定しない */
  assetsRoot?: string | undefined;
  /** 読み込めない・構造の合わない最初の設定ファイル */
  problem?: ConfigProblem | undefined;
  /** 重ねた設定の `aliases` から作ったエイリアス。`aliases` が無いときは持たない */
  aliases?: MdmarkAlias[] | undefined;
  /** エイリアスを作ったときのずれ */
  aliasIssues: CheckIssue[];
  /** `aliases` の行の `paths` に該当した YAML の絶対パス */
  aliasFiles: string[];
};

/** ファイルがあるか */
export async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** テキストのファイルを読み込む関数。ファイルが無ければ `code` が `ENOENT` の例外を投げる */
export type ReadTextFile = (path: string) => Promise<string>;

/** `mdmark.openConfig` が「作成」で記載する YAML。キーを記載せず、記載方法をコメントで示す */
export const CONFIG_TEMPLATE = `# mdmark の設定。端末の設定（~/.config/mdmark/settings.yaml）に重ねて読み込みます。端末の設定の config.cascade を true にすると、上のフォルダの mdmark.config.yaml も重ねます

# 機能のオン・オフ（使用するときは次の 2 行の # を削除する）
# features:
#   callout: false

# 外部ライブラリのモジュール。相対パスはこのファイルのあるフォルダから（使用するときは次の 2 行の # を削除する）
# libraries:
#   my-chart: ./libs/my-chart.js

# 右側の目次の出し方。hover か fixed（使用するときは次の 2 行の # を削除する）
# side-toc:
#   mode: fixed

# 配色のテーマ。dev-swiss・theme-paper・theme-slate・theme-contrast のどれか。VS Code の設定 mdmark.colorTheme が空でないときはそちらが優先（使用するときは次の 1 行の # を削除する）
# colorTheme: theme-paper

# 利用側の CSS。相対パスはこのファイルのあるフォルダから（使用するときは次の 1 行の # を削除する）
# theme: ./theme.css

# 拡張のモジュール。相対パスはこのファイルのあるフォルダから（使用するときは次の 2 行の # を削除する）
# extensions:
#   - ./extensions/example.js
`;

/** ライブラリ本体が `html-scripts.url`・`mermaid.url`・`syntax.url` を省いたときに読み込む URL の origin */
const DEFAULT_HTML_SCRIPTS_ORIGIN = "https://cdn.jsdelivr.net";

/** `http:`・`https:` の URL か */
const HTTP_URL_PATTERN = /^https?:/i;

/** 値がマップ（配列でも `null` でもないオブジェクト）か */
function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `mdmark.configPath` が相対パスなら基準のフォルダから解決し、絶対パスならそのまま返却する */
export function resolveConfigPath(options: {
  /** `mdmark.configPath` */
  configPath: string;
  /** Markdown を含むワークスペースのフォルダ（ワークスペースの外の Markdown は Markdown のフォルダ）の絶対パス */
  baseDir: string;
}): string {
  const { configPath, baseDir } = options;
  return isAbsolute(configPath) ? configPath : resolve(baseDir, configPath);
}

/** 重ねた設定から `mount` に指定するキー（マップの `features`・`libraries`・`html-scripts`・`side-toc`・`table`・`labels`・`mermaid`・`map`・`tooltips`・`syntax` と文字列の `colorTheme`・`colorScheme`）だけを取り出す */
function pickPreviewConfig(config: Record<string, unknown>): PreviewConfig {
  const picked: PreviewConfig = {};
  if (isMap(config.features)) {
    picked.features = config.features;
  }
  if (isMap(config.libraries)) {
    picked.libraries = config.libraries;
  }
  if (isMap(config["html-scripts"])) {
    picked["html-scripts"] = config["html-scripts"];
  }
  if (isMap(config["side-toc"])) {
    picked["side-toc"] = config["side-toc"];
  }
  if (isMap(config.table)) {
    picked.table = config.table;
  }
  if (isMap(config.labels)) {
    picked.labels = config.labels;
  }
  if (isMap(config.mermaid)) {
    picked.mermaid = config.mermaid;
  }
  if (isMap(config.map)) {
    picked.map = config.map;
  }
  if (isMap(config.tooltips)) {
    picked.tooltips = config.tooltips;
  }
  if (isMap(config.syntax)) {
    picked.syntax = config.syntax;
  }
  if (typeof config.colorTheme === "string") {
    picked.colorTheme = config.colorTheme;
  }
  if (typeof config.colorScheme === "string") {
    picked.colorScheme = config.colorScheme;
  }
  return picked;
}

/** ライブラリ本体の `loadLayeredConfig` で設定を重ねて読み込み、`ConfigLoad` にする。設定ファイルが 1 つも無ければ端末の設定だけで返却する */
export async function loadConfig(options: {
  /** Markdown のフォルダ */
  cwd: string;
  /** `mdmark.configPath` */
  configPath: string;
  /** 設定ファイルの場所を決める基準のフォルダ */
  baseDir: string;
  /** プレビューか書き出しか */
  purpose: "preview" | "export";
  /** 環境変数 */
  env: Record<string, string | undefined>;
  /** ホームのフォルダ */
  home: string;
  /** 読み込む関数 */
  readFile: ReadTextFile;
  /** ファイルがあるかを確認する関数 */
  isFile: (path: string) => Promise<boolean>;
}): Promise<ConfigLoad> {
  let explicit: string | undefined;
  let isFile = options.isFile;
  if (options.configPath !== "") {
    const path = resolveConfigPath(options);
    if (await options.isFile(path)) {
      explicit = path;
    } else {
      // 記載したファイルが無いときは上へ探さず、端末の設定だけを重ねる
      isFile = async () => false;
    }
  }
  const layered = await loadLayeredConfig({
    cwd: options.cwd,
    explicit,
    purpose: options.purpose,
    env: options.env,
    home: options.home,
    readFile: options.readFile,
    isFile,
    explicitName: "mdmark.configPath",
  });
  const config = layered.config as Record<string, unknown>;
  const first = layered.issues[0];
  const problem: ConfigProblem | undefined = layered.unreadable
    ? { ...layered.unreadable }
    : first
      ? { path: first.file, settingKey: first.where, message: first.message }
      : undefined;
  const assets = config.assets;
  const aliasResult =
    config.aliases !== undefined
      ? await loadConfigAliases({
          layered,
          settingsPath: resolveSettingsPath(options),
        })
      : { aliases: undefined, issues: [], files: [] };
  return {
    config: pickPreviewConfig(config),
    theme: typeof config.theme === "string" ? config.theme : undefined,
    extensions: Array.isArray(config.extensions)
      ? config.extensions.filter(
          (path): path is string => typeof path === "string",
        )
      : [],
    files: layered.files.map((file) => file.path),
    nearest: layered.nearest,
    assetsRoot:
      isMap(assets) && typeof assets.root === "string"
        ? assets.root
        : undefined,
    problem,
    aliases: aliasResult.aliases,
    aliasIssues: aliasResult.issues,
    aliasFiles: aliasResult.files,
  };
}

/** 重ねた設定の `aliases` からエイリアスを作る。基準の設定ファイルは最も近い `mdmark.config.yaml`、無ければ端末の設定ファイル */
async function loadConfigAliases(options: {
  layered: Awaited<ReturnType<typeof loadLayeredConfig>>;
  settingsPath: string;
}): ReturnType<typeof loadAliases> {
  const { layered, settingsPath } = options;
  const path = layered.nearest ?? settingsPath;
  const dir = dirname(path);
  return loadAliases({
    path,
    dir,
    config: relativizeConfigPaths({ config: layered.config, dir }),
  });
}

/** `http:`・`https:` の URL はそのまま、それ以外の文字列は設定ファイルのフォルダから解決した絶対パスを `toUrl` で URL にして返却する。文字列でない値はそのまま指定する */
export function resolveLibraries(options: {
  /** 取り出した `libraries` */
  libraries: Record<string, unknown>;
  /** 設定ファイルのあるフォルダ */
  configDir: string;
  /** 絶対パスを読み込める URL にする関数 */
  toUrl: (path: string) => string;
}): Record<string, unknown> {
  const { libraries, configDir, toUrl } = options;
  return Object.fromEntries(
    Object.entries(libraries).map(([name, value]) => {
      if (typeof value !== "string" || HTTP_URL_PATTERN.test(value)) {
        return [name, value];
      }
      return [name, toUrl(resolve(configDir, value))];
    }),
  );
}

/** `html-scripts.url` が `http:`・`https:` でない文字列なら、設定ファイルのフォルダから解決した絶対パスを `toUrl` で URL にして返却する */
export function resolveHtmlScripts(options: {
  /** 取り出した `html-scripts` */
  htmlScripts: Record<string, unknown>;
  /** 設定ファイルのあるフォルダ */
  configDir: string;
  /** 絶対パスを読み込める URL にする関数 */
  toUrl: (path: string) => string;
}): Record<string, unknown> {
  const { htmlScripts, configDir, toUrl } = options;
  const { url } = htmlScripts;
  if (typeof url !== "string" || HTTP_URL_PATTERN.test(url)) {
    return htmlScripts;
  }
  return { ...htmlScripts, url: toUrl(resolve(configDir, url)) };
}

/** `mermaid.url` が `http:`・`https:` でない文字列なら、設定ファイルのフォルダから解決した絶対パスを `toUrl` で URL にして返却する（`resolveHtmlScripts` と同じ修正方法） */
export function resolveMermaid(options: {
  /** 取り出した `mermaid` */
  mermaid: Record<string, unknown>;
  /** 設定ファイルのあるフォルダ */
  configDir: string;
  /** 絶対パスを読み込める URL にする関数 */
  toUrl: (path: string) => string;
}): Record<string, unknown> {
  const { mermaid, configDir, toUrl } = options;
  return resolveHtmlScripts({ htmlScripts: mermaid, configDir, toUrl });
}

/** `syntax.url` が `http:`・`https:` でない文字列なら、設定ファイルのフォルダから解決した絶対パスを `toUrl` で URL にし、末尾に `/` を付けて返却する（`resolve` と `asWebviewUri` が末尾の `/` を削除するため） */
export function resolveSyntax(options: {
  /** 取り出した `syntax` */
  syntax: Record<string, unknown>;
  /** 設定ファイルのあるフォルダ */
  configDir: string;
  /** 絶対パスを読み込める URL にする関数 */
  toUrl: (path: string) => string;
}): Record<string, unknown> {
  const { syntax, configDir, toUrl } = options;
  const { url } = syntax;
  if (typeof url !== "string" || HTTP_URL_PATTERN.test(url)) {
    return syntax;
  }
  const resolved = toUrl(resolve(configDir, url));
  return { ...syntax, url: resolved.endsWith("/") ? resolved : `${resolved}/` };
}

/** `libraries` の値と `html-scripts.url`・`mermaid.url`・`syntax.url`（文字列でなければライブラリ本体の既定の URL）のうち `http:`・`https:` の URL の origin を、重なりを除いて返却する */
export function libraryOrigins(
  libraries: Record<string, unknown> | undefined,
  htmlScripts?: Record<string, unknown>,
  mermaid?: Record<string, unknown>,
  syntax?: Record<string, unknown>,
): string[] {
  const origins = new Set<string>();
  const urlOrDefault = (setting?: Record<string, unknown>): string =>
    typeof setting?.url === "string"
      ? setting.url
      : DEFAULT_HTML_SCRIPTS_ORIGIN;
  for (const value of [
    ...Object.values(libraries ?? {}),
    urlOrDefault(htmlScripts),
    urlOrDefault(mermaid),
    urlOrDefault(syntax),
  ]) {
    if (typeof value === "string" && HTTP_URL_PATTERN.test(value)) {
      // 読み込めない URL は CSP に追加しない（読み込みは mdmark が通知ブロックにする）
      const origin = URL.canParse(value) ? new URL(value).origin : undefined;
      if (origin !== undefined && origin !== "null") {
        origins.add(origin);
      }
    }
  }
  return [...origins];
}

/** `mdmark.colorTheme` が空でなければ、設定ファイルから取り出した設定の `colorTheme` をその値に置き換えた設定を返却する。空のときは `config` をそのまま返却し、指定された `config` は書き換えない */
export function applyColorTheme(options: {
  /** 設定ファイルから取り出した設定 */
  config: PreviewConfig;
  /** `readSettings` の `colorTheme` */
  colorTheme: PreviewSettings["colorTheme"];
}): PreviewConfig {
  const { config, colorTheme } = options;
  return colorTheme === "" ? config : { ...config, colorTheme };
}

/** `mdmark.preview.theme` が `light`・`dark` なら、設定から `colorScheme` を除いた設定を返却する。`auto` のときは `config` をそのまま返却し、指定された `config` は書き換えない（プレビューだけが経由し、書き出しは経由しない） */
export function applyPreviewTheme(options: {
  /** `applyColorTheme` の後の設定 */
  config: PreviewConfig;
  /** `readSettings` の `theme` */
  theme: PreviewSettings["theme"];
}): PreviewConfig {
  const { config, theme } = options;
  if (theme === "auto") {
    return config;
  }
  const { colorScheme: _colorScheme, ...rest } = config;
  return rest;
}
