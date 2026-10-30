import type { StateCore, Token } from "markdown-it";
import { renderFigure } from "../../parts/figure.ts";
import { SLOT_MARKER } from "../../parts/own.ts";
import { DIAGRAM_META } from "./diagrams.ts";
import { featureOn, markOf, ownBlock } from "./tokens.ts";
import { type SyntaxWarning, warningBlock } from "./warnings.ts";

/** 図表の `#fig-` で始まるリンク先 */
const FIGURE_HREF_PREFIX = "#fig-";

/** 図表の種類 */
type FigureKind = "image" | "table";

/** 番号を付けた図表 */
type Numbered = { kind: FigureKind; number: number };

/** `start` の開きに対応する閉じの位置を、入れ子の数を数えて返す（無ければ -1） */
function matchingClose(
  tokens: Token[],
  start: number,
  match: {
    isOpen: (token: Token) => boolean;
    isClose: (token: Token) => boolean;
  },
): number {
  let depth = 0;
  for (let index = start; index < tokens.length; index++) {
    const token = tokens[index] as Token;
    if (match.isOpen(token)) {
      depth += 1;
    } else if (match.isClose(token)) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

/** 印の直後の図か表（画像だけの段落、表の囲み、囲まない表）の範囲を読む */
function figureTarget(
  tokens: Token[],
  start: number,
): { kind: FigureKind; end: number; caption: string } | undefined {
  const first = tokens[start];
  // 図の部品は画像と同じ「図」の番号にする
  if (first?.meta?.[DIAGRAM_META] === true) {
    return { kind: "image", end: start, caption: "" };
  }
  if (first?.type === "paragraph_open") {
    const children = tokens[start + 1]?.children ?? [];
    const image = children.find((child) => child.type === "image");
    if (image && children.every((child) => child.type === "image")) {
      return {
        kind: "image",
        end: start + 2,
        caption: String(image.attrGet("title") ?? ""),
      };
    }
    return undefined;
  }
  // 表の範囲は、中の表を入れ子の数で数えて、自分の開きに対応する閉じまでにする
  if (first?.meta?.role === "table-open") {
    const end = matchingClose(tokens, start, {
      isOpen: (token) => token.meta?.role === "table-open",
      isClose: (token) => token.meta?.role === "table-close",
    });
    return end < 0 ? undefined : { kind: "table", end, caption: "" };
  }
  if (first?.type === "table_open") {
    const end = matchingClose(tokens, start, {
      isOpen: (token) => token.type === "table_open",
      isClose: (token) => token.type === "table_close",
    });
    return end < 0 ? undefined : { kind: "table", end, caption: "" };
  }
  return undefined;
}

/** `#fig-{ID}` のリンクの ID を取り出す */
function referencedId(value: unknown): string | undefined {
  const href = String(value ?? "");
  if (!href.startsWith(FIGURE_HREF_PREFIX)) {
    return undefined;
  }
  try {
    return decodeURIComponent(href.slice(FIGURE_HREF_PREFIX.length));
  } catch {
    return href.slice(FIGURE_HREF_PREFIX.length);
  }
}

/** 段落などの行内の `#fig-{ID}` へのリンクの文字を番号に替え、切れた参照の ID を返す */
function rewriteReferences(
  state: StateCore,
  inline: Token,
  figures: Map<string, Numbered>,
): string[] {
  const broken: string[] = [];
  const children = inline.children ?? [];
  for (let index = 0; index < children.length; index++) {
    const open = children[index];
    if (open?.type !== "link_open") {
      continue;
    }
    const id = referencedId(open.attrGet("href"));
    if (id === undefined) {
      continue;
    }
    const figure = figures.get(id);
    if (!figure) {
      broken.push(id);
      continue;
    }
    const close = children.findIndex(
      (child, position) => position > index && child.type === "link_close",
    );
    if (close < 0) {
      continue;
    }
    const text = new state.Token("text", "", 0);
    text.content = `${figure.kind === "image" ? "図" : "表"} ${figure.number}`;
    children.splice(index + 1, close - index - 1, text);
  }
  return broken;
}

/** `figures` がオンなら、`fig` の印の直後の画像の段落と表を図表の番号の部品で囲み、`#fig-{ID}` へのリンクの文字を番号に替える。切れた参照と重なった ID は警告を差し込む */
export function numberFigures(state: StateCore): void {
  if (!featureOn(state, "figures")) {
    return;
  }
  const tokens = state.tokens;
  const figures = new Map<string, Numbered>();
  const counts: Record<FigureKind, number> = { image: 0, table: 0 };
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const mark = markOf(token);
    const target =
      mark?.name === "fig" && !mark.closing
        ? figureTarget(tokens, index + 1)
        : undefined;
    if (!token || !mark || !target) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const id = mark.args.args[0] ?? "";
    counts[target.kind] += 1;
    const number = counts[target.kind];
    const duplicated = figures.has(id);
    if (duplicated) {
      out.push(
        warningBlock(state, {
          mark: mark.raw,
          message: `の ID \`${id}\` は、前の図表と重なっています。別の ID にしてください。この図には番号だけを付け、ID を付けていません。`,
        }),
      );
    } else {
      figures.set(id, { kind: target.kind, number });
    }
    const html = renderFigure({
      kind: target.kind,
      id: duplicated ? undefined : id,
      number,
      caption: target.caption,
      body: SLOT_MARKER,
    });
    const [head = "", tail = ""] = html.split(SLOT_MARKER);
    out.push(ownBlock(state, head, token));
    out.push(...tokens.slice(index + 1, target.end + 1));
    out.push(ownBlock(state, tail));
    index = target.end;
  }
  // 参照は、後ろで定義した図表も指せるよう、全ての図表に番号を付けた後で直す
  const result: Token[] = [];
  let blockStart = 0;
  for (const token of out) {
    if (token.nesting === 1 && token.level === 0) {
      blockStart = result.length;
    }
    if (token.type === "inline") {
      const warnings: SyntaxWarning[] = rewriteReferences(
        state,
        token,
        figures,
      ).map((id) => ({
        message: `リンク先の \`#fig-${id}\` の図表がありません。\`<!-- fig: ${id} -->\` を図か表の直前に書くか、リンク先を直してください。`,
      }));
      result.splice(
        blockStart,
        0,
        ...warnings.map((warning) => warningBlock(state, warning)),
      );
      blockStart += warnings.length;
    }
    result.push(token);
  }
  state.tokens = result;
}
