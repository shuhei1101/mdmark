import type { StateCore, Token } from "markdown-it";
import { renderFigure } from "../../parts/figure.ts";
import { renderGallery } from "../../parts/gallery.ts";
import { SLOT_MARKER, splitSlots } from "../../parts/own.ts";
import type { Mark } from "../marks.ts";
import { imageFigureHtml } from "./images.ts";
import { featureOn, findClose, markOf, ownBlock } from "./tokens.ts";
import {
  type SyntaxWarning,
  unclosedWarning,
  warningBlock,
} from "./warnings.ts";

/** `columns` に記載できる列の数の範囲と、省いたときの数 */
export const GALLERY_COLS = { min: 1, max: 6, default: 2 } as const;

/** 番号を付けたギャラリーの画像に、範囲の中の順に付ける文字 */
export const SUBFIGURE_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** `numberFigures` が開きのマーカーに配置する図の番号 */
type GalleryFigure = { id?: string | undefined; number: number };

/** ギャラリーのマーカーの設定の `columns`（マーカーの JSON Schema が列の数の範囲に照らしてある）を列の数にし、省けば既定にする */
export function readGalleryOptions(mark: Mark): { cols: number } {
  const { columns } = mark.options;
  return {
    cols: typeof columns === "number" ? columns : GALLERY_COLS.default,
  };
}

/** 範囲の中の画像のトークンを、現れた順に集める（リンクの中の画像を含む） */
function imagesIn(tokens: Token[]): Token[] {
  return tokens.flatMap((token) =>
    (token.children ?? []).filter((child) => child.type === "image"),
  );
}

/** ギャラリーの範囲の前に配置する警告を作る */
function galleryWarnings(
  mark: Mark,
  options: { count: number; closed: boolean },
): SyntaxWarning[] {
  const warnings: SyntaxWarning[] = [];
  const max = SUBFIGURE_LETTERS.length;
  const messages: string[] = [];
  if (options.count === 0) {
    messages.push(
      "の範囲に画像がありません。範囲の中に画像を記載してください。",
    );
  } else if (options.count > max) {
    messages.push(
      `の範囲の画像が ${options.count} 枚あります。画像は ${max} 枚までにしてください。${max + 1} 枚目からはサブ図の番号を付けずに描いています。`,
    );
  }
  if (messages.length) {
    warnings.push({ mark: mark.raw, message: messages.join("") });
  }
  if (!options.closed) {
    warnings.push(unclosedWarning(mark));
  }
  return warnings;
}

/** `gallery` がオンなら、ギャラリーのマーカーの範囲の画像を画像の図にして格子に並べ、画像以外のトークンを除く。番号を指定されていれば図表の番号で囲み、サブ図の番号を付ける */
export function buildGallery(state: StateCore): void {
  if (!featureOn(state, "gallery")) {
    return;
  }
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] as Token;
    const mark = markOf(token);
    if (mark?.name !== "gallery" || mark.closing) {
      out.push(token);
      continue;
    }
    const close = findClose(tokens, index, "gallery");
    const end = close < 0 ? tokens.length : close;
    const images = imagesIn(tokens.slice(index + 1, end));
    const { cols } = readGalleryOptions(mark);
    const figure = (token.meta as { figure?: GalleryFigure }).figure;
    for (const warning of galleryWarnings(mark, {
      count: images.length,
      closed: close >= 0,
    })) {
      out.push(warningBlock(state, warning, token));
    }
    const [figureHead = "", figureTail = ""] = figure
      ? splitSlots(
          renderFigure({
            kind: "image",
            ...(figure.id === undefined ? {} : { id: figure.id }),
            number: figure.number,
            body: SLOT_MARKER,
          }),
        )
      : [];
    const [galleryHead = "", galleryTail = ""] = splitSlots(
      renderGallery({ cols, body: SLOT_MARKER }),
    );
    out.push(ownBlock(state, `${figureHead}${galleryHead}`, token));
    for (const [position, image] of images.entries()) {
      const letter = figure ? SUBFIGURE_LETTERS[position] : undefined;
      out.push(
        ownBlock(
          state,
          imageFigureHtml(
            image,
            figure && letter
              ? {
                  ...(figure.id === undefined
                    ? {}
                    : { id: `fig-${figure.id}-${letter}` }),
                  label: `図 ${figure.number}${letter}`,
                }
              : {},
          ),
        ),
      );
    }
    out.push(ownBlock(state, `${galleryTail}${figureTail}`));
    index = end;
  }
  state.tokens = out;
}
