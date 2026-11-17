import type { StateCore, Token } from "markdown-it";
import { DIAGRAM_META } from "../diagram/diagram.syntax.ts";
import { imageAttributesOf, imageFigureHtml } from "../media/image.syntax.ts";
import type { Mark } from "../render/marks.ts";
import { SLOT_MARKER } from "../shared/own.logic.ts";
import {
  type SyntaxWarning,
  warningBlock,
} from "../shared/syntax-warning.syntax.ts";
import { featureOn, markOf, ownBlock } from "../shared/tokens.syntax.ts";
import { renderFigure } from "./figure.part.ts";

/** 図表の `#fig-` で始まるリンク先 */
const FIGURE_HREF_PREFIX = "#fig-";

/** 図表の種類 */
type FigureKind = "image" | "table";

/** 番号を付けた図表 */
type Numbered = { kind: FigureKind; number: number };

/** `start` の開きに対応する閉じの位置を、入れ子の数を数えて返却する（無ければ -1） */
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

/** マーカーの直後の図か表の範囲 */
type FigureTarget = {
  /** 図表の種類 */
  kind: FigureKind;
  /** 範囲の最後のトークンの位置 */
  end: number;
  /** 画像の title */
  caption: string;
  /** 画像の図にする画像（`images` がオンで画像だけの段落のとき） */
  image?: Token;
  /** ギャラリーの開きのマーカー（`gallery` がオンのとき） */
  gallery?: Token;
};

/** `images` がオンで、動画でも音声でもない画像なら、画像の図にする */
function isStillImageFigure(state: StateCore, image: Token): boolean {
  const kind = imageAttributesOf(image)?.kind;
  return kind !== "video" && kind !== "audio" && featureOn(state, "images");
}

/** 画像だけの段落の範囲を読み込む。画像以外を含む段落は `undefined` */
function imageParagraphTarget(
  state: StateCore,
  start: number,
): FigureTarget | undefined {
  const children = state.tokens[start + 1]?.children ?? [];
  const image = children.find((child) => child.type === "image");
  if (!image || !children.every((child) => child.type === "image")) {
    return undefined;
  }
  return {
    kind: "image",
    end: start + 2,
    caption: String(image.attrGet("title") ?? ""),
    ...(children.length === 1 && isStillImageFigure(state, image)
      ? { image }
      : {}),
  };
}

/** 表の囲みか囲まない表の範囲を、中の表を入れ子の数で数えて、自分の開きに対応する閉じまで読み込む */
function tableTarget(tokens: Token[], start: number): FigureTarget | undefined {
  const first = tokens[start];
  const match =
    first?.meta?.role === "table-open"
      ? {
          isOpen: (token: Token) => token.meta?.role === "table-open",
          isClose: (token: Token) => token.meta?.role === "table-close",
        }
      : first?.type === "table_open"
        ? {
            isOpen: (token: Token) => token.type === "table_open",
            isClose: (token: Token) => token.type === "table_close",
          }
        : undefined;
  if (!match) {
    return undefined;
  }
  const end = matchingClose(tokens, start, match);
  return end < 0 ? undefined : { kind: "table", end, caption: "" };
}

/** マーカーの直後の図か表（画像だけの段落、ギャラリーの開きのマーカー、表の囲み、囲まない表）の範囲を読み込む */
function figureTarget(
  state: StateCore,
  start: number,
): FigureTarget | undefined {
  const first = state.tokens[start];
  if (!first) {
    return undefined;
  }
  const firstMark = markOf(first);
  if (
    firstMark?.name === "gallery" &&
    !firstMark.closing &&
    featureOn(state, "gallery")
  ) {
    return { kind: "image", end: start, caption: "", gallery: first };
  }
  // 図の部品は画像と同じ「図」の番号にする
  if (first.meta?.[DIAGRAM_META] === true) {
    return { kind: "image", end: start, caption: "" };
  }
  if (first.type === "paragraph_open") {
    return imageParagraphTarget(state, start);
  }
  return tableTarget(state.tokens, start);
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

/** 段落などの行内の `#fig-{ID}` へのリンクの文字を番号に替え、切れた参照の ID を返却する */
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

/** 番号を付けた図表の ID と、種類ごとに付けた番号の数 */
type FigureRegistry = {
  figures: Map<string, Numbered>;
  counts: Record<FigureKind, number>;
};

/** 文字の ID を持つ開きの `fig` のマーカーなら、マーカーの ID と直後の図表の範囲を返却する。文字の ID を持たない fig のマーカーは記載の警告だけを出し、図表に番号を付けない */
function figMarkTarget(
  state: StateCore,
  index: number,
): { mark: Mark; id: string; target: FigureTarget } | undefined {
  const mark = markOf(state.tokens[index]);
  if (mark?.name !== "fig" || mark.closing) {
    return undefined;
  }
  const id = mark.options.id;
  if (typeof id !== "string" || id === "") {
    return undefined;
  }
  const target = figureTarget(state, index + 1);
  return target ? { mark, id, target } : undefined;
}

/** 図表に種類ごとの番号を付け、ID を登録する。前の図表と重なった ID は登録せず、`figureId` を `undefined` にする */
function registerFigure(
  registry: FigureRegistry,
  figure: { id: string; kind: FigureKind },
): { number: number; figureId: string | undefined } {
  const { id, kind } = figure;
  registry.counts[kind] += 1;
  const number = registry.counts[kind];
  if (registry.figures.has(id)) {
    return { number, figureId: undefined };
  }
  registry.figures.set(id, { kind, number });
  return { number, figureId: id };
}

/** 図表の範囲を番号の部品で囲んだトークンを返却する。ギャラリーは番号だけを指定し、囲むのはギャラリーの処理に任せる */
function wrapFigure(
  state: StateCore,
  range: { index: number; token: Token; target: FigureTarget },
  numbered: { number: number; figureId: string | undefined },
): Token[] {
  const { index, token, target } = range;
  const { number, figureId } = numbered;
  if (target.gallery) {
    target.gallery.meta = {
      ...target.gallery.meta,
      figure: { id: figureId, number },
    };
    return [];
  }
  if (target.image) {
    return [
      ownBlock(
        state,
        imageFigureHtml(target.image, {
          ...(figureId === undefined ? {} : { id: `fig-${figureId}` }),
          label: `図 ${number}`,
        }),
        token,
      ),
    ];
  }
  const html = renderFigure({
    kind: target.kind,
    id: figureId,
    number,
    caption: target.caption,
    body: SLOT_MARKER,
  });
  const [head = "", tail = ""] = html.split(SLOT_MARKER);
  return [
    ownBlock(state, head, token),
    ...state.tokens.slice(index + 1, target.end + 1),
    ownBlock(state, tail),
  ];
}

/** 行内の `#fig-{ID}` へのリンクの文字を番号に替え、切れた参照の警告を、その行内を持つ最上位のブロックの前に差し込む */
function rewriteAllReferences(
  state: StateCore,
  tokens: Token[],
  figures: Map<string, Numbered>,
): Token[] {
  const result: Token[] = [];
  let blockStart = 0;
  for (const token of tokens) {
    if (token.nesting === 1 && token.level === 0) {
      blockStart = result.length;
    }
    if (token.type === "inline") {
      const warnings: SyntaxWarning[] = rewriteReferences(
        state,
        token,
        figures,
      ).map((id) => ({
        message: `リンク先の \`#fig-${id}\` の図表がありません。\`<!-- fig: ${id} -->\` を図か表の直前に記載するか、リンク先を修正してください。`,
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
  return result;
}

/** `figures` がオンなら、`fig` のマーカーの直後の画像の段落と表を図表の番号の部品で囲み、`#fig-{ID}` へのリンクの文字を番号に替える。切れた参照と重なった ID は警告を差し込む */
export function numberFigures(state: StateCore): void {
  if (!featureOn(state, "figures")) {
    return;
  }
  const tokens = state.tokens;
  const registry: FigureRegistry = {
    figures: new Map(),
    counts: { image: 0, table: 0 },
  };
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const found = figMarkTarget(state, index);
    if (!token || !found) {
      if (token) {
        out.push(token);
      }
      continue;
    }
    const { mark, id, target } = found;
    const numbered = registerFigure(registry, { id, kind: target.kind });
    if (numbered.figureId === undefined) {
      out.push(
        warningBlock(
          state,
          {
            mark: mark.raw,
            message: `の ID \`${id}\` は、前の図表と重なっています。別の ID にしてください。この図には番号だけを付け、ID を付けていません。`,
          },
          token,
        ),
      );
    }
    out.push(...wrapFigure(state, { index, token, target }, numbered));
    if (!target.gallery) {
      index = target.end;
    }
  }
  // 参照は、後ろで定義した図表も指せるよう、全ての図表に番号を付けた後で修正する
  state.tokens = rewriteAllReferences(state, out, registry.figures);
}
