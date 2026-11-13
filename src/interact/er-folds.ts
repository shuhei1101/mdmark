import type {
  MdmarkErCardinality,
  MdmarkErRelation,
  MdmarkErTable,
} from "../diagram/definition.ts";
import { ER_METRICS, erRelationRoute, erTableHeight } from "../diagram/er.ts";
import { erEndSvg, erFoldIcon } from "../parts/er.ts";
import {
  type PartStates,
  partKey,
  recordOpen,
  startOpen,
} from "./part-states.ts";

/** テーブルの開閉のボタン */
function foldButton(table: HTMLElement): HTMLButtonElement | null {
  return table.querySelector<HTMLButtonElement>(
    "button.mdmark-diagram-er-fold",
  );
}

/** テーブルを今畳んでいるか（開閉のボタンが無いテーブルは畳まない） */
function isFolded(table: HTMLElement): boolean {
  return foldButton(table)?.getAttribute("aria-expanded") === "false";
}

/** 列の行が主キーか外部キーの列か */
function isKeyRow(row: HTMLElement): boolean {
  return row.querySelector('[data-key="pk"], [data-key="fk"]') !== null;
}

/** 属性 `hidden` を、描いたときと同じ値で付与・解除する */
function setHidden(element: HTMLElement, hidden: boolean): void {
  if (hidden) {
    element.setAttribute("hidden", "hidden");
  } else {
    element.removeAttribute("hidden");
  }
}

/** 描いたテーブルの位置と大きさ・列の並びから、経路を求めるテーブルの定義を作る */
function tableFromElement(element: HTMLElement): MdmarkErTable {
  const columns = [
    ...element.querySelectorAll<HTMLElement>(".mdmark-diagram-er-column"),
  ].map((row) => ({
    name: row.dataset.column ?? "",
    type: "",
    pk: row.querySelector('[data-key="pk"]') !== null,
    fk: row.querySelector('[data-key="fk"]') !== null,
  }));
  return {
    id: element.dataset.node ?? "",
    name: "",
    label: "",
    x: Number.parseFloat(element.style.left),
    y: Number.parseFloat(element.style.top),
    w: Number.parseFloat(element.style.width),
    columns,
  };
}

/** 関係の `g` の属性から関係の定義を作る */
function relationFromElement(group: SVGGElement): MdmarkErRelation {
  const data = group.dataset;
  const midX = data.erMidX === undefined ? undefined : Number(data.erMidX);
  return {
    from: data.erFrom ?? "",
    fromColumn: data.erFromColumn ?? "",
    fromCard: (data.erFromCard ?? "1") as MdmarkErCardinality,
    to: data.erTo ?? "",
    toColumn: data.erToColumn ?? "",
    toCard: (data.erToCard ?? "1") as MdmarkErCardinality,
    ...(midX === undefined ? {} : { midX }),
  };
}

/** 値が変わったときだけ `style` の位置を書き換える（変わらないときは描いた文字のまま残す） */
function setPx(
  element: HTMLElement,
  name: "left" | "top" | "height",
  value: number,
): void {
  if (Number.parseFloat(element.style[name]) !== value) {
    element.style[name] = `${value}px`;
  }
}

/** 図の関係の線・両端の記号・ラベルを、今の列の行の位置へもう一度結び、図の高さをもう一度求める */
function relayout(figure: HTMLElement): void {
  const elements = [
    ...figure.querySelectorAll<HTMLElement>(".mdmark-diagram-er-table"),
  ];
  const tables = new Map(
    elements.map((element) => [
      element.dataset.node ?? "",
      tableFromElement(element),
    ]),
  );
  const folded = new Map(
    elements.map((element) => [element.dataset.node ?? "", isFolded(element)]),
  );
  const isTableFolded = (id: string): boolean => folded.get(id) === true;
  for (const group of figure.querySelectorAll<SVGGElement>(
    "g[data-er-relation]",
  )) {
    const relation = relationFromElement(group);
    const from = tables.get(relation.from);
    const to = tables.get(relation.to);
    if (!from || !to) {
      continue;
    }
    const route = erRelationRoute({
      relation,
      from,
      to,
      folded: isTableFolded,
    });
    group.querySelector("path")?.setAttribute("d", route.d);
    const ends = group.querySelector(".mdmark-diagram-er-ends");
    const svg =
      erEndSvg({ ...route.start, card: relation.fromCard }) +
      erEndSvg({ ...route.end, card: relation.toCard });
    if (ends && ends.innerHTML !== svg) {
      ends.innerHTML = svg;
    }
    const label = figure.querySelector<HTMLElement>(
      `.mdmark-diagram-label[data-er-relation="${group.dataset.erRelation ?? ""}"]`,
    );
    if (label) {
      setPx(label, "left", route.label.x);
      setPx(label, "top", route.label.y);
    }
  }
  // 図の高さ: テーブルの下端の最大に下の余白を加算する。倍率を掛けた大きさのノードも同じ割合で合わせる
  const height =
    Math.max(
      0,
      ...[...tables.values()].map(
        (table) =>
          table.y + erTableHeight({ table, folded: isTableFolded(table.id) }),
      ),
    ) + ER_METRICS.bottom;
  const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const sizer = figure.querySelector<HTMLElement>(".mdmark-diagram-sizer");
  const wires = figure.querySelector<SVGSVGElement>(".mdmark-diagram-wires");
  if (!stage || Number.parseFloat(stage.style.height) === height) {
    return;
  }
  const ratio = sizer
    ? Number.parseFloat(sizer.style.height) /
      Number.parseFloat(stage.style.height)
    : 1;
  setPx(stage, "height", height);
  if (sizer) {
    setPx(sizer, "height", height * ratio);
  }
  wires?.setAttribute("height", String(height));
}

/** ER 図のテーブルの列を畳む・開く: 主キーと外部キー以外の列の行・非表示の行・開閉のボタンを切り替え、関係の線をもう一度結ぶ */
export function setErTableFolded(options: {
  table: HTMLElement;
  folded: boolean;
}): void {
  const { table, folded } = options;
  const button = foldButton(table);
  if (!button) {
    return;
  }
  for (const row of table.querySelectorAll<HTMLElement>(
    ".mdmark-diagram-er-column",
  )) {
    if (!isKeyRow(row)) {
      setHidden(row, folded);
    }
  }
  const rest = table.querySelector<HTMLElement>(".mdmark-diagram-er-rest");
  if (rest) {
    setHidden(rest, !folded);
  }
  button.setAttribute("aria-expanded", folded ? "false" : "true");
  button.innerHTML = erFoldIcon(folded);
  const figure = table.closest<HTMLElement>("figure.mdmark-diagram");
  if (figure) {
    relayout(figure);
  }
}

/** ER 図の開閉のボタンを押したら（Enter・Space を含む）列を畳む・開く。フォーカスはボタンに残す。付けた受け取りを解除する関数を返却する */
export function attachErFolds(
  figure: HTMLElement,
  states?: PartStates,
): () => void {
  const controller = new AbortController();
  const root =
    figure.parentElement?.closest<HTMLElement>(".mdmark") ??
    figure.ownerDocument.body;
  /** テーブルの記録の鍵と、付けたときのマーカー（定義の `folded` の有無） */
  const entries = new Map<HTMLElement, { key: string; marker: string }>();
  if (states !== undefined) {
    for (const table of figure.querySelectorAll<HTMLElement>(
      ".mdmark-diagram-er-table",
    )) {
      if (!foldButton(table)) {
        continue;
      }
      const marker = isFolded(table) ? "folded" : "";
      const key = partKey({
        root,
        part: figure,
        kind: "er",
        inner: table.dataset.node ?? "",
      });
      entries.set(table, { key, marker });
      const open = startOpen({
        states,
        key,
        marker,
        markerOpen: marker === "",
      });
      if (open === isFolded(table)) {
        setErTableFolded({ table, folded: !open });
      }
    }
  }
  figure.addEventListener(
    "click",
    (event) => {
      const button = (
        event.target as Element | null
      )?.closest<HTMLButtonElement>("button.mdmark-diagram-er-fold");
      const table = button?.closest<HTMLElement>(".mdmark-diagram-er-table");
      if (!button || !table || !figure.contains(button)) {
        return;
      }
      setErTableFolded({ table, folded: !isFolded(table) });
      const entry = entries.get(table);
      if (entry) {
        recordOpen({ states, open: !isFolded(table), ...entry });
      }
      button.focus();
    },
    { signal: controller.signal },
  );
  return () => controller.abort();
}
