import sanitizeHtml from "sanitize-html";

/** class `mdmark-align-{値}` に移す `text-align` の値 */
const ALIGN_VALUES = ["left", "center", "right"];

/** `style` 属性の `text-align` の値を取り出す正規表現 */
const TEXT_ALIGN_PATTERN = /(?:^|;)\s*text-align\s*:\s*([a-z]+)/;

/** mdmark が出した要素に付ける印の属性 */
const OWN_ATTRIBUTE = "data-mdmark-own";

/** 文書に書いた生の HTML が持ってよい記法の class: 列の揃えと、外部ライブラリの印の場所 */
const RAW_CLASS_PATTERN = /^(?:mdmark-align-|mdmark-embed$)/;

/** 記法の class（`mdmark-` で始まるものと `markdown-alert*`、図のツールチップを持つ要素の `has-tip`） */
const SYNTAX_CLASS_PATTERN = /^(?:mdmark-|markdown-alert|has-tip$)/;

/** 図の部品が定義から出した要素だけが持てる要素。文書に書いたものは取り除く */
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

/** 取り除く要素に付ける印の属性 */
const DROP_ATTRIBUTE = "data-mdmark-drop";

/** 図の部品が出した要素の `style` に許す宣言: 位置と大きさ（px）と、拡大の倍率だけ */
const DIAGRAM_STYLE_PATTERN =
  /^(?:\s*(?:(?:left|top|width|height):-?\d+(?:\.\d+)?px|transform:scale\(\d+(?:\.\d+)?\))\s*;?)+$/;

/** コードブロックの `code` が持つ、行番号の桁の数の `style`（`--mdmark-code-digits: {数字}` だけ） */
const CODE_DIGITS_PATTERN = /^\s*--mdmark-code-digits\s*:\s*(\d+)\s*;?\s*$/;

/** 画像の `src` に許す `data:` URL（書き出しが埋める画像）: 画像の種類と base64 だけ */
const DATA_IMAGE_PATTERN =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]*$/;

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

/** 文書に書いた生の HTML から、記法の class・`data-*`・`id`・`role`・`aria-*` などを落とす */
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
    } else if (name === "role") {
      // 外部ライブラリの印の場所の `status` だけを残す
      if (tagName === "div" && value === "status") {
        next[name] = value;
      }
    } else if (name === "aria-label") {
      if (tagName === "pre" || tagName === "table") {
        next[name] = value;
      }
    } else if (name === "tabindex") {
      // 語の `tabindex` は mdmark が出した要素だけが持つ
      if (tagName === "pre" || tagName === "table") {
        next[name] = value;
      }
    } else if (name.startsWith("data-")) {
      const keep =
        (tagName === "td" && name === "data-label") ||
        (tagName === "div" &&
          (name === "data-mdmark-slot" || name === "data-mdmark-args"));
      if (keep) {
        next[name] = value;
      }
    } else if (
      name !== "id" &&
      name !== "hidden" &&
      name !== "colspan" &&
      !name.startsWith("aria-") &&
      // 図の部品の属性は、図の部品が出した要素だけが持つ（`input` の `type`・`disabled` は、描くときに付け直した値）
      (!DIAGRAM_ATTRIBUTE_SET.has(name) ||
        (tagName === "input" && (name === "type" || name === "disabled")))
    ) {
      next[name] = value;
    }
  }
  return next;
}

/** 図の部品の要素が持つ属性。名前は sanitize-html が読む小文字で書く（ブラウザが svg の属性の大文字を戻す）。文書に書いた要素は `dropSyntaxAttributes` が属性を絞る */
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

/** `DIAGRAM_ATTRIBUTES` の集合 */
const DIAGRAM_ATTRIBUTE_SET = new Set(DIAGRAM_ATTRIBUTES);

/** sanitize-html に渡す、描くごとに変わらない設定: 許可していない要素・属性・URL を落とす */
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
      ...DIAGRAM_ATTRIBUTES,
    ],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    pre: ["tabindex"],
    table: ["tabindex"],
    span: ["tabindex"],
  },
  // 図の部品の要素以外から取り除く要素は、印を付けた要素を中身ごと消す
  exclusiveFilter: (frame) => frame.attribs[DROP_ATTRIBUTE] !== undefined,
  // 記法の class は、mdmark が出した要素だけが持つ（生の HTML のものは `transformTags` が先に落とす）
  allowedClasses: {
    "*": ["mdmark-*", "markdown-alert*", "has-tip"],
    code: ["language-*"],
    li: ["task-list-item"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // 画像の `src` だけ、`data:` URL も許す（種類は `transformTags` が絞る）
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  // postcss を呼ばない。`style` 属性は許可せず、列の揃えだけを class に移す
  parseStyleAttributes: false,
};

/** 埋め込んだ HTML の `style` に残す宣言: 名前と、値の許可の正規表現。値に `url(`・`expression(`・単位 `vw`・`vh` を含むものは、ここに当たっても落とす */
export const EMBED_STYLES: ReadonlyArray<{ name: RegExp; value: RegExp }> =
  (() => {
    const length = String.raw`-?(?:\d+|\d*\.\d+)(?:px|rem|em|%|ch|pt|fr)?`;
    // 負の値を持たない長さ（`margin`・`padding` が使う。負の値は他の要素の上へはみ出させるため落とす）
    const unsigned = String.raw`(?:\d+|\d*\.\d+)(?:px|rem|em|%|ch|pt|fr)?`;
    const keyword = "[a-z]+(?:-[a-z]+)*";
    const color = String.raw`#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\(\s*[0-9.%\s,/-]+\)|var\(--mdmark-[a-z0-9-]+\)`;
    const fn = String.raw`(?:repeat|minmax)\([a-z0-9\s,.%-]*\)`;
    /** 空白で区切った 1 つ以上の語が、どれも `tokens` のどれかに当たる値の正規表現 */
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

/** 埋め込んだ HTML の要素の `style` から、`EMBED_STYLES` の宣言だけを残して `名前:値` を `;` でつないだ値にする。残る宣言が無ければ空の文字。postcss を使わない */
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

/** mdmark が出した要素の `style` に残す値: 図の部品の位置・大きさ・倍率はそのまま、コードブロックの行番号の桁の数だけを持つものはその宣言、それ以外は埋め込んだ HTML の許した宣言だけ */
function ownStyle(style: string): string {
  if (DIAGRAM_STYLE_PATTERN.test(style)) {
    return style;
  }
  // コードブロックの行番号の桁の数: ほかの宣言を重ねたものは、全て落とす
  if (style.includes("--mdmark-code-digits")) {
    const digits = CODE_DIGITS_PATTERN.exec(style)?.[1];
    return digits === undefined ? "" : `--mdmark-code-digits:${digits}`;
  }
  return filterEmbeddedStyle(style);
}

/** 埋め込んだ HTML の中の、図の部品の置き場所を預ける要素と、その印の属性。`sanitizeEmbedded` が残し、呼ぶ側が図の部品の HTML に戻す */
export const EMBED_PART_TAG = "mdmark-part";
export const EMBED_PART_ATTRIBUTE = "data-part";

/** 文字を `onText` に渡さない要素（用語の下線を引かない場所） */
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

/** 埋め込んだ HTML の `sanitize-html` の設定。文書に書いた生の HTML と同じ要素・URL の許可に `button` を足し、書いた人の class・`id`・`data-hint` 以外の `data-*`・`role`・`aria-*` は持たせない */
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

/** 埋め込んだ HTML の中身を落とす: `script` 要素・`on` で始まる属性・`javascript:` の URL・許していない `style` の宣言を落とし、`button` は `type="button"` で残す。`onText` は本文の文字（エスケープ済み。`a`・`code`・`pre`・`button`・見出しの中を除く）を受け、置き換える HTML を返す */
export function sanitizeEmbedded(
  html: string,
  onText: (text: string) => string,
): string {
  return sanitizeHtml(html, {
    ...EMBEDDED_OPTIONS,
    textFilter: (text, tagName) =>
      TEXT_FILTER_SKIP_TAGS.has(tagName) ? text : onText(text),
    transformTags: {
      "*": (tagName, attribs) => {
        if (tagName === "input") {
          // 入力欄は、無効のチェックボックスにし、元の属性からは `checked` だけを引き継ぐ
          const checkbox: Record<string, string> = {
            type: "checkbox",
            disabled: "",
          };
          if (attribs.checked !== undefined) {
            checkbox.checked = "";
          }
          return { tagName, attribs: checkbox };
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
        if (
          tagName === "img" &&
          next.src?.startsWith("data:") &&
          !DATA_IMAGE_PATTERN.test(next.src)
        ) {
          delete next.src;
        }
        // 図の部品の要素は、書いたものを中身ごと落とす（`button` だけは残す）
        if (DIAGRAM_ONLY_TAGS.has(tagName) && tagName !== "button") {
          next[DROP_ATTRIBUTE] = "1";
        }
        return { tagName, attribs: next };
      },
    },
  });
}

/** 許可していないものを落とした HTML を返す。`nonce` と同じ印を持つ要素は mdmark が記法から出したものとして、記法の class・`data-*`・`id` などを残す */
export function sanitize(html: string, nonce: string): string {
  return sanitizeHtml(html, {
    ...SANITIZE_OPTIONS,
    transformTags: {
      // 全ての要素: mdmark が出した要素以外から記法の属性を落とし、`text-align` の値を class に移し、`style` は常に消す
      "*": (tagName, attribs) => {
        const own = attribs[OWN_ATTRIBUTE] === nonce;
        const next = own
          ? { ...attribs }
          : dropSyntaxAttributes(tagName, attribs);
        delete next[OWN_ATTRIBUTE];
        // 画像の `data:` URL は、画像の種類と base64 の形のものだけ残す
        if (
          tagName === "img" &&
          next.src?.startsWith("data:") &&
          !DATA_IMAGE_PATTERN.test(next.src)
        ) {
          delete next.src;
        }
        const align = TEXT_ALIGN_PATTERN.exec(attribs.style ?? "")?.[1];
        if (align && ALIGN_VALUES.includes(align)) {
          next.class = [next.class, `mdmark-align-${align}`]
            .filter(Boolean)
            .join(" ");
        }
        // `style` は、mdmark が出した要素のものだけを残す: 図の部品の位置・大きさ・倍率か、埋め込んだ HTML の許した宣言
        const style = attribs.style ?? "";
        const kept = own ? ownStyle(style) : "";
        if (kept === "") {
          delete next.style;
        } else {
          next.style = kept;
        }
        // 図の部品が出した要素だけが持つ要素は、文書に書いたものを取り除く
        if (!own && DIAGRAM_ONLY_TAGS.has(tagName)) {
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
