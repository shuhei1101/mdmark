import type { StateCore, Token } from "markdown-it";
import { SLOT_MARKER } from "../../parts/own.ts";
import { renderTabs } from "../../parts/tabs.ts";
import {
  envOf,
  featureOn,
  findClose,
  markOf,
  ownBlock,
  textOf,
} from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。見出しが無ければ警告を差し込み、中身をそのまま残す */
export function buildTabs(state: StateCore): void {
  if (!featureOn(state, "tabs")) {
    return;
  }
  const env = envOf(state);
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    if (!token || mark?.name !== "tabs" || mark.closing) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const closeIndex = findClose(tokens, index, "tabs");
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    const content = tokens.slice(index + 1, end);
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark)));
    }
    const first = content.find(
      (candidate) => candidate.type === "heading_open",
    );
    if (!first) {
      out.push(
        warningBlock(state, {
          message:
            "`<!-- tabs -->` の範囲に、タブ名にする見出しがありません。タブにしたい中身ごとに見出し（`### macOS` など）を書いてください。範囲の中身はそのまま描いています。",
        }),
        ...content,
      );
      index = end;
      continue;
    }
    // 最初に出る見出しの階層で中身を区切る
    const separators = content
      .map((candidate, position) => ({ candidate, position }))
      .filter(
        ({ candidate }) =>
          candidate.type === "heading_open" &&
          candidate.tag === first.tag &&
          candidate.level === first.level,
      );
    const titles = separators.map(({ position }) =>
      textOf(content[position + 1] as Token),
    );
    const ids = new Set(
      separators.map(({ candidate }) => candidate.attrGet("id")),
    );
    // タブ名にした見出しは本文の見出しではないので、目次に載せない
    env.headings = env.headings.filter((heading) => !ids.has(heading.id));
    const html = renderTabs({
      id: "mdmark-tabs",
      titles,
      panels: titles.map(() => SLOT_MARKER),
    });
    const pieces = html.split(SLOT_MARKER);
    const firstPosition = separators[0]?.position ?? 0;
    out.push(...content.slice(0, firstPosition));
    separators.forEach(({ position }, panel) => {
      out.push(ownBlock(state, pieces[panel] ?? ""));
      const next = separators[panel + 1]?.position ?? content.length;
      // 区切りの見出しの 3 つのトークンは、タブ名になるので出さない
      out.push(...content.slice(position + 3, next));
    });
    out.push(ownBlock(state, pieces[separators.length] ?? ""));
    index = end;
  }
  state.tokens = out;
}
