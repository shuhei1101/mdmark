import { styleColor } from "../shared/style-tokens.logic.ts";
import {
  readSettings,
  type SettingsEngine,
  SettingsError,
  type StyleSettings,
} from "./settings.ts";
import {
  type GlossaryEngine,
  GlossaryError,
  loadGlossary,
  matchTerms,
  type TermMark,
} from "./terms.ts";

/** 部品の木のノード。中身は Claude Code が持つ */
export type UiNode = unknown;

/** `$.ui.resolve(e)` が返却する部品 */
export type Elements = {
  Box: unknown;
  Text: unknown;
  Button: unknown;
  Markdown: unknown;
  Code: unknown;
};

/** mod の環境が持つ JSX の factory */
declare const h: (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => UiNode;

/** 用語のカードを折り返す桁数の上限（行の幅が狭いときは行の幅） */
export const CARD_MAX_WIDTH = 48;

/** 行頭の `❯` の色（Claude Code の標準の発言の記号と同じ 256 色の 246） */
const PROMPT_MARK_COLOR = "#949494";

/** 描画で使用する `$` の機能 */
export type RenderEngine = SettingsEngine &
  GlossaryEngine & {
    settings: { read: (args: { key: string }) => Promise<unknown> };
    ui: {
      resolve: (e: never) => Elements;
      log: (text: string, options?: { to?: "debug" }) => void;
      copy: (args: { text: string; surface?: string }) => Promise<unknown>;
      invalidate: (event: "ui.render") => void;
    };
  };

/** 描画の入力のうち、mod が参照するフィールド */
export type RenderEvent = {
  props: { text: string; origin?: { kind?: string } };
  surface: string;
  viewport?: { columns?: number };
  requestId?: string;
};

/** 行の中の、装飾の記号を除いた 1 文字と、元の行での位置・装飾 */
type StyledChar = {
  char: string;
  at: number;
  bold: boolean;
  code: boolean;
  link: boolean;
};

/** 行の `**太字**`・`` `コード` ``・`[文字](URL)` の記号を除き、文字ごとの装飾と元の位置を返却する */
const styledChars = (line: string): StyledChar[] => {
  const chars: StyledChar[] = [];
  let bold = false;
  let i = 0;
  while (i < line.length) {
    if (line.startsWith("**", i)) {
      bold = !bold;
      i += 2;
      continue;
    }
    const code = /^`([^`]*)`/.exec(line.slice(i));
    if (code?.[1] !== undefined) {
      for (const [offset, char] of [...code[1]].entries()) {
        chars.push({ char, at: i + 1 + offset, bold, code: true, link: false });
      }
      i += code[0].length;
      continue;
    }
    const link = /^\[([^\]]*)\]\([^)]*\)/.exec(line.slice(i));
    if (link?.[1] !== undefined) {
      for (const [offset, char] of [...link[1]].entries()) {
        chars.push({ char, at: i + 1 + offset, bold, code: false, link: true });
      }
      i += link[0].length;
      continue;
    }
    chars.push({ char: line[i] ?? "", at: i, bold, code: false, link: false });
    i += 1;
  }
  return chars;
};

/** 用語の部品（下線・脚注の番号・カード） */
const termNode = (options: {
  elements: Elements;
  mark: TermMark;
  text: string;
  parts: StyleSettings["parts"];
  theme: string | undefined;
  width: number | undefined;
}): UiNode => {
  const { elements, mark, text, parts, theme, width } = options;
  const { Box, Text } = elements;
  const cardWidth = Math.min(CARD_MAX_WIDTH, width ?? CARD_MAX_WIDTH);
  const card = h(
    Box,
    {
      position: "absolute",
      top: 1,
      left: 0,
      display: "none",
      hover: { display: "flex" },
      flexDirection: "column",
      borderStyle: "round",
      borderColor: styleColor({ name: "border", theme }),
      backgroundColor: styleColor({ name: "codeBackground", theme }),
      width: cardWidth,
    },
    h(Text, { bold: true }, mark.title),
    h(Text, null, mark.description),
  );
  return h(
    Box,
    { key: `term-${mark.footnote}-${mark.line}-${mark.start}` },
    h(
      Text,
      { underline: true, color: styleColor({ name: "termUnderline", theme }) },
      text,
    ),
    parts.footnote
      ? h(Text, { dimColor: true }, `[${mark.footnote}]`)
      : undefined,
    parts.hover_card ? card : undefined,
  );
};

/** 装飾ごとの Text の属性 */
const styleProps = (
  char: StyledChar,
  theme: string | undefined,
): Record<string, unknown> => ({
  ...(char.bold ? { bold: true } : {}),
  ...(char.code
    ? { color: styleColor({ name: "heading", theme }), mono: true }
    : {}),
  ...(char.link ? { underline: true } : {}),
});

/** 1 行の文字列を、用語ごとに keyed Box に分けた Text の並びにする。用語には下線・脚注の番号・カードを付ける */
export const renderTermText = (options: {
  elements: Elements;
  line: string;
  marks: TermMark[];
  parts: StyleSettings["parts"];
  theme: string | undefined;
  width?: number;
}): UiNode => {
  const { elements, line, marks, parts, theme, width } = options;
  const { Box, Text } = elements;
  const markOf = (at: number) =>
    marks.find((mark) => at >= mark.start && at < mark.end);
  const runs: { text: string; char: StyledChar; mark: TermMark | undefined }[] =
    [];
  for (const char of styledChars(line)) {
    const mark = markOf(char.at);
    const last = runs.at(-1);
    const same =
      last !== undefined &&
      last.mark === mark &&
      last.char.bold === char.bold &&
      last.char.code === char.code &&
      last.char.link === char.link;
    if (same) {
      last.text += char.char;
    } else {
      runs.push({ text: char.char, char, mark });
    }
  }
  const nodes = runs.map((run) =>
    run.mark === undefined
      ? h(Text, styleProps(run.char, theme), run.text)
      : termNode({
          elements,
          mark: run.mark,
          text: run.text,
          parts,
          theme,
          width,
        }),
  );
  return h(Box, { flexDirection: "row", flexWrap: "wrap" }, ...nodes);
};

/** 脚注の一覧の行 */
export const renderFootnotes = (options: {
  elements: Elements;
  marks: TermMark[];
}): UiNode[] =>
  options.marks.map((mark) =>
    h(
      options.elements.Text,
      { key: `footnote-${mark.footnote}`, dimColor: true },
      `[${mark.footnote}] ${mark.title}: ${mark.description}`,
    ),
  );

/** 用語集を集めて本文と照合する。用語集を読み込めなければデバッグログに理由を記載して空を返却する */
export async function termMarksOf(
  $: RenderEngine,
  options: { settings: StyleSettings; text: string },
): Promise<TermMark[]> {
  const { settings, text } = options;
  if (!settings.parts.terms || settings.glossary === undefined) {
    return [];
  }
  try {
    const glossary = await loadGlossary($, { configPath: settings.glossary });
    return matchTerms({ glossary, text });
  } catch (error) {
    if (!(error instanceof GlossaryError)) {
      throw error;
    }
    $.ui.log(error.message, { to: "debug" });
    return [];
  }
}

/** `UserMessage` の `ui.render` で、描き換える条件を満たすときだけ、行頭の `❯` と用語のマーカー付きの本文を背景の帯の Box で描く */
export async function renderUserMessage(
  $: RenderEngine,
  e: RenderEvent,
  next: (e: RenderEvent) => Promise<UiNode>,
): Promise<UiNode> {
  let settings: StyleSettings;
  try {
    settings = await readSettings($);
  } catch (error) {
    if (!(error instanceof SettingsError)) {
      throw error;
    }
    $.ui.log(error.message, { to: "debug" });
    return next(e);
  }
  if (
    !settings.enabled ||
    !settings.targets.includes("user") ||
    !settings.parts.terms ||
    settings.glossary === undefined ||
    e.props.origin?.kind !== "composer"
  ) {
    return next(e);
  }
  const text = e.props.text;
  const marks = await termMarksOf($, { settings, text });
  if (marks.length === 0) {
    return next(e);
  }
  const elements = $.ui.resolve(e as never);
  const { Box, Text } = elements;
  const theme = (await $.settings.read({ key: "theme" })) as string | undefined;
  const width = e.viewport?.columns;
  const lines = text.split("\n").map((line, index) =>
    renderTermText({
      elements,
      line,
      marks: marks.filter((mark) => mark.line === index + 1),
      parts: settings.parts,
      theme,
      ...(width === undefined ? {} : { width }),
    }),
  );
  return h(
    Box,
    {
      flexDirection: "column",
      backgroundColor: styleColor({ name: "userBand", theme }),
    },
    h(
      Box,
      { flexDirection: "row" },
      h(Text, { color: PROMPT_MARK_COLOR }, "❯ "),
      h(Box, { flexDirection: "column" }, ...lines),
    ),
    ...(settings.parts.footnote ? renderFootnotes({ elements, marks }) : []),
  );
}
