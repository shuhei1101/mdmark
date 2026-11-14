import { NOTE_OWNER_PREFIX } from "../parts/footnote.ts";

/** 図のツールチップに出す注記 1 つ */
export type MapAnnotation = { number: number; html: string };

/** 範囲を含む描いた文書の要素（無ければ `document`） */
const scopeOf = (range: HTMLElement): ParentNode =>
  range.closest(".mdmark") ?? range.ownerDocument;

/** 範囲の `data-map-annotations` の、注記の ID から番号への対応（無ければ空） */
const numbersOf = (range: HTMLElement): Record<string, number> => {
  const raw = range.dataset.mapAnnotations;
  if (raw === undefined) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, number>)
    : {};
};

/** 注記の一覧の項目の本文を、戻るリンクを除いた行内の HTML にする（段落は `<br>` でつなぐ） */
const itemHtml = (item: Element): string => {
  const copy = item.cloneNode(true) as Element;
  for (const back of copy.querySelectorAll(".mdmark-fn-back")) back.remove();
  const paragraphs = [...copy.querySelectorAll(":scope > p")];
  if (paragraphs.length === 0) return copy.innerHTML.trim();
  return paragraphs.map((paragraph) => paragraph.innerHTML.trim()).join("<br>");
};

/** 範囲の `data-map-annotations` と補足の `notes` から、要素の ID ごとの注記（番号の順）を返却する。本文は描いた注記の一覧の項目から取得する */
export const readMapAnnotations = (options: {
  range: HTMLElement;
  notes: Record<string, { text?: string; annotations?: string[] }>;
}): Record<string, MapAnnotation[]> => {
  const { range, notes } = options;
  const numbers = numbersOf(range);
  const items = [
    ...scopeOf(range).querySelectorAll("details.mdmark-notes .mdmark-fn-item"),
  ];
  const result: Record<string, MapAnnotation[]> = {};
  for (const [element, note] of Object.entries(notes)) {
    const found = (note.annotations ?? []).flatMap((id) => {
      const number = numbers[id];
      const item = number === undefined ? undefined : items[number - 1];
      return number === undefined || item === undefined
        ? []
        : [{ number, html: itemHtml(item) }];
    });
    if (found.length > 0) {
      result[element] = found.sort((a, b) => a.number - b.number);
    }
  }
  return result;
};

/** 範囲の中の持ち主の `id` を、注記の一覧の戻るリンクの行き先に合わせる */
export const linkAnnotationOwners = (range: HTMLElement): void => {
  const scope = scopeOf(range);
  for (const owner of range.querySelectorAll<HTMLElement>(
    `[id^="${NOTE_OWNER_PREFIX}"]`,
  )) {
    const back = scope.querySelector<HTMLAnchorElement>(
      `.mdmark-notes .mdmark-fn-back[data-note-owner="${CSS.escape(owner.id)}"]`,
    );
    const href = back?.getAttribute("href") ?? "";
    if (href.startsWith("#")) owner.id = href.slice(1);
  }
};
