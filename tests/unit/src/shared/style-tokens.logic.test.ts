import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

/** 共通スタイルの色のモジュール（実装が無い間は各テストが個別に失敗する） */
const loadTokens = () => import("../../../../src/shared/style-tokens.logic.ts");

/** `src/index.css` の既定のテーマの明るい配色と暗い配色の宣言を読み込む */
const readDefaultTheme = async () => {
  const css = await readFile(
    join(import.meta.dirname, "../../../../src/index.css"),
    "utf8",
  );
  const declarationsOf = (block: string): Map<string, string> =>
    new Map(
      [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
        match[1] ?? "",
        (match[2] ?? "").trim(),
      ]),
    );
  const lightStart = css.indexOf(":root {");
  const light = declarationsOf(
    css.slice(lightStart, css.indexOf("}", lightStart)),
  );
  const darkMedia = css.indexOf(
    "@media screen and (prefers-color-scheme: dark)",
  );
  const darkStart = css.indexOf(":root {", darkMedia);
  const dark = declarationsOf(
    css.slice(darkStart, css.indexOf("}", darkStart)),
  );
  /** `var(--x)` を同じ配色の宣言、無ければ明るい配色の宣言でたどる */
  const resolve = (scheme: Map<string, string>, name: string): string => {
    const value = scheme.get(name) ?? light.get(name) ?? "";
    const ref = /^var\((--[\w-]+)\)$/.exec(value);
    return ref?.[1] === undefined ? value : resolve(scheme, ref[1]);
  };
  return {
    light: (name: string) => resolve(light, name),
    dark: (name: string) => resolve(dark, name),
  };
};

// 明るいテーマと暗いテーマ（正常系）
test("test_style_color", async () => {
  // 準備
  const { STYLE_COLORS, styleColor } = await loadTokens();
  // 実行・検証
  expect(styleColor({ name: "userBand", theme: "light" })).toBe(
    STYLE_COLORS.userBand.light,
  );
  expect(styleColor({ name: "userBand", theme: "dark" })).toBe("#3a3a3a");
});

// テーマごとの値を優先する（正常系）
test("test_style_color_when_theme_override", async () => {
  // 準備
  const { styleColor } = await loadTokens();
  // 実行・検証
  expect(styleColor({ name: "userBand", theme: "light-daltonized" })).toBe(
    "#dcdcdc",
  );
  expect(styleColor({ name: "userBand", theme: "light" })).toBe("#f0f0f0");
});

// Web の CSS 変数と同じ値（正常系）
test("test_style_colors_match_css", async () => {
  // 準備
  const { STYLE_COLORS } = await loadTokens();
  const theme = await readDefaultTheme();
  const withCss = Object.values(STYLE_COLORS).filter(
    (color): color is typeof color & { css: string } =>
      "css" in color && typeof color.css === "string",
  );
  // 検証
  expect(withCss.length).toBeGreaterThan(0);
  for (const color of withCss) {
    expect([color.css, color.light]).toEqual([
      color.css,
      theme.light(color.css),
    ]);
    expect([color.css, color.dark]).toEqual([color.css, theme.dark(color.css)]);
  }
});

// 色の名前の色（正常系）
test("test_style_color_accent", async () => {
  // 準備
  const { styleColor } = await loadTokens();
  // 実行・検証
  expect(styleColor({ name: "accentGreenBg", theme: "light" })).toBe("#cbf2d2");
  expect(styleColor({ name: "accentGreenBg", theme: "dark" })).toBe("#1a3821");
});
