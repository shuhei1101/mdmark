import sanitizeHtml from "sanitize-html";

/** class `mdmark-align-{値}` に移す `text-align` の値 */
const ALIGN_VALUES = ["left", "center", "right"];

/** `style` 属性の `text-align` の値を取り出す正規表現 */
const TEXT_ALIGN_PATTERN = /(?:^|;)\s*text-align\s*:\s*([a-z]+)/;

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

/** sanitize-html に渡す設定: 許可していない要素・属性・URL を落とす */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "del",
    "details",
    "summary",
    "input",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    details: ["open"],
    input: ["type", "disabled", "checked"],
    td: ["data-label"],
    pre: ["tabindex", "aria-label"],
    table: ["tabindex", "aria-label"],
    div: [
      "data-mdmark-slot",
      "data-mdmark-args",
      { name: "role", multiple: false, values: ["status"] },
    ],
  },
  allowedClasses: {
    code: ["language-*"],
    li: ["task-list-item"],
    th: ["mdmark-align-*"],
    td: ["mdmark-align-*"],
    div: ["mdmark-embed"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // postcss を呼ばない。`style` 属性は許可せず、列の揃えだけを class に移す
  parseStyleAttributes: false,
  transformTags: {
    // 全ての要素: `text-align` の値を class に移し、`style` は常に消す
    "*": (tagName, attribs) => {
      const next = { ...attribs };
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
};

/** 許可していない要素・属性・URL を落とした HTML を返す */
export function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
