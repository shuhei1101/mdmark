import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import { renderTabs } from "../../parts/tabs.ts";
import type { Mark } from "../marks.ts";
import { type CollapseMode, readCollapse, titleTailItem } from "./collapse.ts";
import { envOf, featureOn, markOf, tabBoundaryBlock } from "./tokens.ts";
import {
  type SkippedArg,
  type SyntaxWarning,
  skippedArgBlocks,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

/** タブの印で読めるキー */
const GROUP_KEY = "group";

/** タブの印で読める指定を、書き方の警告の案内に並べる文 */
const USABLE_ARGS = "`group=名前`・`closed`・`open`・`title=見出し`";

/** タブの印の引数から `group` と折り畳みの指定を読む。値の無い `group=` は 1 つの書き方の警告にまとめ、知らないキーと `キー=値` の形でない指定は読み飛ばした引数にする */
export function readTabsOptions(mark: Mark): {
  group?: string;
  collapse: CollapseMode;
  title?: string | undefined;
  warning?: SyntaxWarning;
  skipped: SkippedArg[];
} {
  const {
    collapse,
    title,
    items: collapseItems,
    titleTail,
    rest,
  } = readCollapse(mark.args, mark.rest);
  const items: WarningItem[] = [...collapseItems];
  const skipped: SkippedArg[] = [];
  let group: string | undefined;
  for (const [key, value] of Object.entries(rest.keys)) {
    if (key !== GROUP_KEY) {
      skipped.push({ arg: `${key}=`, usable: USABLE_ARGS });
    } else if (value === "") {
      items.push({
        label: `${GROUP_KEY}=`,
        message: `組の名前がありません。\`${GROUP_KEY}=os\` のように名前を書いてください。組を持たないタブとして描いています`,
      });
    } else {
      group = value;
    }
  }
  // `キー=値` の形でない指定
  for (const arg of rest.args) {
    if (arg === titleTail) {
      items.push(titleTailItem(arg));
    } else {
      skipped.push({ arg, usable: USABLE_ARGS });
    }
  }
  if (items.length === 0) {
    return { group, collapse, title, skipped };
  }
  return {
    group,
    collapse,
    title,
    skipped,
    warning: {
      mark: mark.raw,
      message: "の読めない指定を当てずに描いています。",
      items,
    },
  };
}

/** `openIndex` のタブのマーカーと同じ階層のタブの開きと閉じを数え、対応する閉じの位置（無ければ `-1`）と、範囲に別のタブの開きを持つかを返す */
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

/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。中身の中のタブの範囲も同じ処理でタブにする。印の引数の `group` は部品へ渡し、読めない指定は警告を差し込む。見出しが無ければ警告を差し込み、中身をそのまま残す */
export function buildTabs(state: StateCore): void {
  if (!featureOn(state, "tabs")) {
    return;
  }
  state.tokens = buildTabsIn(state, state.tokens);
}

/** トークンの並びの中のタブの範囲をタブの部品にした並びを返す */
function buildTabsIn(state: StateCore, tokens: Token[]): Token[] {
  const env = envOf(state);
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
    const { group, collapse, title, warning, skipped } = readTabsOptions(mark);
    if (warning) {
      out.push(warningBlock(state, warning, token));
    }
    out.push(...skippedArgBlocks(state, { mark: mark.raw, skipped }, token));
    const { close: closeIndex, nested } = findTabsClose(tokens, index);
    if (closeIndex < 0) {
      out.push(warningBlock(state, unclosedWarning(mark), token));
      if (nested) {
        // 閉じの足りない入れ子は、終わりまでのタブのマーカーをどれもタブにせず、見出しと中身をそのまま残す
        out.push(
          ...tokens
            .slice(index + 1)
            .filter((candidate) => markOf(candidate)?.name !== "tabs"),
        );
        break;
      }
    }
    const end = closeIndex < 0 ? tokens.length : closeIndex;
    // 内側のタブを先に部品にしてから、外側を区切る
    const content = buildTabsIn(state, tokens.slice(index + 1, end));
    const first = content.find(
      (candidate) => candidate.type === "heading_open",
    );
    if (!first) {
      out.push(
        warningBlock(
          state,
          {
            message:
              "`<!-- tabs -->` の範囲に、タブ名にする見出しがありません。タブにしたい中身ごとに見出し（`### macOS` など）を書いてください。範囲の中身はそのまま描いています。",
          },
          token,
        ),
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
    // タブ名は見出しの行内のトークンを HTML にしたもの（強調を残す）
    const titles = separators.map(({ position }) => {
      const inline = content[position + 1];
      return inline
        ? state.md.renderer.renderInline(
            // 見出しのアンカーはタブ名に入れない
            (inline.children ?? []).filter(
              (child) =>
                (child.meta as { role?: string } | null)?.role !==
                "heading-anchor",
            ),
            state.md.options,
            state.env,
          )
        : "";
    });
    const ids = new Set(
      separators.map(({ candidate }) => candidate.attrGet("id")),
    );
    // タブ名にした見出しは本文の見出しではないので、目次に載せない
    env.headings = env.headings.filter((heading) => !ids.has(heading.id));
    const html = renderTabs({
      id: "mdmark-tabs",
      titles,
      panels: titles.map(() => SLOT_MARKER),
      group,
      collapse,
      title,
    });
    const pieces = html.split(SLOT_MARKER);
    const firstPosition = separators[0]?.position ?? 0;
    out.push(...content.slice(0, firstPosition));
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
      // 区切りの見出しの 3 つのトークンは、タブ名になるので出さない
      out.push(...content.slice(position + 3, next));
    });
    out.push(
      tabBoundaryBlock({
        state,
        html: pieces[separators.length] ?? "",
        boundary: "end",
      }),
    );
    index = end;
  }
  return out;
}
