import {
  type ColumnBounds,
  columnBounds,
  distributeColumnWidths,
} from "../table-logic.ts";

/** 列の幅を決めるときに測る本文の行の数の上限。表の先頭から数える */
export const MEASURE_ROWS = 200;

/** 見出しのセルに入れる、自動で決めた列の幅の変数 */
const AUTO_WIDTH_VARIABLE = "--mdmark-auto-width";

/** 表に入れる、自動で決めた列の幅の合計の変数 */
const AUTO_TABLE_WIDTH_VARIABLE = "--mdmark-auto-table-width";

/** 自動で決めた幅を当てた表の属性 */
const AUTO_WIDTH_ATTRIBUTE = "data-auto-width";

/** 半角の英数字・記号の連なり（途中で折り返せない単語） */
const HALF_WIDTH_WORD = /[\x21-\x7e]+/g;

/** 測った幅に足す端数の幅（px） */
const MEASURE_SLACK_PX = 2;

/** 表示している列 1 つを測った結果 */
export type ColumnMeasure = {
  /** 元の列の位置 */
  column: number;
  /** 最も長い行の幅（px。セルの余白と罫線を含む） */
  longest: number;
  /** 最も長い半角の単語の幅（px。セルの余白と罫線を含む） */
  longestWord: number;
  /** 見出しのセルの文字の大きさ（px） */
  em: number;
};

/** セルを改行（`br`・`li`・`p`）で行に分ける */
const linesOf = (cell: HTMLElement): string[] => {
  const clone = cell.cloneNode(true) as HTMLElement;
  for (const br of clone.querySelectorAll("br")) {
    br.replaceWith("\n");
  }
  for (const block of clone.querySelectorAll("li, p")) {
    block.append("\n");
  }
  return (clone.textContent ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

/** セルの中に文字を折り返さずに置いたときの表示の幅（px） */
const textWidth = (cell: HTMLElement, text: string): number => {
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap";
  probe.textContent = text;
  cell.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
};

/** 見出しのセルの中身（列名とボタン）を折り返さずに置いたときの表示の幅（px） */
const headWidth = (cell: HTMLElement): number => {
  const content = cell.querySelector<HTMLElement>(":scope > .mdmark-th");
  if (!content) {
    return Math.max(0, ...linesOf(cell).map((line) => textWidth(cell, line)));
  }
  const probe = content.cloneNode(true) as HTMLElement;
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap;width:max-content";
  cell.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
};

/** セルの左右の余白と罫線の幅（px） */
const paddingOf = (cell: HTMLElement): number => {
  const style = getComputedStyle(cell);
  return (
    Number.parseFloat(style.paddingLeft) +
    Number.parseFloat(style.paddingRight) +
    Number.parseFloat(style.borderLeftWidth) +
    Number.parseFloat(style.borderRightWidth)
  );
};

/** 本文の行のうち、列と 1 対 1 の行を先頭から `MEASURE_ROWS` 行まで返却する */
const measuredRows = (
  table: HTMLTableElement,
  columnCount: number,
): HTMLTableRowElement[] =>
  [...(table.tBodies[0]?.rows ?? [])]
    .filter(
      (row) =>
        !row.classList.contains("mdmark-row-detail") &&
        !row.classList.contains("mdmark-table-empty") &&
        row.cells.length === columnCount,
    )
    .slice(0, MEASURE_ROWS);

/** 表示している列ごとに、最も長い行の幅と最も長い半角の単語の幅を測って返却する */
export const measureColumns = (
  table: HTMLTableElement,
  headCells: HTMLTableCellElement[],
): ColumnMeasure[] => {
  const rows = measuredRows(table, headCells.length);
  return headCells.flatMap((head, column) => {
    if (head.hidden) {
      return [];
    }
    const cells = [
      head,
      ...rows.flatMap((row) => {
        const cell = row.cells[column];
        return cell ? [cell] : [];
      }),
    ];
    let longest = Math.ceil(
      headWidth(head) + paddingOf(head) + MEASURE_SLACK_PX,
    );
    let longestWord = 0;
    for (const cell of cells.slice(1)) {
      const padding = paddingOf(cell) + MEASURE_SLACK_PX;
      for (const line of linesOf(cell)) {
        longest = Math.max(longest, Math.ceil(textWidth(cell, line) + padding));
        for (const word of line.match(HALF_WIDTH_WORD) ?? []) {
          longestWord = Math.max(
            longestWord,
            Math.ceil(textWidth(cell, word) + padding),
          );
        }
      }
    }
    const em = Number.parseFloat(getComputedStyle(head).fontSize);
    return [{ column, longest, longestWord, em }];
  });
};

/** 囲みの `data-width`（`{位置}:{min}-{max}` を空白で区切った並び）を列ごとの範囲にする */
const readWidthRanges = (
  value: string | undefined,
): Map<number, { min?: number; max?: number }> => {
  const ranges = new Map<number, { min?: number; max?: number }>();
  for (const item of (value ?? "").split(/\s+/).filter(Boolean)) {
    const [column, range] = item.split(":");
    const [min, max] = (range ?? "").split("-");
    ranges.set(Number(column), {
      ...(min ? { min: Number(min) } : {}),
      ...(max ? { max: Number(max) } : {}),
    });
  }
  return ranges;
};

/** 囲みの `data-long` を列の位置の集まりにする */
const readLongColumns = (value: string | undefined): Set<number> =>
  new Set(
    (value ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((item) => Number(item)),
  );

/** 列の幅を自動で決める処理の引数 */
export type AutoColumnWidthsOptions = {
  /** 表の囲み（`div.mdmark-table`） */
  wrapper: HTMLElement;
  /** 表を包む要素（`div.mdmark-table-scroll`） */
  scroller: HTMLElement;
  /** 列ごとの最下段の見出しのセル */
  headCells: HTMLTableCellElement[];
  /** 長文の列の最小の幅（em） */
  longColumnMin: number;
  /** 幅を入れた後に呼ぶ */
  onApply?: () => void;
};

/** 列の中身の幅を測って列の幅を決め、見出しのセルと表の CSS 変数に入れる */
export const attachAutoColumnWidths = (
  table: HTMLTableElement,
  options: AutoColumnWidthsOptions,
): {
  refresh: () => void;
  columnsChanged: () => void;
  detach: () => void;
} => {
  const { wrapper, scroller, headCells, longColumnMin, onApply } = options;
  const long = readLongColumns(wrapper.dataset.long);
  const ranges = readWidthRanges(wrapper.dataset.width);
  // 元の列の位置ごとの測った値。隠していて測れなかった列は、表示したときに測る
  const measures = new Map<number, ColumnMeasure>();
  // 元の列の位置ごとに入れた幅（外側の幅。px）
  const assigned = new Map<number, number>();
  let lastWidth: number | undefined;

  /** 表示している列の測った値を返却する。まだ測っていない列があれば測る */
  const shownMeasures = (): ColumnMeasure[] => {
    const shown = headCells.flatMap((head, column) =>
      head.hidden ? [] : [column],
    );
    if (shown.some((column) => !measures.has(column))) {
      for (const measure of measureColumns(table, headCells)) {
        if (!measures.has(measure.column)) {
          measures.set(measure.column, measure);
        }
      }
    }
    return shown.flatMap((column) => {
      const measure = measures.get(column);
      return measure ? [measure] : [];
    });
  };

  /** 列ごとの最小の幅と望む幅を、測った値から決める */
  const boundsOf = (
    columns: ColumnMeasure[],
  ): Array<ColumnBounds & { fixed?: boolean }> =>
    columns.map(({ column, longest, longestWord, em }) => {
      const head = headCells[column];
      if (head?.classList.contains("is-resized")) {
        const width = head.offsetWidth;
        return { wraps: false, min: width, wanted: width, fixed: true };
      }
      const range = ranges.get(column);
      return columnBounds({
        nowrap: head?.classList.contains("mdmark-wide") === true,
        long: long.has(column),
        ...(range ? { range } : {}),
        longest,
        longestWord,
        em,
        longColumnMin,
      });
    });

  /** 表の幅を、表示している列に入れた幅の合計にする */
  const writeTotal = (): void => {
    const total = headCells.reduce(
      (sum, head, column) =>
        head.hidden ? sum : sum + (assigned.get(column) ?? 0),
      0,
    );
    table.style.setProperty(AUTO_TABLE_WIDTH_VARIABLE, `${total}px`);
  };

  /** 列ごとの幅（外側の幅）を見出しのセルに入れ、表の幅を入れ直す */
  const write = (
    columns: ColumnMeasure[],
    bounds: Array<ColumnBounds & { fixed?: boolean }>,
    widths: number[],
  ): void => {
    columns.forEach(({ column }, index) => {
      const head = headCells[column];
      const width = Math.ceil(widths[index] ?? 0);
      assigned.set(column, width);
      if (bounds[index]?.fixed) {
        head?.style.removeProperty(AUTO_WIDTH_VARIABLE);
      } else {
        head?.style.setProperty(AUTO_WIDTH_VARIABLE, `${width}px`);
      }
    });
    writeTotal();
  };

  /** 表示している列を測った値で列の幅を決めて入れる。入れた幅より広く描かれた列（見出しのボタンの幅など）は、描かれた幅を最小の幅にして分け直す */
  const apply = (): void => {
    const visible = scroller.clientWidth;
    if (visible === 0) {
      return;
    }
    const columns = shownMeasures();
    const bounds = boundsOf(columns);
    const available =
      visible - (table.offsetWidth - table.clientWidth) - columns.length;
    const first = distributeColumnWidths(bounds, available);
    table.setAttribute(AUTO_WIDTH_ATTRIBUTE, "");
    write(columns, bounds, first.widths);
    let widened = false;
    const adjusted = bounds.map((bound, index) => {
      const head = headCells[columns[index]?.column ?? -1];
      const drawn = head?.offsetWidth ?? 0;
      if (bound.fixed || drawn <= Math.ceil(first.widths[index] ?? 0) + 1) {
        return bound;
      }
      widened = true;
      return {
        ...bound,
        min: Math.max(bound.min, drawn),
        wanted: Math.max(bound.wanted, drawn),
      };
    });
    if (widened) {
      write(
        columns,
        adjusted,
        distributeColumnWidths(adjusted, available).widths,
      );
    }
    lastWidth = visible;
    onApply?.();
  };

  /** 列の表示を切り替えた後に、表示している列の幅を変えずに表の幅を入れ直す。前に幅を入れていない列は、測って最小の幅を入れる */
  const columnsChanged = (): void => {
    if (!table.hasAttribute(AUTO_WIDTH_ATTRIBUTE)) {
      return;
    }
    const fresh = shownMeasures().filter(({ column }) => !assigned.has(column));
    if (fresh.length > 0) {
      const bounds = boundsOf(fresh);
      write(
        fresh,
        bounds,
        bounds.map((bound) => bound.min),
      );
    } else {
      writeTotal();
    }
    onApply?.();
  };

  const observer = new ResizeObserver(() => {
    const width = scroller.clientWidth;
    if (width === 0 || width === lastWidth) {
      return;
    }
    apply();
  });
  observer.observe(scroller);
  apply();

  return {
    refresh: apply,
    columnsChanged,
    detach: () => {
      observer.disconnect();
      for (const head of headCells) {
        head.style.removeProperty(AUTO_WIDTH_VARIABLE);
      }
      table.style.removeProperty(AUTO_TABLE_WIDTH_VARIABLE);
      table.removeAttribute(AUTO_WIDTH_ATTRIBUTE);
    },
  };
};
