import { dirname, isAbsolute, resolve } from "node:path";
import { parse, YAMLParseError } from "yaml";
import type { PreviewSettings } from "./settings.ts";

/** `mount` に渡す設定。設定ファイルから取り出した `features`・`libraries`・`side-toc`・`colorTheme` */
export type PreviewConfig = {
  /** 記載した値のまま（中の知らない名前と型の違う値は mdmark が無視する） */
  features?: Record<string, unknown>;
  /** 記載した値のまま。URL は呼ぶ側が直す */
  libraries?: Record<string, unknown>;
  /** 記載した値のまま（`mode` の知らない値は mdmark が `hover` で描く） */
  "side-toc"?: Record<string, unknown>;
  /** 書いた値のまま。`mdmark.colorTheme` が空でないときは `applyColorTheme` がその値に置き換える（知らない名前は mdmark が dev-swiss で描く） */
  colorTheme?: string;
};

/** 設定ファイルの読み取りの結果 */
export type ConfigLoad =
  | {
      kind: "ok";
      config: PreviewConfig;
      /** 設定ファイルの `assets.root`。`parseConfig` は書いた値、`loadConfig` は設定ファイルのフォルダを基準にした絶対パス。`mount` には渡さない */
      assetsRoot?: string;
    }
  | { kind: "missing" }
  | { kind: "error"; line: number; message: string };

/** テキストのファイルを読む関数。ファイルが無ければ `code` が `ENOENT` の例外を投げる */
export type ReadTextFile = (path: string) => Promise<string>;

/** `mdmark.openConfig` が「作る」で書く YAML。キーを書かず、書き方をコメントで示す */
export const CONFIG_TEMPLATE = `# mdmark の設定。VS Code のプレビューは features・libraries・side-toc・colorTheme を読みます

# 機能のオン・オフ（使うときは次の 2 行の # を外す）
# features:
#   callout: false

# 外部ライブラリのモジュール。相対パスはこのファイルのあるフォルダから（使うときは次の 2 行の # を外す）
# libraries:
#   my-chart: ./libs/my-chart.js

# 右側の目次の出し方。hover か fixed（使うときは次の 2 行の # を外す）
# side-toc:
#   mode: fixed

# 配色のテーマ。dev-swiss・theme-paper・theme-slate・theme-contrast のどれか。VS Code の設定 mdmark.colorTheme が空でないときはそちらが優先（使うときは次の 1 行の # を外す）
# colorTheme: theme-paper
`;

/** `http:`・`https:` の URL か */
const HTTP_URL_PATTERN = /^https?:/i;

/** 値がマップ（配列でも `null` でもないオブジェクト）か */
function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `mdmark.configPath` が相対パスなら基準のフォルダから解決し、絶対パスならそのまま返す */
export function resolveConfigPath(options: {
  /** `mdmark.configPath` */
  configPath: string;
  /** Markdown を含むワークスペースのフォルダ（ワークスペースの外の Markdown は Markdown のフォルダ）の絶対パス */
  baseDir: string;
}): string {
  const { configPath, baseDir } = options;
  return isAbsolute(configPath) ? configPath : resolve(baseDir, configPath);
}

/** YAML を読み、最上位がマップのときだけ `features`・`libraries`・`side-toc`・文字列の `colorTheme` と、文字列の `assets.root` を取り出す */
export function parseConfig(text: string): ConfigLoad {
  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      return {
        kind: "error",
        line: error.linePos?.[0].line ?? 1,
        message: error.message,
      };
    }
    throw error;
  }
  const config: PreviewConfig = {};
  if (isMap(parsed)) {
    if (isMap(parsed.features)) {
      config.features = parsed.features;
    }
    if (isMap(parsed.libraries)) {
      config.libraries = parsed.libraries;
    }
    if (isMap(parsed["side-toc"])) {
      config["side-toc"] = parsed["side-toc"];
    }
    if (typeof parsed.colorTheme === "string") {
      config.colorTheme = parsed.colorTheme;
    }
    if (isMap(parsed.assets) && typeof parsed.assets.root === "string") {
      return { kind: "ok", config, assetsRoot: parsed.assets.root };
    }
  }
  return { kind: "ok", config };
}

/** 設定ファイルを読んで設定を取り出す。ファイルが無ければ `missing` */
export async function loadConfig(options: {
  /** 設定ファイルの絶対パス */
  path: string;
  /** 読む関数 */
  readFile: ReadTextFile;
}): Promise<ConfigLoad> {
  let text: string;
  try {
    text = await options.readFile(options.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing" };
    }
    throw error;
  }
  const result = parseConfig(text);
  if (result.kind === "ok" && result.assetsRoot !== undefined) {
    return {
      ...result,
      assetsRoot: resolve(dirname(options.path), result.assetsRoot),
    };
  }
  return result;
}

/** `http:`・`https:` の URL はそのまま、それ以外の文字列は設定ファイルのフォルダから解決した絶対パスを `toUrl` で URL にして返す。文字列でない値はそのまま渡す */
export function resolveLibraries(options: {
  /** 取り出した `libraries` */
  libraries: Record<string, unknown>;
  /** 設定ファイルのあるフォルダ */
  configDir: string;
  /** 絶対パスを読める URL にする関数 */
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

/** `libraries` の値のうち `http:`・`https:` の URL の origin を、重なりを除いて返す */
export function libraryOrigins(
  libraries: Record<string, unknown> | undefined,
): string[] {
  const origins = new Set<string>();
  for (const value of Object.values(libraries ?? {})) {
    if (typeof value === "string" && HTTP_URL_PATTERN.test(value)) {
      // 読めない URL は CSP に足さない（読み込みは mdmark が知らせの枠にする）
      const origin = URL.canParse(value) ? new URL(value).origin : undefined;
      if (origin !== undefined && origin !== "null") {
        origins.add(origin);
      }
    }
  }
  return [...origins];
}

/** `mdmark.colorTheme` が空でなければ、設定ファイルから取り出した設定の `colorTheme` をその値に置き換えた設定を返す。空のときは `config` をそのまま返し、渡された `config` は書き換えない */
export function applyColorTheme(options: {
  /** 設定ファイルから取り出した設定 */
  config: PreviewConfig;
  /** `readSettings` の `colorTheme` */
  colorTheme: PreviewSettings["colorTheme"];
}): PreviewConfig {
  const { config, colorTheme } = options;
  return colorTheme === "" ? config : { ...config, colorTheme };
}
