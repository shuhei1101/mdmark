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
export declare const MERMAID_KIND_NAMES: Record<string, string>;
/** テーマ `mdmark` で、mermaid の `base` テーマの変数ごとに元にする mdmark の CSS 変数 */
export declare const MERMAID_THEME_COLORS: {
    readonly background: "--mdmark-color-bg";
    readonly primaryColor: "--mdmark-color-surface";
    readonly primaryTextColor: "--mdmark-color-text";
    readonly primaryBorderColor: "--mdmark-color-border";
    readonly secondaryColor: "--mdmark-color-surface";
    readonly tertiaryColor: "--mdmark-color-bg";
    readonly lineColor: "--mdmark-color-diagram-line";
    readonly textColor: "--mdmark-color-text";
    readonly noteBkgColor: "--mdmark-color-surface";
    readonly noteTextColor: "--mdmark-color-text";
    readonly noteBorderColor: "--mdmark-color-border";
    readonly actorBkg: "--mdmark-color-surface";
    readonly actorBorder: "--mdmark-color-border";
    readonly actorTextColor: "--mdmark-color-text";
    readonly actorLineColor: "--mdmark-color-border";
    readonly signalColor: "--mdmark-color-text";
    readonly signalTextColor: "--mdmark-color-text";
    readonly edgeLabelBackground: "--mdmark-color-bg";
    readonly titleColor: "--mdmark-color-heading";
    readonly pie1: "--mdmark-color-series-1";
    readonly pie2: "--mdmark-color-series-2";
    readonly pie3: "--mdmark-color-series-3";
    readonly pie4: "--mdmark-color-series-4";
    readonly pie5: "--mdmark-color-series-5";
    readonly pie6: "--mdmark-color-series-6";
    readonly pieStrokeColor: "--mdmark-color-bg";
    readonly pieOuterStrokeColor: "--mdmark-color-border";
    readonly pieTitleTextColor: "--mdmark-color-heading";
    readonly pieSectionTextColor: "--mdmark-color-bg";
    readonly pieLegendTextColor: "--mdmark-color-text";
    readonly mainBkg: "--mdmark-color-surface";
    readonly nodeBorder: "--mdmark-color-border";
    readonly clusterBkg: "--mdmark-color-surface";
    readonly clusterBorder: "--mdmark-color-border";
    readonly stateBkg: "--mdmark-color-surface";
    readonly stateBorder: "--mdmark-color-border";
    readonly stateLabelColor: "--mdmark-color-text";
    readonly transitionColor: "--mdmark-color-diagram-line";
    readonly specialStateColor: "--mdmark-color-text";
    readonly innerEndBackground: "--mdmark-color-text";
    readonly labelBackgroundColor: "--mdmark-color-bg";
    readonly compositeBackground: "--mdmark-color-bg";
    readonly attributeBackgroundColorOdd: "--mdmark-color-bg";
    readonly attributeBackgroundColorEven: "--mdmark-color-surface";
    readonly rowOdd: "--mdmark-color-bg";
    readonly rowEven: "--mdmark-color-surface";
    readonly relationColor: "--mdmark-color-diagram-line";
    readonly relationLabelBackground: "--mdmark-color-bg";
    readonly relationLabelColor: "--mdmark-color-text";
    readonly todayLineColor: "--mdmark-color-link";
    readonly gridColor: "--mdmark-color-border";
    readonly sectionBkgColor: "--mdmark-color-surface";
    readonly sectionBkgColor2: "--mdmark-color-bg";
    readonly altSectionBkgColor: "--mdmark-color-bg";
    readonly taskBkgColor: "--mdmark-color-surface";
    readonly taskBorderColor: "--mdmark-color-border";
    readonly taskTextColor: "--mdmark-color-text";
    readonly taskTextDarkColor: "--mdmark-color-text";
    readonly taskTextLightColor: "--mdmark-color-text";
    readonly taskTextOutsideColor: "--mdmark-color-text";
    readonly activeTaskBkgColor: "--mdmark-color-bg";
    readonly activeTaskBorderColor: "--mdmark-color-link";
    readonly doneTaskBkgColor: "--mdmark-color-border";
    readonly doneTaskBorderColor: "--mdmark-color-border";
    readonly critBkgColor: "--mdmark-color-bg";
    readonly critBorderColor: "--mdmark-color-callout-caution";
};
/** どのテーマでも `themeVariables` の最後に重ね、設定の `themeVariables` でも変えさせない値 */
export declare const MERMAID_FIXED_THEME_VARIABLES: {
    readonly useGradient: false;
    readonly dropShadow: "none";
};
/** ソースの先頭の front matter の `title:` を取り出してその行を除き、無ければ `accTitle:` の値を取る。図の種類の行の最初の単語を `kind` にする */
export declare const splitMermaidTitle: (source: string) => MermaidSource;
/** 図の種類の行の最初の単語から名前を参照する。表に無い単語は `図` */
export declare const mermaidKindName: (kind: string) => string;
