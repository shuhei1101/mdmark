import sanitizeHtml from "sanitize-html";

/** class `mdmark-align-{値}` に移す `text-align` の値 */
const ALIGN_VALUES = ["left", "center", "right"];

/** `style` 属性の `text-align` の値を取り出す正規表現 */
const TEXT_ALIGN_PATTERN = /(?:^|;)\s*text-align\s*:\s*([a-z]+)/;

/** mdmark が出した要素に付ける印の属性 */
const OWN_ATTRIBUTE = "data-mdmark-own";

/** 文書に書いた生の HTML が持ってよい記法の class: 列の揃えと、外部ライブラリの印の場所 */
const RAW_CLASS_PATTERN = /^(?:mdmark-align-|mdmark-embed$)/;

/** 記法の class（`mdmark-` で始まるものと `markdown-alert*`） */
const SYNTAX_CLASS_PATTERN = /^(?:mdmark-|markdown-alert)/;

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
      !name.startsWith("aria-")
    ) {
      next[name] = value;
    }
  }
  return next;
}

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
  ],
  allowedAttributes: {
    "*": ["id", "role", "aria-*", "data-*", "hidden", "colspan"],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    pre: ["tabindex"],
    table: ["tabindex"],
  },
  // 記法の class は、mdmark が出した要素だけが持つ（生の HTML のものは `transformTags` が先に落とす）
  allowedClasses: {
    "*": ["mdmark-*", "markdown-alert*"],
    code: ["language-*"],
    li: ["task-list-item"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // postcss を呼ばない。`style` 属性は許可せず、列の揃えだけを class に移す
  parseStyleAttributes: false,
};

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
        const align = TEXT_ALIGN_PATTERN.exec(attribs.style ?? "")?.[1];
        if (align && ALIGN_VALUES.includes(align)) {
          next.class = [next.class, `mdmark-align-${align}`]
            .filter(Boolean)
            .join(" ");
        }
        delete next.style;
        return { tagName, attribs: next };
      },
      // 入力欄: 常に無効のチェックボックスにし、元の属性からは `checked` だけを引き継ぐ
      input: (tagName, attribs) => {
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
