/** 拡張機能の設定 */
export type PreviewSettings = {
  /** `mdmark.version` */
  version: string;
  /** `mdmark.configPath` */
  configPath: string;
  /** `mdmark.preview.liveUpdate` */
  liveUpdate: boolean;
  /** `mdmark.preview.updateDelayMs`（範囲の外の値は既定に戻す） */
  updateDelayMs: number;
  /** `mdmark.preview.scrollPreviewWithEditor` */
  scrollPreviewWithEditor: boolean;
  /** `mdmark.preview.scrollEditorWithPreview` */
  scrollEditorWithPreview: boolean;
  /** `mdmark.preview.theme`（知らない値は `auto`） */
  theme: "auto" | "light" | "dark";
  /** `mdmark.export.outputDir` */
  outputDir: string;
  /** `mdmark.colorTheme`（知らない値と文字列でない値は `""`。空は設定ファイルに従う） */
  colorTheme:
    | ""
    | "dev-swiss"
    | "theme-paper"
    | "theme-slate"
    | "theme-contrast";
};

/** 設定が無いか型が違うときに使う値。`package.json` の `contributes.configuration` の `default` と同じ値 */
export const SETTING_DEFAULTS: PreviewSettings = {
  version: "latest",
  configPath: "mdmark.config.yaml",
  liveUpdate: true,
  updateDelayMs: 300,
  scrollPreviewWithEditor: true,
  scrollEditorWithPreview: true,
  theme: "auto",
  outputDir: "",
  colorTheme: "",
};

/** `mdmark.preview.updateDelayMs` に許すミリ秒の最小と最大 */
export const UPDATE_DELAY_RANGE = { min: 0, max: 5000 };

/** 配色に許す値 */
const THEMES = ["auto", "light", "dark"] as const;

/** `mdmark.colorTheme` に許す値 */
const COLOR_THEMES = [
  "",
  "dev-swiss",
  "theme-paper",
  "theme-slate",
  "theme-contrast",
] as const;

/** 文字列の設定を読む。文字列でなければ既定 */
function stringOf(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** 真偽値の設定を読む。真偽値でなければ既定 */
function booleanOf(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** `mdmark` の設定の値を読み、型が違う値と範囲の外の値を `SETTING_DEFAULTS` に戻して返す。`get` は `mdmark.` を除いたキーの値を返す */
export function readSettings(get: (key: string) => unknown): PreviewSettings {
  const delay = get("preview.updateDelayMs");
  const theme = get("preview.theme");
  const colorTheme = get("colorTheme");
  return {
    version: stringOf(get("version"), SETTING_DEFAULTS.version),
    configPath: stringOf(get("configPath"), SETTING_DEFAULTS.configPath),
    liveUpdate: booleanOf(
      get("preview.liveUpdate"),
      SETTING_DEFAULTS.liveUpdate,
    ),
    updateDelayMs:
      typeof delay === "number" &&
      Number.isInteger(delay) &&
      delay >= UPDATE_DELAY_RANGE.min &&
      delay <= UPDATE_DELAY_RANGE.max
        ? delay
        : SETTING_DEFAULTS.updateDelayMs,
    scrollPreviewWithEditor: booleanOf(
      get("preview.scrollPreviewWithEditor"),
      SETTING_DEFAULTS.scrollPreviewWithEditor,
    ),
    scrollEditorWithPreview: booleanOf(
      get("preview.scrollEditorWithPreview"),
      SETTING_DEFAULTS.scrollEditorWithPreview,
    ),
    theme: THEMES.find((name) => name === theme) ?? SETTING_DEFAULTS.theme,
    outputDir: stringOf(get("export.outputDir"), SETTING_DEFAULTS.outputDir),
    colorTheme:
      COLOR_THEMES.find((name) => name === colorTheme) ??
      SETTING_DEFAULTS.colorTheme,
  };
}
