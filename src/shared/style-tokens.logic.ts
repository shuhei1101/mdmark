/** 明るい配色と暗い配色の 16 進の色。`css` は同じ値を持つ既定のテーマの CSS 変数 */
export type StyleColor = {
  light: string;
  dark: string;
  css?: string;
  /** テーマの名前ごとに `light`・`dark` と違う値 */
  themes?: Record<string, string>;
};

/** 共通スタイルの色。描画の部品が Web の CSS 変数と同じ色を 16 進で受け取るための表 */
export const STYLE_COLORS = {
  calloutNote: {
    light: "#1d4ed8",
    dark: "#7aa2ff",
    css: "--mdmark-color-callout-note",
  },
  calloutTip: {
    light: "#15803d",
    dark: "#4ade80",
    css: "--mdmark-color-callout-tip",
  },
  calloutImportant: {
    light: "#6d28d9",
    dark: "#c4a7ff",
    css: "--mdmark-color-callout-important",
  },
  calloutWarning: {
    light: "#b45309",
    dark: "#fbbf24",
    css: "--mdmark-color-callout-warning",
  },
  calloutCaution: {
    light: "#b91c1c",
    dark: "#f87171",
    css: "--mdmark-color-callout-caution",
  },
  heading: {
    light: "#18181b",
    dark: "#ededef",
    css: "--mdmark-color-heading",
  },
  termUnderline: {
    light: "#52525b",
    dark: "#b4b4bc",
    css: "--mdmark-color-term-underline",
  },
  border: {
    light: "#52525b",
    dark: "#b4b4bc",
    css: "--mdmark-color-muted",
  },
  codeBackground: { light: "#eef1f5", dark: "#2a2d33" },
  userBand: {
    light: "#f0f0f0",
    dark: "#3a3a3a",
    themes: { "light-daltonized": "#dcdcdc" },
  },
  accentBlueBg: {
    light: "#cce2fe",
    dark: "#1a314e",
    css: "--mdmark-color-accent-blue-bg",
  },
  accentBlueText: {
    light: "#1d4ed8",
    dark: "#7aa2ff",
    css: "--mdmark-color-accent-blue-text",
  },
  accentRedBg: {
    light: "#ffd4d1",
    dark: "#472020",
    css: "--mdmark-color-accent-red-bg",
  },
  accentRedText: {
    light: "#b91c1c",
    dark: "#f87171",
    css: "--mdmark-color-accent-red-text",
  },
  accentGreenBg: {
    light: "#cbf2d2",
    dark: "#1a3821",
    css: "--mdmark-color-accent-green-bg",
  },
  accentGreenText: {
    light: "#166534",
    dark: "#4ade80",
    css: "--mdmark-color-accent-green-text",
  },
  accentYellowBg: {
    light: "#fff2af",
    dark: "#40380e",
    css: "--mdmark-color-accent-yellow-bg",
  },
  accentYellowText: {
    light: "#854d0e",
    dark: "#facc15",
    css: "--mdmark-color-accent-yellow-text",
  },
  accentOrangeBg: {
    light: "#fedbc4",
    dark: "#4a2a12",
    css: "--mdmark-color-accent-orange-bg",
  },
  accentOrangeText: {
    light: "#b53a0a",
    dark: "#fb923c",
    css: "--mdmark-color-accent-orange-text",
  },
  accentPurpleBg: {
    light: "#edd8fd",
    dark: "#382446",
    css: "--mdmark-color-accent-purple-bg",
  },
  accentPurpleText: {
    light: "#6d28d9",
    dark: "#c4a7ff",
    css: "--mdmark-color-accent-purple-text",
  },
  accentGrayBg: {
    light: "#e4e6ea",
    dark: "#303033",
    css: "--mdmark-color-accent-gray-bg",
  },
  accentGrayText: {
    light: "#52525b",
    dark: "#b4b4bc",
    css: "--mdmark-color-accent-gray-text",
  },
  surface: {
    light: "#f4f4f5",
    dark: "#1b1b1f",
    css: "--mdmark-color-surface",
  },
  text: {
    light: "#18181b",
    dark: "#ededef",
    css: "--mdmark-color-text",
  },
} as const satisfies Record<string, StyleColor>;

/** 共通スタイルの色の名前 */
export type StyleColorName = keyof typeof STYLE_COLORS;

/** 色の名前と Claude Code のテーマの名前から、16 進の色を返却する。`themes` にそのテーマの値があればその値、無ければテーマが `light` で始まるときは明るい配色、それ以外は暗い配色 */
export const styleColor = (options: {
  name: StyleColorName;
  theme: string | undefined;
}): string => {
  const color: StyleColor = STYLE_COLORS[options.name];
  const own =
    options.theme === undefined ? undefined : color.themes?.[options.theme];
  if (own !== undefined) {
    return own;
  }
  return options.theme?.startsWith("light") === true ? color.light : color.dark;
};
