import type { StateCore, Token } from "markdown-it";
import { SLOT_MARKER } from "../../parts/own.ts";
import { renderSection } from "../../parts/section.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { warningBlock } from "./warnings.ts";

/** 見出しの中身の差し込み口 */
const TITLE_MARKER = "\u0000mdmark-title\u0000";

/** 節の開閉の指定 */
const SECTION_STATES = ["closed", "open"];

/** `sections` がオンなら、h2〜h4 の見出しの後ろから次の同じか上の階層の見出しの前までを節の中身の要素で囲む */
export function wrapSections(state: StateCore): void {
  if (!featureOn(state, "sections")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  // 開いている節の見出しの階層
  const levels: number[] = [];
  /** 節の中身の閉じ */
  const closeBody = (): void => {
    levels.pop();
    out.push(ownBlock(state, "</div>"));
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token?.type !== "heading_open" || token.level !== 0) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const level = Number(token.tag.slice(1));
    while (levels.length && (levels[levels.length - 1] ?? 0) >= level) {
      closeBody();
    }
    const inline = tokens[index + 1];
    const mark = markOf(tokens[index + 3]);
    if (level < 2 || level > 4 || !inline) {
      out.push(token);
      continue;
    }
    // 見出しの直後の `section` の印で開閉を決める。知らない値は警告を差し込んで開く
    const section = mark?.name === "section" ? mark : undefined;
    const value = section?.args.args[0];
    const known = value === undefined || SECTION_STATES.includes(value);
    const html = renderSection({
      level: level as 2 | 3 | 4,
      id: String(token.attrGet("id") ?? ""),
      title: TITLE_MARKER,
      open: value !== "closed",
      toggle: false,
      anchor: false,
      body: SLOT_MARKER,
    });
    const [head = "", rest = ""] = html.split(TITLE_MARKER);
    const [body = ""] = rest.split(SLOT_MARKER);
    out.push(ownBlock(state, head, token), inline, ownBlock(state, body));
    if (section && !known) {
      out.push(
        warningBlock(state, {
          mark: section.raw,
          message: `の \`${value}\` は使えません。使える値は \`closed\`・\`open\` です。この節は開いた状態で描いています。`,
        }),
      );
    }
    levels.push(level);
    // 見出しの 3 つのトークンと、使った印を飛ばす
    index += section ? 3 : 2;
  }
  while (levels.length) {
    closeBody();
  }
  state.tokens = out;
}
