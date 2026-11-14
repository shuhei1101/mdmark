import type { StateCore, Token } from "markdown-it";
import { SLOT_MARKER } from "../../parts/own.ts";
import { renderTabs } from "../../parts/tabs.ts";
import type { Mark } from "../marks.ts";
import { type CollapseMode, readCollapse } from "./collapse.ts";
import { envOf, featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import { unclosedWarning, warningBlock } from "./warnings.ts";

/** タブのマーカーの設定から `group` と折り畳みの指定を読み込む */
export function readTabsOptions(mark: Mark): {
  group?: string;
  collapse: CollapseMode;
  title?: string | undefined;
} {
  const { collapse, title } = readCollapse(mark.options);
  const group =
    typeof mark.options.group === "string" ? mark.options.group : undefined;
  return {
    ...(group === undefined ? {} : { group }),
    collapse,
    ...(title === undefined ? {} : { title }),
  };
}

/** `openIndex` のタブのマーカーと同じ階層のタブの開きと閉じを数え、対応する閉じの位置（無ければ `-1`）と、範囲に別のタブの開きを持つかを返却する */
export function findTabsClose(
  tokens: Token[],
  openIndex: number,
): { close: number; nested: boolean } {
  let depth = 0;
  let nested = false;
  for (let index = openIndex + 1; index < tokens.length; index++) {
    const mark = markOf(tokens[index]);
    if (mark?.name !== "tabs") {
      continue;
    }
    if (!mark.closing) {
      depth += 1;
      nested = true;
    } else if (depth === 0) {
      return { close: index, nested };
    } else {
      depth -= 1;
    }
  }
  return { close: -1, nested };
}

/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。中身の中のタブの範囲も同じ処理でタブにする。マーカーの引数の `group` は部品へ指定し、読み込めない指定は警告を差し込む。見出しが無ければ警告を差し込み、中身をそのまま残す */
export function buildTabs(state: StateCore): void {
  if (!featureOn(state, "tabs")) {
    return;
  }
  state.tokens = buildTabsIn(state, state.tokens);
}

/** トークンの並びの中のタブの範囲をタブの部品にした並びを返却する */
function buildTabsIn(state: StateCore, tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const mark = markOf(token);
    if (mark?.name !== "tabs" || mark.closing) {
      out.push(token);
      continue;
    }
    const { close: closeIndex, nested } = findTabsClose(tokens, index);
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark), token));
    }
    if (closeIndex < 0 && nested) {
      // 閉じの足りない入れ子は、終わりまでのタブのマーカーをどれもタブにせず、見出しと中身をそのまま残す
      out.push(
        ...tokens
          .slice(index + 1)
          .filter((candidate) => markOf(candidate)?.name !== "tabs"),
      );
      break;
    }
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    // 内側のタブを先に部品にしてから、外側を区切る
    const content = buildTabsIn(state, tokens.slice(index + 1, end));
    out.push(...tabsTokens(state, { token, mark, content }));
    index = end;
  }
  return out;
}

/** タブ名は見出しの行内のトークンを HTML にしたもの（強調を残し、見出しのアンカーは入れない） */
function tabTitleOf(state: StateCore, inline: Token | undefined): string {
  if (!inline) {
    return "";
  }
  return state.md.renderer.renderInline(
    (inline.children ?? []).filter(
      (child) =>
        (child.meta as { role?: string } | null)?.role !== "heading-anchor",
    ),
    state.md.options,
    state.env,
  );
}

/** タブの範囲 1 つの中身を、最初に出る見出しの階層で区切ったタブの部品のトークン（見出しが無ければ記載の警告と中身） */
function tabsTokens(
  state: StateCore,
  range: { token: Token; mark: Mark; content: Token[] },
): Token[] {
  const { token, mark, content } = range;
  const first = content.find((candidate) => candidate.type === "heading_open");
  if (!first) {
    return [
      warningBlock(
        state,
        {
          message:
            "`<!-- tabs -->` の範囲に、タブ名にする見出しがありません。タブにしたい中身ごとに見出し（`### macOS` など）を記載してください。範囲の中身はそのまま描いています。",
        },
        token,
      ),
      ...content,
    ];
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
    tabTitleOf(state, content[position + 1]),
  );
  const env = envOf(state);
  const ids = new Set(
    separators.map(({ candidate }) => candidate.attrGet("id")),
  );
  // タブ名にした見出しは本文の見出しではないので、目次に記載しない
  env.headings = env.headings.filter((heading) => !ids.has(heading.id));
  const pieces = renderTabs({
    id: "mdmark-tabs",
    titles,
    panels: titles.map(() => SLOT_MARKER),
    ...readTabsOptions(mark),
  }).split(SLOT_MARKER);
  return tabPanelTokens(state, { token, content, separators, pieces });
}

/** 区切りの見出しの位置ごとに、タブの境目と中身を並べる（区切りの見出しの 3 つのトークンは、タブ名になるので出さない） */
function tabPanelTokens(
  state: StateCore,
  tabs: {
    token: Token;
    content: Token[];
    separators: Array<{ position: number }>;
    pieces: string[];
  },
): Token[] {
  const { token, content, separators, pieces } = tabs;
  const out = content.slice(0, separators[0]?.position ?? 0);
  separators.forEach(({ position }, panel) => {
    out.push(
      tabBoundaryBlock({
        state,
        html: pieces[panel] ?? "",
        boundary: panel === 0 ? "start" : "between",
        source: panel === 0 ? token : undefined,
      }),
    );
    const next = separators[panel + 1]?.position ?? content.length;
    out.push(...content.slice(position + 3, next));
  });
  out.push(
    tabBoundaryBlock({
      state,
      html: pieces[separators.length] ?? "",
      boundary: "end",
    }),
  );
  return out;
}
