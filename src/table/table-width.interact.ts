import { removeHiddenText } from "../shared/text.interact.ts";
import {
  type ColumnBounds,
  columnBounds,
  distributeColumnWidths,
} from "./table.logic.ts";

/** 列の幅を決めるときに測る本文の行の数の上限。表の先頭から数える */
export const MEASURE_ROWS = 200;

/** 見出しのセルに入れる、自動で決めた列の幅の変数 */
const AUTO_WIDTH_VARIABLE = "--mdmark-auto-width";

/** 表に入れる、自動で決めた列の幅の合計の変数 */
const AUTO_TABLE_WIDTH_VARIABLE = "--mdmark-auto-table-width";

/** 見出しのセルに入れる、見出しの中身が収まる外側の幅の変数（列の幅のつまみの最小幅） */
const HEAD_WIDTH_VARIABLE = "--mdmark-column-head-width";

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
  /** 見出しのセルの中身（列名とボタン）が収まる外側の幅（px。セルの余白と罫線を含む） */
  head: number;
};

/** 同じ親の要素に配置する計測用の要素のまとまり */
type ProbeGroup = {
  /** 計測用の要素を配置する要素 */
  parent: HTMLElement;
  /** 計測用の要素 */
  probes: HTMLElement[];
};

/** セルを、セルの中で幅を取らない文字を除いて改行（`br`・`li`・`p`）で行に分ける */
const linesOf = (cell: HTMLElement): string[] => {
  const clone = cell.cloneNode(true) as HTMLElement;
  removeHiddenText(clone);
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

/** セルの中に文字を折り返さずに配置して幅を測る、計測用の要素 */
const textProbe = (text: string): HTMLElement => {
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap";
  probe.textContent = text;
  return probe;
};

/** 見出しのセルの中身（列名とボタン）を折り返さずに配置して幅を測る、計測用の要素。中身が無いセルは行ごとの要素にする */
const headProbes = (cell: HTMLElement): HTMLElement[] => {
  const content = cell.querySelector<HTMLElement>(":scope > .mdmark-th");
  if (!content) {
    return linesOf(cell).map(textProbe);
  }
  const probe = content.cloneNode(true) as HTMLElement;
  removeHiddenText(probe);
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:nowrap;width:max-content";
  return [probe];
};

/** 全ての計測用の要素を配置してから幅をまとめて取得し、最後にまとめて取り除く。まとまりごとに幅（px）の並びを返却する */
const measureGroups = (groups: ProbeGroup[]): number[][] => {
  for (const { parent, probes } of groups) {
    parent.append(...probes);
  }
  const widths = groups.map(({ probes }) =>
    probes.map((probe) => probe.getBoundingClientRect().width),
  );
  for (const { probes } of groups) {
    for (const probe of probes) {
      probe.remove();
    }
  }
  return widths;
};

/** 測った幅のうち最も広いものに、余白と罫線と端数を加えて切り上げた幅（px）。幅が無ければ 0 */
const outerWidth = (widths: number[], padding: number): number =>
  widths.length === 0 ? 0 : Math.ceil(Math.max(...widths) + padding);

/** 見出しのセルの中身の幅（中身が無ければ 0）に、余白と罫線と端数を加えて切り上げた幅（px） */
const headOuterWidth = (widths: number[], padding: number): number =>
  Math.ceil(Math.max(0, ...widths) + padding);

/** 見出しのセルの中身が収まる外側の幅（px）を、全てのセルの計測用の要素をまとめて配置して測る */
const measureHeads = (heads: HTMLElement[]): number[] => {
  const paddings = heads.map((head) => paddingOf(head) + MEASURE_SLACK_PX);
  const widths = measureGroups(
    heads.map((head) => ({ parent: head, probes: headProbes(head) })),
  );
  return heads.map((_, index) =>
    headOuterWidth(widths[index] ?? [], paddings[index] ?? 0),
  );
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

/** 表示している列ごとに、最も長い行の幅と最も長い半角の単語の幅と見出しの中身が収まる幅を測って返却する */
export const measureColumns = (
  table: HTMLTableElement,
  headCells: HTMLTableCellElement[],
): ColumnMeasure[] => {
  const rows = measuredRows(table, headCells.length);
  // 計測用の要素を配置する前に、行の分け方と余白・罫線・文字の大きさを全て取得する
  const columns = headCells.flatMap((head, column) => {
    if (head.hidden) {
      return [];
    }
    const cells = rows.flatMap((row) => {
      const cell = row.cells[column];
      if (!cell) {
        return [];
      }
      const lines = linesOf(cell);
      return [
        {
          cell,
          padding: paddingOf(cell) + MEASURE_SLACK_PX,
          lines,
          words: lines.flatMap((line) => line.match(HALF_WIDTH_WORD) ?? []),
        },
      ];
    });
    return [
      {
        column,
        head,
        headPadding: paddingOf(head) + MEASURE_SLACK_PX,
        em: Number.parseFloat(getComputedStyle(head).fontSize),
        cells,
      },
    ];
  });
  const groups = columns.flatMap(({ head, cells }) => [
    { parent: head, probes: headProbes(head) },
    ...cells.flatMap(({ cell, lines, words }) => [
      { parent: cell, probes: lines.map(textProbe) },
      { parent: cell, probes: words.map(textProbe) },
    ]),
  ]);
  const widths = measureGroups(groups);
  let next = 0;
  const take = (): number[] => widths[next++] ?? [];
  return columns.map(({ column, headPadding, em, cells }) => {
    const head = headOuterWidth(take(), headPadding);
    let longest = head;
    let longestWord = 0;
    for (const { padding } of cells) {
      longest = Math.max(longest, outerWidth(take(), padding));
      longestWord = Math.max(longestWord, outerWidth(take(), padding));
    }
    return { column, longest, longestWord, em, head };
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
  // 元の列の位置ごとの、見出しの中身が収まる外側の幅（px）。列の最小の幅の下限にする
  const headMins = new Map<number, number>();
  // 元の列の位置ごとに自動で決めた幅（外側の幅。px）。つまみで変えた列は、戻したときのために前の幅を残す
  const assigned = new Map<number, number>();
  let lastWidth: number | undefined;

  /** 見出しのセルの中身が収まる外側の幅を、列の最小の幅の下限と `--mdmark-column-head-width` に入れる */
  const writeHeadWidth = (column: number, width: number): void => {
    headMins.set(column, width);
    headCells[column]?.style.setProperty(HEAD_WIDTH_VARIABLE, `${width}px`);
  };

  /** 表示している列の測った値を返却する。まだ測っていない列があれば測る */
  const shownMeasures = (): ColumnMeasure[] => {
    const shown = headCells.flatMap((head, column) =>
      head.hidden ? [] : [column],
    );
    if (shown.some((column) => !measures.has(column))) {
      for (const measure of measureColumns(table, headCells)) {
        if (!measures.has(measure.column)) {
          measures.set(measure.column, measure);
          writeHeadWidth(measure.column, measure.head);
        }
      }
    }
    return shown.flatMap((column) => {
      const measure = measures.get(column);
      return measure ? [measure] : [];
    });
  };

  /** つまみで幅を変えた列の外側の幅（px）。インラインの `width`（中身の幅）に余白と罫線を足す */
  const resizedWidth = (head: HTMLTableCellElement): number => {
    const width = Number.parseFloat(head.style.width);
    return Number.isNaN(width) ? head.offsetWidth : width + paddingOf(head);
  };

  /** 列ごとの最小の幅と望む幅を、測った値から決める */
  const boundsOf = (
    columns: ColumnMeasure[],
  ): Array<ColumnBounds & { fixed?: boolean }> =>
    columns.map(({ column, longest, longestWord, em }) => {
      const head = headCells[column];
      if (head?.classList.contains("is-resized")) {
        const width = resizedWidth(head);
        return { wraps: false, min: width, wanted: width, fixed: true };
      }
      const range = ranges.get(column);
      const bound = columnBounds({
        nowrap: head?.classList.contains("mdmark-wide") === true,
        long: long.has(column),
        ...(range ? { range } : {}),
        longest,
        longestWord,
        em,
        longColumnMin,
      });
      const headMin = headMins.get(column) ?? 0;
      return {
        ...bound,
        min: Math.max(bound.min, headMin),
        wanted: Math.max(bound.wanted, headMin),
      };
    });

  /** 表の幅を、表示している列の幅（つまみで変えた列はその幅）の合計にする */
  const writeTotal = (): void => {
    const total = headCells.reduce((sum, head, column) => {
      if (head.hidden) {
        return sum;
      }
      return (
        sum +
        (head.classList.contains("is-resized")
          ? resizedWidth(head)
          : (assigned.get(column) ?? 0))
      );
    }, 0);
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
      if (bounds[index]?.fixed) {
        head?.style.removeProperty(AUTO_WIDTH_VARIABLE);
      } else {
        assigned.set(column, width);
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
    const tableStyle = getComputedStyle(table);
    const available =
      visible -
      Number.parseFloat(tableStyle.borderLeftWidth) -
      Number.parseFloat(tableStyle.borderRightWidth) -
      columns.length;
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

  /** 測り直さず、表示している列の幅を変えずに、表の幅を表示している列の幅の合計にする。つまみで変えた列はその幅、戻した列は前に自動で決めた幅、前に幅を決めていない列は測って最小の幅にする */
  const keepWidths = (): void => {
    const fresh = shownMeasures().filter(
      ({ column }) =>
        !assigned.has(column) &&
        headCells[column]?.classList.contains("is-resized") !== true,
    );
    const bounds = boundsOf(fresh);
    fresh.forEach(({ column }, index) => {
      assigned.set(column, Math.ceil(bounds[index]?.min ?? 0));
    });
    headCells.forEach((head, column) => {
      const width = assigned.get(column);
      if (head.hidden) {
        return;
      }
      if (head.classList.contains("is-resized") || width === undefined) {
        head.style.removeProperty(AUTO_WIDTH_VARIABLE);
      } else {
        head.style.setProperty(AUTO_WIDTH_VARIABLE, `${width}px`);
      }
    });
    writeTotal();
    onApply?.();
  };

  /** 列の幅のつまみで幅を変えた後と戻した後に呼ぶ。まだ幅を決めていない表は決める */
  const refresh = (): void => {
    if (table.hasAttribute(AUTO_WIDTH_ATTRIBUTE)) {
      keepWidths();
    } else {
      apply();
    }
  };

  /** 列の表示を切り替えた後に呼ぶ。まだ幅を決めていない表は何もしない */
  const columnsChanged = (): void => {
    if (table.hasAttribute(AUTO_WIDTH_ATTRIBUTE)) {
      keepWidths();
    }
  };

  const observer = new ResizeObserver(() => {
    const width = scroller.clientWidth;
    if (width === 0 || width === lastWidth) {
      return;
    }
    apply();
  });
  observer.observe(scroller);
  // ピン止めのボタンを出した・隠したときは、見出しの中身の幅だけを測り直して決め直す
  const pinObserver = new MutationObserver((records) => {
    // 同じ値を入れ直しただけの記録（ピン止めの位置を決め直すたびに出る）では測り直さない
    const changed = records.some(
      (record) =>
        record.target instanceof Element &&
        record.target.classList.contains("mdmark-pin") &&
        record.oldValue !== record.target.getAttribute("hidden"),
    );
    if (!changed || !table.hasAttribute(AUTO_WIDTH_ATTRIBUTE)) {
      return;
    }
    const targets = [...headMins.keys()].flatMap((column) => {
      const head = headCells[column];
      return head ? [{ column, head }] : [];
    });
    const widths = measureHeads(targets.map(({ head }) => head));
    targets.forEach(({ column }, index) => {
      writeHeadWidth(column, widths[index] ?? 0);
    });
    apply();
  });
  for (const head of headCells) {
    pinObserver.observe(head, {
      subtree: true,
      attributeFilter: ["hidden"],
      attributeOldValue: true,
    });
  }
  apply();

  return {
    refresh,
    columnsChanged,
    detach: () => {
      observer.disconnect();
      pinObserver.disconnect();
      for (const head of headCells) {
        head.style.removeProperty(AUTO_WIDTH_VARIABLE);
        head.style.removeProperty(HEAD_WIDTH_VARIABLE);
      }
      table.style.removeProperty(AUTO_TABLE_WIDTH_VARIABLE);
      table.removeAttribute(AUTO_WIDTH_ATTRIBUTE);
    },
  };
};
