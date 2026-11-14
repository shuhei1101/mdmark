import sanitizeHtml from "sanitize-html";

/** class `mdmark-align-{値}` に移す `text-align` の値 */
const ALIGN_VALUES = ["left", "center", "right"];

/** `style` 属性の `text-align` の値を取り出す正規表現 */
const TEXT_ALIGN_PATTERN = /(?:^|;)\s*text-align\s*:\s*([a-z]+)/;

/** mdmark が出した要素に付けるマーカーの属性 */
const OWN_ATTRIBUTE = "data-mdmark-own";

/** `sanitizeEmbedded` が記載した人の class を残した要素に付けるマーカー。mdmark が出した要素のうちマーカーを持つものは、`sanitize` が class を絞らない */
const KEEP_CLASS_ATTRIBUTE = "data-mdmark-keep-class";

/** 文書に記載した生の HTML が持ってよい記法の class: 列の配置と、外部ライブラリのマーカーの場所 */
const RAW_CLASS_PATTERN = /^(?:mdmark-align-|mdmark-embed$)/;

/** 記法の class（`mdmark-` で始まるものと `markdown-alert*`、図のツールチップを持つ要素の `has-tip`、リンク先を持つノードの `has-link`、脚注の番号の直後に続く注記のマーカーの `is-after-ref`） */
const SYNTAX_CLASS_PATTERN =
  /^(?:mdmark-|markdown-alert|has-tip$|has-link$|has-children$|is-virtual$|is-after-ref$)/;

/** 図の部品が定義から出した要素だけが持てる要素。文書に記載したものは取り除く */
export const DIAGRAM_ONLY_TAGS = new Set([
  "svg",
  "defs",
  "marker",
  "pattern",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "button",
  "output",
  "label",
]);

/** 取り除く要素に付けるマーカーの属性 */
const DROP_ATTRIBUTE = "data-mdmark-drop";

/** 図の部品が出した要素の `style` に許す宣言: 位置と大きさ（px）と、名前を内接させる余白（0 以上の px の値 1 つか 2 つ）と、拡大の倍率だけ */
const DIAGRAM_STYLE_PATTERN =
  /^(?:\s*(?:(?:left|top|width|height):-?\d+(?:\.\d+)?px|padding:\d+(?:\.\d+)?px(?: \d+(?:\.\d+)?px)?|transform:scale\(\d+(?:\.\d+)?\))\s*;?)+$/;

/** コードブロックの `code` が持つ、行番号の桁の数の `style`（`--mdmark-code-digits: {数字}` だけ） */
const CODE_DIGITS_PATTERN = /^\s*--mdmark-code-digits\s*:\s*(\d+)\s*;?\s*$/;

/** 画像と動画の幅の `style`（`--mdmark-image-width: {整数}px` か `{整数}%` だけ） */
const IMAGE_WIDTH_PATTERN =
  /^\s*--mdmark-image-width\s*:\s*(\d+(?:px|%))\s*;?\s*$/;

/** ギャラリーの列の数の `style`（`--mdmark-gallery-cols: {1〜6}` だけ） */
const GALLERY_COLS_PATTERN = /^\s*--mdmark-gallery-cols\s*:\s*([1-6])\s*;?\s*$/;

/** 記法が出したものだけを残す動画と音声の要素 */
const MEDIA_TAGS = new Set(["video", "audio"]);

/** 元の行番号の属性と、その値に許す構造（0 以上の整数） */
const SOURCE_LINE_ATTRIBUTE = "data-source-line";
const SOURCE_LINE_PATTERN = /^\d+$/;

/** 画像の `src` と動画の `poster` に許す `data:` URL（書き出しが埋める画像）: 画像の種類と base64 と、配色ごとの画像のフラグメントだけ */
const DATA_IMAGE_PATTERN =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]*(?:#only-(?:light|dark))?$/;

/** 画像の `data:` URL を持つ要素と属性 */
const DATA_IMAGE_ATTRIBUTES: Readonly<Record<string, string>> = {
  img: "src",
  video: "poster",
};

/** 画像の構造でない `data:` URL か */
const isForbiddenDataUrl = (url: string | undefined): boolean =>
  url?.startsWith("data:") === true && !DATA_IMAGE_PATTERN.test(url);

/** 許さない構造の `data:` URL を削除する: `img` の `src` と `video` の `poster` は画像の構造だけを残し、`video`・`audio` の `src` は削除する */
function dropDataUrls(tagName: string, attribs: Record<string, string>): void {
  const imageAttribute = Object.hasOwn(DATA_IMAGE_ATTRIBUTES, tagName)
    ? DATA_IMAGE_ATTRIBUTES[tagName]
    : undefined;
  if (
    imageAttribute !== undefined &&
    isForbiddenDataUrl(attribs[imageAttribute])
  ) {
    delete attribs[imageAttribute];
  }
  if (MEDIA_TAGS.has(tagName) && attribs.src?.startsWith("data:")) {
    delete attribs.src;
  }
}

/** `tabindex` があれば 0 にする */
function fixTabindex(
  tagName: string,
  attribs: Record<string, string>,
): sanitizeHtml.Tag {
  const next = { ...attribs };
  if (next.tabindex !== undefined) {
    next.tabindex = "0";
  }
  return { tagName, attribs: next };
}

/** `pre`・`table` か（単語の `tabindex` と `aria-label` は mdmark が出した要素だけが持つ） */
const isPreOrTable = (tagName: string): boolean =>
  tagName === "pre" || tagName === "table";

/** 名前ごとの、文書に記載した生の HTML に残す属性の判定 */
const ATTRIBUTE_KEEPERS: Readonly<
  Record<string, (tagName: string, value: string) => boolean>
> = {
  // 外部ライブラリのマーカーの場所の `status` だけを残す
  role: (tagName, value) => tagName === "div" && value === "status",
  "aria-label": isPreOrTable,
  tabindex: isPreOrTable,
  [SOURCE_LINE_ATTRIBUTE]: () => true,
};

/** 文書に記載した生の HTML から落とす、構造の属性 */
const STRUCTURE_ATTRIBUTES = new Set([
  "id",
  "hidden",
  "colspan",
  "rowspan",
  "scope",
]);

/** 文書に記載した生の HTML に残す `data-*` か */
const keepsDataAttribute = (tagName: string, name: string): boolean =>
  (tagName === "td" && name === "data-label") ||
  (tagName === "div" &&
    (name === "data-mdmark-slot" || name === "data-mdmark-args"));

/** 文書に記載した生の HTML に残す、`data-*` でも名前ごとの判定でもない属性か */
const keepsPlainAttribute = (tagName: string, name: string): boolean => {
  if (tagName === "abbr" && name === "title") {
    return false;
  }
  if (STRUCTURE_ATTRIBUTES.has(name) || name.startsWith("aria-")) {
    return false;
  }
  // 図の部品の属性は、図の部品が出した要素だけが持つ（`input` の `type`・`disabled` は、描くときにもう一度付けた値）
  return (
    !DIAGRAM_ATTRIBUTE_SET.has(name) ||
    (tagName === "input" && (name === "type" || name === "disabled"))
  );
};

/** 文書に記載した生の HTML に残す属性か（class を除く） */
function keepsAttribute(tagName: string, name: string, value: string): boolean {
  const keeper = Object.hasOwn(ATTRIBUTE_KEEPERS, name)
    ? ATTRIBUTE_KEEPERS[name]
    : undefined;
  if (keeper) {
    return keeper(tagName, value);
  }
  return name.startsWith("data-")
    ? keepsDataAttribute(tagName, name)
    : keepsPlainAttribute(tagName, name);
}

/** 文書に記載した生の HTML から、記法の class・`data-*`・`id`・`role`・`aria-*` などを落とす */
function dropSyntaxAttributes(
  tagName: string,
  attribs: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(attribs)) {
    if (name === "class") {
      const classes = value
        .split(/\s+/)
        .filter(
          (name) =>
            !SYNTAX_CLASS_PATTERN.test(name) || RAW_CLASS_PATTERN.test(name),
        );
      if (classes.length) {
        next.class = classes.join(" ");
      }
    } else if (keepsAttribute(tagName, name, value)) {
      next[name] = value;
    }
  }
  return next;
}

/** 図の部品の要素が持つ属性。名前は sanitize-html が読み込む小文字で記載する（ブラウザが svg の属性の大文字を戻す）。文書に記載した要素は `dropSyntaxAttributes` が属性を絞る */
const DIAGRAM_ATTRIBUTES = [
  "tabindex",
  "style",
  "for",
  "type",
  "min",
  "max",
  "step",
  "value",
  "disabled",
  "datetime",
  "d",
  "viewbox",
  "width",
  "height",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "marker-end",
  "markerwidth",
  "markerheight",
  "markerunits",
  "patternunits",
  "refx",
  "refy",
  "orient",
  "transform",
  "text-anchor",
];

/** 範囲のスクリプトの機能で mdmark だけが出す要素 */
const RANGE_SCRIPT_TAGS = new Set(["style", "template"]);

/** `DIAGRAM_ATTRIBUTES` の集合 */
const DIAGRAM_ATTRIBUTE_SET = new Set(DIAGRAM_ATTRIBUTES);

/** sanitize-html に指定する、描くごとに変わらない設定: 許可していない要素・属性・URL を落とす */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "del",
    "details",
    "summary",
    "input",
    "nav",
    "figure",
    "figcaption",
    "style",
    "template",
    ...MEDIA_TAGS,
    ...DIAGRAM_ONLY_TAGS,
  ],
  allowedAttributes: {
    "*": [
      "id",
      "role",
      "aria-*",
      "data-*",
      "hidden",
      "colspan",
      "rowspan",
      "scope",
      ...DIAGRAM_ATTRIBUTES,
    ],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    // ER 図の列のマーカーの名前（文書に記載した `abbr` の `title` は `dropSyntaxAttributes` が落とす）
    abbr: ["title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    pre: ["tabindex"],
    table: ["tabindex"],
    span: ["tabindex"],
    video: [
      "src",
      "controls",
      "autoplay",
      "muted",
      "loop",
      "playsinline",
      "preload",
      "poster",
    ],
    audio: ["src", "controls", "autoplay", "muted", "loop", "preload"],
  },
  // 図の部品の要素以外から取り除く要素は、マーカーを付けた要素を中身ごと削除する
  exclusiveFilter: (frame) => frame.attribs[DROP_ATTRIBUTE] !== undefined,
  // 記法の class は、mdmark が出した要素だけが持つ（生の HTML のものは `transformTags` が先に落とす）
  allowedClasses: {
    "*": [
      "mdmark-*",
      "markdown-alert*",
      "has-tip",
      "has-link",
      "has-children",
      "is-virtual",
      "is-after-ref",
    ],
    code: ["language-*"],
    li: ["task-list-item"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // 画像の `src` と動画の `poster` は `data:` URL も許す（残す構造は `transformTags` が絞る）
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    video: ["http", "https", "data"],
    audio: ["http", "https", "data"],
  },
  // postcss を呼ばない。`style` 属性は許可せず、列の配置だけを class に移す
  parseStyleAttributes: false,
  // 範囲の `style` は mdmark が根の要素の中に限って出したものだけを残す（文書に記載したものは `transformTags` が落とす）
  allowVulnerableTags: true,
  // 値の無い `hidden`（CSV の表の元の CSV）を残す。文書に記載した `hidden` は `dropSyntaxAttributes` が先に落とす
  nonBooleanAttributes: sanitizeHtml.defaults.nonBooleanAttributes.filter(
    (name) => name !== "hidden",
  ),
};

/** スキームを見分ける前に除く、制御文字と空白の文字コードの上限（U+0000〜U+0020） */
const CONTROL_OR_SPACE_MAX = 0x20;

/** 本文のリンクと同じ許可（`SANITIZE_OPTIONS` の `allowedSchemes` のスキームか、スキームを持たない相対 URL）に該当する URL か */
export function isAllowedUrl(url: string): boolean {
  // sanitize-html と同じく、前後の空白と制御文字を除いてスキームを見分ける
  const trimmed = Array.from(url)
    .filter((char) => char.charCodeAt(0) > CONTROL_OR_SPACE_MAX)
    .join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1];
  if (scheme === undefined) {
    return true;
  }
  const allowed = SANITIZE_OPTIONS.allowedSchemes;
  return Array.isArray(allowed) && allowed.includes(scheme.toLowerCase());
}

/** 埋め込んだ HTML の `style` に残す宣言: 名前と、値の許可の正規表現。値に `url(`・`expression(`・単位 `vw`・`vh` を含むものは、ここに該当しても落とす */
export const EMBED_STYLES: ReadonlyArray<{ name: RegExp; value: RegExp }> =
  (() => {
    const length = String.raw`-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|ch|pt|fr)?`;
    // 負の値を持たない長さ（`margin`・`padding` が使用する。負の値は他の要素の上へはみ出させるため落とす）
    const unsigned = String.raw`(?:\d+|\d*\.\d+)(?:px|rem|em|%|ch|pt|fr)?`;
    const keyword = "[a-z]+(?:-[a-z]+)*";
    const color = String.raw`#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\(\s*[0-9.%\s,/-]+\)|var\(--mdmark-[a-z0-9-]+\)`;
    const fn = String.raw`(?:repeat|minmax)\([a-z0-9\s,.%-]*\)`;
    /** 空白で区切った 1 つ以上の単語が、どれも `tokens` のどれかに該当する値の正規表現 */
    const words = (tokens: string): RegExp =>
      new RegExp(`^(?:${tokens})(?:\\s+(?:${tokens}))*$`, "i");
    return [
      {
        name: /^display$/,
        value:
          /^(?:block|inline|inline-block|flex|inline-flex|grid|inline-grid|none)$/i,
      },
      {
        name: /^(?:flex(?:-(?:direction|wrap|grow|shrink|basis))?|align-items|justify-content|align-self)$/,
        value: words(`${keyword}|${length}`),
      },
      {
        name: /^(?:grid-template-columns|grid-template-rows|grid-column|grid-row|gap|row-gap|column-gap)$/,
        value: words(`${keyword}|${length}|${fn}`),
      },
      {
        name: /^(?:margin|padding)(?:-[a-z-]+)?$/,
        value: words(`${unsigned}|auto`),
      },
      {
        name: /^border(?:-(?!image)[a-z-]+)?$/,
        value: words(`${length}|${color}`),
      },
      {
        name: /^(?:width|max-width|min-width|height)$/,
        value: words(`${length}|${keyword}`),
      },
      { name: /^(?:color|background-color)$/, value: words(color) },
      {
        name: /^(?:font-size|font-weight|text-align)$/,
        value: words(`${length}|${keyword}`),
      },
    ];
  })();

/** 値に含んではいけないもの: コメント・引用符・`\`・`url(`・`expression(`・画面に対する単位（`vw`・`vh` など） */
const EMBED_STYLE_FORBIDDEN =
  /\/\*|["'\\]|url\(|expression\(|\d\s*(?:dvw|dvh|svw|svh|lvw|lvh|vmin|vmax|vw|vh)\b/i;

/** 埋め込んだ HTML の要素の `style` から、`EMBED_STYLES` の宣言だけを残して `名前:値` を `;` でつないだ値にする。残る宣言が無ければ空の文字。postcss を使用しない */
export function filterEmbeddedStyle(style: string): string {
  const kept: string[] = [];
  for (const declaration of style.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) {
      continue;
    }
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration
      .slice(colon + 1)
      .trim()
      .replace(/\s+/g, " ");
    if (
      value !== "" &&
      !EMBED_STYLE_FORBIDDEN.test(value) &&
      EMBED_STYLES.some(
        (entry) => entry.name.test(name) && entry.value.test(value),
      )
    ) {
      kept.push(`${name}:${value}`);
    }
  }
  return kept.join(";");
}

/** mdmark が出した要素の、1 つの宣言だけを残す CSS 変数（画像の幅・ギャラリーの列の数・コードブロックの行番号の桁の数）。ほかの宣言を重ねたものと読み込めない値は、全て落とす */
const OWN_STYLE_VARIABLES: ReadonlyArray<{
  name: string;
  pattern: RegExp;
  format: (value: string) => string;
}> = [
  {
    name: "--mdmark-image-width",
    pattern: IMAGE_WIDTH_PATTERN,
    format: (value) => `--mdmark-image-width: ${value}`,
  },
  {
    name: "--mdmark-gallery-cols",
    pattern: GALLERY_COLS_PATTERN,
    format: (value) => `--mdmark-gallery-cols: ${value}`,
  },
  {
    name: "--mdmark-code-digits",
    pattern: CODE_DIGITS_PATTERN,
    format: (value) => `--mdmark-code-digits:${value}`,
  },
];

/** mdmark が出した要素の `style` に残す値: 図の部品の位置・大きさ・余白・倍率はそのまま、コードブロックの行番号の桁の数だけを持つものはその宣言、それ以外は埋め込んだ HTML の許した宣言だけ */
function ownStyle(style: string): string {
  if (DIAGRAM_STYLE_PATTERN.test(style)) {
    return style;
  }
  const variable = OWN_STYLE_VARIABLES.find((entry) =>
    style.includes(entry.name),
  );
  if (variable) {
    const value = variable.pattern.exec(style)?.[1];
    return value === undefined ? "" : variable.format(value);
  }
  return filterEmbeddedStyle(style);
}

/** 埋め込んだ HTML の中の、図の部品の配置場所を預ける要素と、そのマーカーの属性。`sanitizeEmbedded` が残し、呼ぶ側が図の部品の HTML に戻す */
export const EMBED_PART_TAG = "mdmark-part";
export const EMBED_PART_ATTRIBUTE = "data-part";

/** 文字を `onText` に指定しない要素（用語の下線を付けない場所） */
export const TEXT_FILTER_SKIP_TAGS = new Set([
  "a",
  "code",
  "pre",
  "button",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
]);

/** 許可していない要素のうち、中身の文字ごと落とす要素（sanitize-html の既定と同じ） */
export const EMBEDDED_NON_TEXT_TAGS = [
  "script",
  "style",
  "textarea",
  "option",
  "xmp",
];

/** 埋め込んだ HTML の `sanitize-html` の設定。文書に記載した生の HTML と同じ要素・URL の許可に `button` を追加し、記載した人の class・`id`・`data-hint` 以外の `data-*`・`role`・`aria-*` は持たせない */
const EMBEDDED_OPTIONS: sanitizeHtml.IOptions = {
  ...SANITIZE_OPTIONS,
  allowedTags: [
    ...(SANITIZE_OPTIONS.allowedTags as string[]),
    "button",
    EMBED_PART_TAG,
  ],
  allowedAttributes: {
    "*": ["data-hint", "style", "colspan", DROP_ATTRIBUTE],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    button: ["type"],
    [EMBED_PART_TAG]: [EMBED_PART_ATTRIBUTE],
  },
  allowedClasses: {},
  nonTextTags: EMBEDDED_NON_TEXT_TAGS,
};

/** 埋め込んだ HTML の中身を落とす: `script` 要素・`on` で始まる属性・`javascript:` の URL・許していない `style` の宣言を落とし、`button` は `type="button"` で残す。`onText` は本文の文字（エスケープ済み。`a`・`code`・`pre`・`button`・見出しの中を除く）を受け、置き換える HTML を返却する。`keepClasses` が真なら、記載した人の class を記法の class を除いて残す */
export function sanitizeEmbedded(
  html: string,
  onText: (text: string) => string,
  keepClasses = false,
): string {
  return sanitizeHtml(html, {
    ...EMBEDDED_OPTIONS,
    ...(keepClasses
      ? {
          allowedAttributes: {
            ...EMBEDDED_OPTIONS.allowedAttributes,
            "*": [
              ...((
                EMBEDDED_OPTIONS.allowedAttributes as Record<string, string[]>
              )["*"] ?? []),
              "class",
              KEEP_CLASS_ATTRIBUTE,
            ],
          },
          allowedClasses: undefined,
        }
      : {}),
    textFilter: (text, tagName) =>
      TEXT_FILTER_SKIP_TAGS.has(tagName) ? text : onText(text),
    transformTags: {
      "*": (tagName, attribs) => {
        if (tagName === "input") {
          return { tagName, attribs: embeddedCheckbox(attribs) };
        }
        const next = { ...attribs };
        const style = filterEmbeddedStyle(attribs.style ?? "");
        if (style === "") {
          delete next.style;
        } else {
          next.style = style;
        }
        if (tagName === "button") {
          next.type = "button";
        }
        delete next[KEEP_CLASS_ATTRIBUTE];
        if (keepClasses) {
          keepAuthorClasses(next);
        }
        dropDataUrls(tagName, next);
        // 図の部品の要素は、記載したものを中身ごと落とす（`button` だけは残す）
        if (DIAGRAM_ONLY_TAGS.has(tagName) && tagName !== "button") {
          next[DROP_ATTRIBUTE] = "1";
        }
        return { tagName, attribs: next };
      },
    },
  });
}

/** 入力欄は、無効のチェックボックスにし、元の属性からは `checked` だけを引き継ぐ */
function embeddedCheckbox(
  attribs: Record<string, string>,
): Record<string, string> {
  const checkbox: Record<string, string> = { type: "checkbox", disabled: "" };
  if (attribs.checked !== undefined) {
    checkbox.checked = "";
  }
  return checkbox;
}

/** 記載した人の class を、記法の class を除いて残し、残したことを示す属性を付ける */
function keepAuthorClasses(next: Record<string, string>): void {
  if (next.class === undefined) {
    return;
  }
  const classes = next.class
    .split(/\s+/)
    .filter((name) => name !== "" && !SYNTAX_CLASS_PATTERN.test(name));
  if (classes.length > 0) {
    next.class = classes.join(" ");
    next[KEEP_CLASS_ATTRIBUTE] = "";
  } else {
    delete next.class;
  }
}

/** `SANITIZE_OPTIONS` の `allowedClasses` のとおり、要素 `tagName` が持ってよい class か */
function isAllowedClass(tagName: string, name: string): boolean {
  const allowed = SANITIZE_OPTIONS.allowedClasses as Record<string, string[]>;
  return [...(allowed["*"] ?? []), ...(allowed[tagName] ?? [])].some(
    (pattern) =>
      pattern.endsWith("*")
        ? name.startsWith(pattern.slice(0, -1))
        : name === pattern,
  );
}

/** class を `SANITIZE_OPTIONS` の `allowedClasses` のとおりに絞る（残らなければ class を削除する） */
function filterClasses(next: Record<string, string>, tagName: string): void {
  if (next.class === undefined) {
    return;
  }
  const classes = next.class
    .split(/\s+/)
    .filter((name) => name !== "" && isAllowedClass(tagName, name));
  if (classes.length > 0) {
    next.class = classes.join(" ");
  } else {
    delete next.class;
  }
}

/** 元の行番号は、誰が出した要素でも 0 以上の整数のときだけ残す */
function dropInvalidSourceLine(next: Record<string, string>): void {
  const line = next[SOURCE_LINE_ATTRIBUTE];
  if (line !== undefined && !SOURCE_LINE_PATTERN.test(line)) {
    delete next[SOURCE_LINE_ATTRIBUTE];
  }
}

/** `style` の `text-align` の値を class に移す */
function addAlignClass(next: Record<string, string>, style: string): void {
  const align = TEXT_ALIGN_PATTERN.exec(style)?.[1];
  if (align && ALIGN_VALUES.includes(align)) {
    next.class = [next.class, `mdmark-align-${align}`]
      .filter(Boolean)
      .join(" ");
  }
}

/** 図の部品・動画と音声・範囲の `style` と `template` の要素か（文書に記載したものは中身ごと取り除く） */
function isDocumentOnlyTag(tagName: string): boolean {
  return (
    DIAGRAM_ONLY_TAGS.has(tagName) ||
    MEDIA_TAGS.has(tagName) ||
    RANGE_SCRIPT_TAGS.has(tagName)
  );
}

/** 許可していないものを落とした HTML を返却する。`nonce` と同じマーカーを持つ要素は mdmark が記法から出したものとして、記法の class・`data-*`・`id` などを残す。そのうち `sanitizeEmbedded` が記載した人の class を残した要素は、class を絞らない */
export function sanitize(html: string, nonce: string): string {
  return sanitizeHtml(html, {
    ...SANITIZE_OPTIONS,
    // class は `transformTags` で `SANITIZE_OPTIONS` の `allowedClasses` のとおりに絞る
    allowedClasses: { "*": [/^\S+$/] },
    transformTags: {
      // 全ての要素: mdmark が出した要素以外から記法の属性を落とし、`text-align` の値を class に移し、`style` は常に削除する
      "*": (tagName, attribs) => {
        const own = attribs[OWN_ATTRIBUTE] === nonce;
        const next = own
          ? { ...attribs }
          : dropSyntaxAttributes(tagName, attribs);
        delete next[OWN_ATTRIBUTE];
        const keepClass = own && attribs[KEEP_CLASS_ATTRIBUTE] !== undefined;
        delete next[KEEP_CLASS_ATTRIBUTE];
        if (!keepClass) {
          filterClasses(next, tagName);
        }
        dropInvalidSourceLine(next);
        // `data:` URL は、画像の構造のものだけ残す
        dropDataUrls(tagName, next);
        addAlignClass(next, attribs.style ?? "");
        // `style` は、mdmark が出した要素のものだけを残す: 図の部品の位置・大きさ・倍率か、埋め込んだ HTML の許した宣言
        const kept = own ? ownStyle(attribs.style ?? "") : "";
        if (kept === "") {
          delete next.style;
        } else {
          next.style = kept;
        }
        if (!own && isDocumentOnlyTag(tagName)) {
          next[DROP_ATTRIBUTE] = "1";
        }
        return { tagName, attribs: next };
      },
      // 入力欄: 常に無効のチェックボックスにし、元の属性からは `checked` だけを引き継ぐ。図の部品が出したスライダーはそのまま残す
      input: (tagName, attribs) => {
        if (attribs[OWN_ATTRIBUTE] === nonce && attribs.type === "range") {
          return { tagName, attribs };
        }
        const next: Record<string, string> = { type: "checkbox", disabled: "" };
        if (attribs.checked !== undefined) {
          next.checked = "";
        }
        return { tagName, attribs: next };
      },
      pre: fixTabindex,
      table: fixTabindex,
    },
  });
}
