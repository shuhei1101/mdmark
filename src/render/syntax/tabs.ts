import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import { renderTabs } from "../../parts/tabs.ts";
import type { Mark } from "../marks.ts";
import {
  envOf,
  featureOn,
  findClose,
  markOf,
  ownBlock,
  textOf,
} from "./tokens.ts";
import {
  type SyntaxWarning,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

/** タブの印で読めるキー */
const GROUP_KEY = "group";

/** タブの印の引数から `group` を読む。値の無い `group=`・`group=` 以外のキー・`キー=値` の形でない指定は、1 つの書き方の警告にまとめる */
export function readTabsOptions(mark: Mark): {
  group?: string;
  warning?: SyntaxWarning;
} {
  const items: WarningItem[] = [];
  let group: string | undefined;
  for (const [key, value] of Object.entries(mark.args.keys)) {
    if (key !== GROUP_KEY) {
      items.push({
        label: `${key}=`,
        message: `使えないキーです。使えるキーは \`${GROUP_KEY}=\` です`,
      });
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
  for (const arg of mark.args.args) {
    items.push({
      label: arg,
      message: `使えない指定です。使える指定は \`${GROUP_KEY}=名前\` です`,
    });
  }
  if (items.length === 0) {
    return { group };
  }
  return {
    group,
    warning: {
      mark: mark.raw,
      message: "の読めない指定を当てずに描いています。",
      items,
    },
  };
}

/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。印の引数の `group` は部品へ渡し、読めない指定は警告を差し込む。見出しが無ければ警告を差し込み、中身をそのまま残す */
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
    const { group, warning } = readTabsOptions(mark);
    if (warning) {
      out.push(warningBlock(state, warning));
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
      group,
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
