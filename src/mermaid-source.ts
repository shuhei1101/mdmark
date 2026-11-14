/** mermaid のコードブロックのソースから読み取った値 */
export type MermaidSource = {
  /** front matter の `title`、無ければ `accTitle` の値。どちらも無ければ持たない */
  title?: string | undefined;
  /** mermaid の `render` に指定するソース */
  body: string;
  /** 図の種類の行の最初の単語。無ければ空 */
  kind: string;
};

/** タイトルが無いときに図の枠のタイトルにする、図の種類の行の最初の単語から参照する名前 */
export const MERMAID_KIND_NAMES: Record<string, string> = {
  flowchart: "フローチャート",
  graph: "フローチャート",
  sequenceDiagram: "シーケンス図",
  classDiagram: "クラス図",
  stateDiagram: "状態遷移図",
  "stateDiagram-v2": "状態遷移図",
  erDiagram: "ER 図",
  gantt: "ガントチャート",
  pie: "円グラフ",
};

/** テーマ `mdmark` で、mermaid の `base` テーマの変数ごとに元にする mdmark の CSS 変数 */
export const MERMAID_THEME_COLORS = {
  background: "--mdmark-color-bg",
  primaryColor: "--mdmark-color-surface",
  primaryTextColor: "--mdmark-color-text",
  primaryBorderColor: "--mdmark-color-border",
  secondaryColor: "--mdmark-color-surface",
  tertiaryColor: "--mdmark-color-bg",
  lineColor: "--mdmark-color-diagram-line",
  textColor: "--mdmark-color-text",
  noteBkgColor: "--mdmark-color-surface",
  noteTextColor: "--mdmark-color-text",
  noteBorderColor: "--mdmark-color-border",
  actorBkg: "--mdmark-color-surface",
  actorBorder: "--mdmark-color-border",
  actorTextColor: "--mdmark-color-text",
  actorLineColor: "--mdmark-color-border",
  signalColor: "--mdmark-color-text",
  signalTextColor: "--mdmark-color-text",
  edgeLabelBackground: "--mdmark-color-bg",
  titleColor: "--mdmark-color-heading",
  pie1: "--mdmark-color-series-1",
  pie2: "--mdmark-color-series-2",
  pie3: "--mdmark-color-series-3",
  pie4: "--mdmark-color-series-4",
  pie5: "--mdmark-color-series-5",
  pie6: "--mdmark-color-series-6",
  pieStrokeColor: "--mdmark-color-bg",
  pieOuterStrokeColor: "--mdmark-color-border",
  pieTitleTextColor: "--mdmark-color-heading",
  pieSectionTextColor: "--mdmark-color-bg",
  pieLegendTextColor: "--mdmark-color-text",
  mainBkg: "--mdmark-color-surface",
  nodeBorder: "--mdmark-color-border",
  clusterBkg: "--mdmark-color-surface",
  clusterBorder: "--mdmark-color-border",
  stateBkg: "--mdmark-color-surface",
  stateBorder: "--mdmark-color-border",
  stateLabelColor: "--mdmark-color-text",
  transitionColor: "--mdmark-color-diagram-line",
  specialStateColor: "--mdmark-color-text",
  innerEndBackground: "--mdmark-color-text",
  labelBackgroundColor: "--mdmark-color-bg",
  compositeBackground: "--mdmark-color-bg",
  attributeBackgroundColorOdd: "--mdmark-color-bg",
  attributeBackgroundColorEven: "--mdmark-color-surface",
  rowOdd: "--mdmark-color-bg",
  rowEven: "--mdmark-color-surface",
  relationColor: "--mdmark-color-diagram-line",
  relationLabelBackground: "--mdmark-color-bg",
  relationLabelColor: "--mdmark-color-text",
  todayLineColor: "--mdmark-color-link",
  gridColor: "--mdmark-color-border",
  sectionBkgColor: "--mdmark-color-surface",
  sectionBkgColor2: "--mdmark-color-bg",
  altSectionBkgColor: "--mdmark-color-bg",
  taskBkgColor: "--mdmark-color-surface",
  taskBorderColor: "--mdmark-color-border",
  taskTextColor: "--mdmark-color-text",
  taskTextDarkColor: "--mdmark-color-text",
  taskTextLightColor: "--mdmark-color-text",
  taskTextOutsideColor: "--mdmark-color-text",
  activeTaskBkgColor: "--mdmark-color-bg",
  activeTaskBorderColor: "--mdmark-color-link",
  doneTaskBkgColor: "--mdmark-color-border",
  doneTaskBorderColor: "--mdmark-color-border",
  critBkgColor: "--mdmark-color-bg",
  critBorderColor: "--mdmark-color-callout-caution",
} as const satisfies Record<string, `--mdmark-${string}`>;

/** どのテーマでも `themeVariables` の最後に重ね、設定の `themeVariables` でも変えさせない値 */
export const MERMAID_FIXED_THEME_VARIABLES = {
  useGradient: false,
  dropShadow: "none",
} as const;

/** 先頭の front matter（`---` の行で囲んだ範囲） */
const FRONT_MATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** front matter の `title:` の行 */
const TITLE_LINE = /^title:[ \t]*(.*)$/m;

/** `accTitle:` の行 */
const ACC_TITLE_LINE = /^[ \t]*accTitle[ \t]*:[ \t]*(.+)$/m;

/** 前後の引用符を削除する */
const unquote = (value: string): string => {
  const trimmed = value.trim();
  const quoted = /^(["'])(.*)\1$/.exec(trimmed);
  return quoted ? (quoted[2] ?? "") : trimmed;
};

/** 先頭の front matter の `title:` の行を取り出し、題と、その行を除いた本文を返却する（`title:` の行が無ければ `undefined`） */
const takeFrontTitle = (
  source: string,
): { title: string | undefined; body: string } | undefined => {
  const front = FRONT_MATTER.exec(source);
  const inner = front?.[1] ?? "";
  const line = front ? TITLE_LINE.exec(inner) : null;
  if (!front || !line) {
    return undefined;
  }
  const rest = inner.replace(/^title:.*(?:\r?\n|$)/m, "").trimEnd();
  return {
    title: unquote(line[1] ?? "") || undefined,
    body:
      (rest.trim() === "" ? "" : `---\n${rest}\n---\n`) +
      source.slice(front[0].length),
  };
};

/** `accTitle:` の行の題（無ければ `undefined`） */
const accTitleOf = (source: string): string | undefined => {
  const acc = ACC_TITLE_LINE.exec(source);
  return acc ? unquote(acc[1] ?? "") || undefined : undefined;
};

/** ソースの先頭の front matter の `title:` を取り出してその行を除き、無ければ `accTitle:` の値を取る。図の種類の行の最初の単語を `kind` にする */
export const splitMermaidTitle = (source: string): MermaidSource => {
  const front = takeFrontTitle(source);
  const body = front?.body ?? source;
  const title = front?.title ?? accTitleOf(source);
  const withoutFront = body.replace(FRONT_MATTER, "");
  const kind =
    withoutFront
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("%%"))
      ?.split(/\s/)[0] ?? "";
  return title === undefined ? { body, kind } : { title, body, kind };
};

/** 図の種類の行の最初の単語から名前を参照する。表に無い単語は `図` */
export const mermaidKindName = (kind: string): string =>
  Object.hasOwn(MERMAID_KIND_NAMES, kind)
    ? (MERMAID_KIND_NAMES[kind] ?? "図")
    : "図";
