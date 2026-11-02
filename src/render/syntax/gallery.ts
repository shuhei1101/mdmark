import type { StateCore, Token } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
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

/** `cols=` に書ける列の数の範囲と、省いたときの数 */
export const GALLERY_COLS = { min: 1, max: 6, default: 2 } as const;

/** 番号を付けたギャラリーの画像に、範囲の中の順に付ける文字 */
export const SUBFIGURE_LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** `numberFigures` が開きのマーカーに置く図の番号 */
type GalleryFigure = { id?: string | undefined; number: number };

/** ギャラリーのマーカーの `cols=` を読み、読めない指定を項目にする */
export function readGalleryOptions(mark: Mark): {
  cols: number;
  items: WarningItem[];
} {
  const items: WarningItem[] = [];
  let cols: number = GALLERY_COLS.default;
  // 書いた順に項目にするため、引数の文字を空白で区切って読む
  for (const part of (mark.rest ?? "").split(/\s+/).filter(Boolean)) {
    const equals = part.indexOf("=");
    const key = equals < 0 ? undefined : part.slice(0, equals);
    const value = part.slice(equals + 1);
    const count = Number(value);
    if (key === undefined) {
      items.push({
        label: part,
        message: "使えない指定です。使える指定は `cols=` です。",
      });
    } else if (key !== "cols") {
      items.push({
        label: part,
        message: "使えないキーです。使えるキーは `cols=` です。",
      });
    } else if (
      /^\d+$/.test(value) &&
      count >= GALLERY_COLS.min &&
      count <= GALLERY_COLS.max
    ) {
      cols = count;
    } else {
      items.push({
        label: part,
        message: `列の数は ${GALLERY_COLS.min}〜${GALLERY_COLS.max} の整数で書いてください。${GALLERY_COLS.default} 列で描いています。`,
      });
    }
  }
  return { cols, items };
}

/** 範囲の中の画像のトークンを、現れた順に集める（リンクの中の画像を含む） */
function imagesIn(tokens: Token[]): Token[] {
  return tokens.flatMap((token) =>
    (token.children ?? []).filter((child) => child.type === "image"),
  );
}

/** ギャラリーの範囲の前に置く警告を作る */
function galleryWarnings(
  mark: Mark,
  options: { items: WarningItem[]; count: number; closed: boolean },
): SyntaxWarning[] {
  const warnings: SyntaxWarning[] = [];
  const max = SUBFIGURE_LETTERS.length;
  const messages: string[] = [];
  if (options.count === 0) {
    messages.push("の範囲に画像がありません。範囲の中に画像を書いてください。");
  } else if (options.count > max) {
    messages.push(
      `の範囲の画像が ${options.count} 枚あります。画像は ${max} 枚までにしてください。${max + 1} 枚目からはサブ図の番号を付けずに描いています。`,
    );
  }
  if (options.items.length) {
    messages.push("の読めない指定を当てずに描いています。");
  }
  if (messages.length) {
    warnings.push({
      mark: mark.raw,
      message: messages.join(""),
      ...(options.items.length ? { items: options.items } : {}),
    });
  }
  if (!options.closed) {
    warnings.push(unclosedWarning(mark));
  }
  return warnings;
}

/** `gallery` がオンなら、ギャラリーのマーカーの範囲の画像を画像の図にして格子に並べ、画像以外のトークンを除く。番号を渡されていれば図表の番号で囲み、サブ図の番号を付ける */
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
    const { cols, items } = readGalleryOptions(mark);
    const figure = (token.meta as { figure?: GalleryFigure }).figure;
    for (const warning of galleryWarnings(mark, {
      items,
      count: images.length,
      closed: close >= 0,
    })) {
      out.push(warningBlock(state, warning));
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
