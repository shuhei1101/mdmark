import { renderDiffBlock } from "../parts/diff-blocks.ts";
import {
  computeDiff,
  type DiffEngine,
  type DiffResult,
  jsdiffEngine,
} from "./compute.ts";
import {
  checkRevisions,
  type DiffRevision,
  type DiffSource,
} from "./source.ts";

/** ブロックの色分けのために取り出した結果。`pair` は 2 番目（前）と 1 番目（後）のリビジョンの Markdown、`single` はリビジョンが 1 つ以下、`failed` は一覧か本文を取り出せなかった */
export type DiffPair =
  | { kind: "pair"; before: string; after: string }
  | { kind: "single" }
  | { kind: "failed" };

/** 色を当てる単位。`block` は本文のブロック、`item` はリストの項目、`row` は表の行 */
type BlockUnit = "block" | "item" | "row";

/** 色分けの単位のブロック 1 つと、その元の行の範囲 */
export type BlockRange = {
  /** ブロックの要素（本文か節の中身の直下の要素、いちばん外の `li`、`tbody` の `tr`） */
  element: HTMLElement;
  /** 部品『差分のブロック』の `unit` に渡す値 */
  unit: BlockUnit;
  /** ブロックの `data-source-line`（0 始まり） */
  start: number;
  /** 次のブロックの `data-source-line` の 1 つ前。最後のブロックは文書の最後の行 */
  end: number;
};

/** 色分けの片側（前か後）の Markdown と、それを今の描き方で描いた中身 */
type Side = {
  /** 描いた中身（画面に置く前の `template` の中身） */
  root: ParentNode;
  /** 描いた Markdown */
  markdown: string;
};

/** 削除したブロックとして差し込む前の文書の要素 */
type Removal = {
  /** 差し込む前の文書の要素（節ごと消したときは見出しと節の中身） */
  elements: HTMLElement[];
  /** 部品『差分のブロック』の `unit` に渡す値 */
  unit: BlockUnit;
  /** 変えた塊の番号 */
  chunk: number;
  /** 要素の文字（書き換えの見分けに使う） */
  text: string;
};

/** 行の比較の結果を行番号で引けるようにしたもの */
type LineMap = {
  /** 前と後の行の文字 */
  texts: { before: string[]; after: string[] };
  /** 消した前の行番号 */
  deleted: Set<number>;
  /** 足した後の行番号 */
  added: Set<number>;
  /** 同じ行の、前の行番号から後の行番号 */
  same: Map<number, number>;
  /** 消した前の行番号が属する変えた塊の番号 */
  chunkBefore: Map<number, number>;
  /** 足した後の行番号が属する変えた塊の番号 */
  chunkAfter: Map<number, number>;
};

/** 節の中身 */
const SECTION_BODY = ".mdmark-section-body";

/** 表（表の記法の外側か、記法の外の表） */
const TABLE = "table, .mdmark-table";

/** 見出しの要素 */
const HEADING = /^H[1-6]$/;

/** HTML 文字列から要素を作る（`li`・`tr` も作れる） */
function parseElement(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 要素か、最初の子孫が持つ `data-source-line`（無ければ `undefined`） */
function lineOf(element: Element): number | undefined {
  const value = (
    element.hasAttribute("data-source-line")
      ? element
      : element.querySelector("[data-source-line]")
  )?.getAttribute("data-source-line");
  return value === null || value === undefined ? undefined : Number(value);
}

/** 空白だけの行か */
function isBlank(text: string | undefined): boolean {
  return (text ?? "").trim() === "";
}

/** 取り出し元の一覧を 1 回、前と後の本文を 1 回ずつ呼び、ブロックの色分けに使う 2 つの Markdown を返す。取り出せないときは `console.error` に出し、`failed` を返す */
export async function loadDiffPair(options: {
  /** `mount` に渡された取り出し元 */
  source: DiffSource;
  /** 文書の `id` */
  docId: string;
}): Promise<DiffPair> {
  const { source, docId } = options;
  let revisions: DiffRevision[];
  try {
    revisions = checkRevisions(await source.revisions(docId));
  } catch (error) {
    console.error(
      "[mdmark] 差分のリビジョンの一覧を取り出せません: revisions",
      docId,
      error,
    );
    return { kind: "failed" };
  }
  const [newest, previous] = revisions;
  if (newest === undefined || previous === undefined) {
    return { kind: "single" };
  }
  const pair = [previous, newest];
  const settled = await Promise.allSettled(
    pair.map(async (revision) =>
      source.content({ docId, revisionId: revision.id }),
    ),
  );
  const texts: string[] = [];
  let failed = false;
  settled.forEach((item, position) => {
    const revision = pair[position] as DiffRevision;
    if (item.status === "rejected" || typeof item.value !== "string") {
      failed = true;
      console.error(
        "[mdmark] 差分の本文を取り出せません: content",
        docId,
        revision.id,
        item.status === "rejected" ? item.reason : item.value,
      );
    } else {
      texts.push(item.value);
    }
  });
  if (failed) {
    return { kind: "failed" };
  }
  return {
    kind: "pair",
    before: texts[0] as string,
    after: texts[1] as string,
  };
}

/** 描いた文書の要素を色分けの単位のブロックに分け、元の行の範囲を付けて上から順に返す */
export function collectBlockRanges(options: {
  /** 描いた文書の中身 */
  root: ParentNode;
  /** その Markdown の行の数 */
  lineCount: number;
}): BlockRange[] {
  const { root, lineCount } = options;
  const entries: Omit<BlockRange, "end">[] = [];
  const walk = (parent: ParentNode): void => {
    for (const child of parent.children) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }
      if (child.matches(SECTION_BODY)) {
        walk(child);
        continue;
      }
      const start = lineOf(child);
      if (start === undefined) {
        continue;
      }
      if (child.matches("ul, ol")) {
        for (const item of child.children) {
          if (item instanceof HTMLElement && item.matches("li")) {
            entries.push({
              element: item,
              unit: "item",
              start: lineOf(item) ?? start,
            });
          }
        }
      } else if (child.matches(TABLE)) {
        entries.push({ element: child, unit: "block", start });
        for (const row of child.querySelectorAll<HTMLElement>("tbody > tr")) {
          const rowStart = lineOf(row);
          if (rowStart !== undefined) {
            entries.push({ element: row, unit: "row", start: rowStart });
          }
        }
      } else {
        entries.push({ element: child, unit: "block", start });
      }
    }
  };
  walk(root);
  return entries.map((entry, position) => ({
    ...entry,
    end: (entries[position + 1]?.start ?? lineCount) - 1,
  }));
}

/** 対の 2 つのブロックの文字を語ごとに比べ、同じ文字の数が長い方の文字の数の半分以上なら true（書き換え）を返す。どちらも空なら true */
export function isRewrite(options: {
  /** 削除の候補の文字 */
  before: string;
  /** 追加のブロックの文字 */
  after: string;
  /** 語の区切り。持たないブラウザでは `undefined` */
  segmenter: Intl.Segmenter | undefined;
  /** 比較の計算 */
  engine: DiffEngine;
}): boolean {
  const { before, after, segmenter, engine } = options;
  const longer = Math.max(before.length, after.length);
  if (longer === 0) {
    return true;
  }
  const same = engine
    .words({ before, after, segmenter })
    .filter((change) => !change.added && !change.removed)
    .reduce((total, change) => total + change.value.length, 0);
  return same * 2 >= longer;
}

/** 行の比較の結果を、行番号で引ける形にする。`same` でない行が続くところを 1 つの変えた塊にする */
function classifyLines(diff: DiffResult): LineMap {
  const map: LineMap = {
    texts: { before: [], after: [] },
    deleted: new Set(),
    added: new Set(),
    same: new Map(),
    chunkBefore: new Map(),
    chunkAfter: new Map(),
  };
  let beforeLine = 0;
  let afterLine = 0;
  let chunk = -1;
  let inChunk = false;
  for (const block of diff.blocks) {
    for (const line of block.lines) {
      const text = line.parts.map((part) => part.text).join("");
      if (line.kind === "same") {
        map.same.set(beforeLine, afterLine);
        map.texts.before[beforeLine] = text;
        map.texts.after[afterLine] = text;
        beforeLine += 1;
        afterLine += 1;
        inChunk = false;
        continue;
      }
      if (!inChunk) {
        chunk += 1;
        inChunk = true;
      }
      if (line.kind === "del") {
        map.deleted.add(beforeLine);
        map.chunkBefore.set(beforeLine, chunk);
        map.texts.before[beforeLine] = text;
        beforeLine += 1;
      } else {
        map.added.add(afterLine);
        map.chunkAfter.set(afterLine, chunk);
        map.texts.after[afterLine] = text;
        afterLine += 1;
      }
    }
  }
  return map;
}

/** 前と後の Markdown を行で比べ、後の文書を描いた中身に追加の色を当て、前の文書から削除したブロックを前の位置に差し込む。`after.root` を書き換え、`before.root` の要素を `after.root` へ複製する */
export function colorDiffBlocks(options: {
  before: Side;
  after: Side;
  /** 語の区切り。持たないブラウザでは `undefined` */
  segmenter: Intl.Segmenter | undefined;
  /** 比較の計算。既定は `jsdiffEngine` */
  engine?: DiffEngine;
}): void {
  const { before, after, segmenter, engine = jsdiffEngine } = options;
  const diff = computeDiff({
    before: before.markdown,
    after: after.markdown,
    segmenter,
    engine,
  });
  if (diff.counts.del === 0 && diff.counts.add === 0) {
    return;
  }
  const lines = classifyLines(diff);
  const beforeCount = lines.texts.before.length;
  const afterCount = lines.texts.after.length;
  const beforeRanges = collectBlockRanges({
    root: before.root,
    lineCount: beforeCount,
  });
  const afterRanges = collectBlockRanges({
    root: after.root,
    lineCount: afterCount,
  });

  /** ブロックの範囲の、空白だけでない行番号 */
  const contentLines = (
    range: BlockRange,
    side: "before" | "after",
  ): number[] => {
    const texts = lines.texts[side];
    const result: number[] = [];
    for (
      let line = range.start;
      line <= Math.min(range.end, texts.length - 1);
      line += 1
    ) {
      if (!isBlank(texts[line])) {
        result.push(line);
      }
    }
    return result;
  };
  /** 後のブロックの範囲に足した行があるか */
  const isAdded = (range: BlockRange): boolean =>
    contentLines(range, "after").some((line) => lines.added.has(line));
  /** 前のブロックの範囲の行が全て消した行か */
  const isRemoved = (range: BlockRange): boolean => {
    const content = contentLines(range, "before");
    return content.length > 0 && content.every((l) => lines.deleted.has(l));
  };
  /** ブロックが属する変えた塊の番号 */
  const chunkOf = (range: BlockRange, side: "before" | "after"): number => {
    const chunks = side === "before" ? lines.chunkBefore : lines.chunkAfter;
    const line = contentLines(range, side).find((l) => chunks.has(l));
    return line === undefined ? -1 : (chunks.get(line) ?? -1);
  };

  const beforeByElement = new Map(
    beforeRanges.map((range) => [range.element, range]),
  );
  const removals = collectRemovals({
    root: before.root,
    ranges: beforeRanges,
    byElement: beforeByElement,
    isRemoved,
    chunkOf: (range) => chunkOf(range, "before"),
  });

  // 追加のブロック: 外側のブロックが追加なら、その中の項目と行には重ねて色を当てない
  const added = afterRanges.filter(isAdded);
  const outermostAdded = added.filter(
    (range) =>
      !added.some(
        (other) => other !== range && other.element.contains(range.element),
      ),
  );

  // 同じ変えた塊の中で、削除の候補と追加のブロックを前から順に対にし、書き換えなら削除を出さない
  const dropped = new Set<Removal>();
  const chunks = new Map<number, { removals: Removal[]; adds: BlockRange[] }>();
  const chunkEntry = (chunk: number) => {
    const entry = chunks.get(chunk) ?? { removals: [], adds: [] };
    chunks.set(chunk, entry);
    return entry;
  };
  for (const removal of removals) {
    chunkEntry(removal.chunk).removals.push(removal);
  }
  for (const range of outermostAdded) {
    chunkEntry(chunkOf(range, "after")).adds.push(range);
  }
  for (const entry of chunks.values()) {
    entry.removals.forEach((removal, position) => {
      const range = entry.adds[position];
      if (
        range !== undefined &&
        isRewrite({
          before: removal.text,
          after: range.element.textContent ?? "",
          segmenter,
          engine,
        })
      ) {
        dropped.add(removal);
      }
    });
  }

  // 追加のブロックに色を当てる。本文のブロックは元の要素を包みの中へ移し（中の項目・行の範囲が指す要素を保つ）、項目と行は要素そのものに色を当てる
  for (const range of outermostAdded) {
    if (range.unit === "block") {
      const wrapper = parseElement(
        renderDiffBlock({ kind: "add", unit: "block", html: "" }),
      );
      range.element.replaceWith(wrapper);
      wrapper.append(range.element);
      range.element = wrapper;
      continue;
    }
    const colored = parseElement(
      renderDiffBlock({
        kind: "add",
        unit: range.unit,
        html: range.element.outerHTML,
      }),
    );
    range.element.replaceWith(colored);
    range.element = colored;
  }

  insertRemovals({
    removals: removals.filter((removal) => !dropped.has(removal)),
    afterRoot: after.root,
    afterRanges,
    same: lines.same,
  });
}

/** 前の文書から、削除したブロックにする要素を文書の順に集める。節ごと・リストごと・表ごと消えたときは 1 つにまとめる */
function collectRemovals(options: {
  root: ParentNode;
  ranges: BlockRange[];
  byElement: Map<Element, BlockRange>;
  isRemoved: (range: BlockRange) => boolean;
  chunkOf: (range: BlockRange) => number;
}): Removal[] {
  const { root, ranges, byElement, isRemoved, chunkOf } = options;
  const result: Removal[] = [];
  /** 要素の中のブロックが全て消えたか */
  const allRemoved = (container: Element): boolean =>
    ranges
      .filter((range) => container.contains(range.element))
      .every(isRemoved);
  const push = (
    elements: HTMLElement[],
    unit: BlockUnit,
    range: BlockRange,
  ): void => {
    result.push({
      elements,
      unit,
      chunk: chunkOf(range),
      text: elements.map((element) => element.textContent ?? "").join(""),
    });
  };
  const visit = (parent: ParentNode): void => {
    for (const child of [...parent.children]) {
      if (!(child instanceof HTMLElement) || child.matches(SECTION_BODY)) {
        continue;
      }
      const range = byElement.get(child);
      const body = child.nextElementSibling;
      if (HEADING.test(child.tagName) && body?.matches(SECTION_BODY)) {
        if (range !== undefined && isRemoved(range) && allRemoved(body)) {
          push([child, body as HTMLElement], "block", range);
        } else {
          if (range !== undefined && isRemoved(range)) {
            push([child], "block", range);
          }
          visit(body);
        }
      } else if (child.matches("ul, ol")) {
        const items = [...child.children]
          .map((item) => byElement.get(item))
          .filter((item): item is BlockRange => item !== undefined);
        const first = items[0];
        if (first !== undefined && items.every(isRemoved)) {
          push([child], "block", first);
        } else {
          for (const item of items) {
            if (isRemoved(item)) {
              push([item.element], "item", item);
            }
          }
        }
      } else if (child.matches(TABLE)) {
        const rows = ranges.filter(
          (item) => item.unit === "row" && child.contains(item.element),
        );
        if (range !== undefined && isRemoved(range) && rows.every(isRemoved)) {
          push([child], "block", range);
        } else {
          for (const row of rows) {
            if (isRemoved(row)) {
              push([row.element], "row", row);
            }
          }
        }
      } else if (range !== undefined && isRemoved(range)) {
        push([child], "block", range);
      }
    }
  };
  visit(root);
  return result;
}

/** 削除したブロックを、前の文書で直前にあった変えていないブロックの後ろに差し込む */
function insertRemovals(options: {
  removals: Removal[];
  afterRoot: ParentNode;
  afterRanges: BlockRange[];
  /** 同じ行の、前の行番号から後の行番号 */
  same: Map<number, number>;
}): void {
  const { removals, afterRoot, afterRanges, same } = options;
  /** 同じ場所へ続けて差し込むときの、最後に差し込んだ要素 */
  const lastAfter = new Map<Element, HTMLElement>();
  const lastFirst = new Map<ParentNode, HTMLElement>();

  /** 後の文書で、行を範囲に持つブロックを引く */
  const rangeAt = (line: number, unit?: BlockUnit): BlockRange | undefined =>
    afterRanges.find(
      (range) =>
        (unit === undefined || range.unit === unit) &&
        range.start <= line &&
        line <= range.end,
    );
  /** 前のブロックの開始行に対応する後のブロック */
  const counterpart = (
    element: Element,
    unit?: BlockUnit,
  ): BlockRange | undefined => {
    const line = lineOf(element);
    const mapped = line === undefined ? undefined : same.get(line);
    return mapped === undefined ? undefined : rangeAt(mapped, unit);
  };
  /** 節の中身の直下まで、要素の親をたどる */
  const topOf = (element: HTMLElement): HTMLElement => {
    let node = element;
    while (
      node.parentElement !== null &&
      !node.parentElement.matches(SECTION_BODY)
    ) {
      node = node.parentElement;
    }
    return node;
  };
  /** 見出しなら、その節の中身までを 1 つとして扱う */
  const withSection = (element: HTMLElement): HTMLElement => {
    const next = element.nextElementSibling;
    return HEADING.test(element.tagName) && next?.matches(SECTION_BODY)
      ? (next as HTMLElement)
      : element;
  };
  const insertAfter = (anchor: HTMLElement, inserted: HTMLElement): void => {
    (lastAfter.get(anchor) ?? anchor).after(inserted);
    lastAfter.set(anchor, inserted);
  };
  const insertFirst = (parent: ParentNode, inserted: HTMLElement): void => {
    const last = lastFirst.get(parent);
    if (last === undefined) {
      parent.prepend(inserted);
    } else {
      last.after(inserted);
    }
    lastFirst.set(parent, inserted);
  };

  for (const removal of removals) {
    const first = removal.elements[0] as HTMLElement;
    const inserted = parseElement(
      renderDiffBlock({
        kind: "del",
        unit: removal.unit,
        html: removal.elements.map((element) => element.outerHTML).join(""),
      }),
    );
    if (removal.unit !== "block") {
      // 項目と行: 前の文書で直前にあった項目・行の後ろ。無ければ、対応する項目・行を持つリスト・表の先頭
      let placed = false;
      for (
        let sibling = first.previousElementSibling;
        sibling !== null && !placed;
        sibling = sibling.previousElementSibling
      ) {
        const range = counterpart(sibling, removal.unit);
        if (range !== undefined) {
          insertAfter(range.element, inserted);
          placed = true;
        }
      }
      for (
        let sibling = first.nextElementSibling;
        sibling !== null && !placed;
        sibling = sibling.nextElementSibling
      ) {
        const parent = counterpart(sibling, removal.unit)?.element
          .parentElement;
        if (parent !== null && parent !== undefined) {
          insertFirst(parent, inserted);
          placed = true;
        }
      }
      continue;
    }
    // ブロック: 前の文書で同じ親の直前にあった変えていないブロックの後ろ
    let anchor: HTMLElement | undefined;
    for (
      let sibling = first.previousElementSibling;
      sibling !== null && anchor === undefined;
      sibling = sibling.previousElementSibling
    ) {
      if (sibling.matches(SECTION_BODY)) {
        continue;
      }
      const range = counterpart(sibling);
      if (range !== undefined) {
        anchor = withSection(topOf(range.element));
      }
    }
    if (anchor !== undefined) {
      insertAfter(anchor, inserted);
      continue;
    }
    // 直前に無ければ、前の文書で属していた節の中身の先頭。節に属さなければ本文の先頭
    const parent = first.parentElement;
    const heading = parent?.matches(SECTION_BODY)
      ? parent.previousElementSibling
      : null;
    const headingRange = heading === null ? undefined : counterpart(heading);
    if (heading !== null && headingRange !== undefined) {
      const top = topOf(headingRange.element);
      const body = withSection(top);
      if (body === top) {
        insertAfter(top, inserted);
      } else {
        insertFirst(body, inserted);
      }
    } else {
      insertFirst(afterRoot, inserted);
    }
  }
}
