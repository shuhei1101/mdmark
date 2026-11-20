import type { MapChange } from "./data.ts";
import type { Flowchart } from "./flowchart.ts";
import { type MapListItem, renderMapList } from "./list.part.ts";
import type { Sequence } from "./sequence.ts";

/** 構成図の一覧の項目を作る元 */
type FlowListInput = {
  chart: Flowchart;
  /** 補足の notes の ID ごとの説明 */
  notes: Record<string, string>;
  /** 計画した変更（使用できる値だけ） */
  changes: Record<string, MapChange>;
  /** ノードの種類の名前（種類を持たなければ undefined） */
  kindLabel: (node: string) => string | undefined;
};

/** グループの種類の名前 */
const GROUP_KIND = "グループ";

/** 構成図の読み取った図から、グループを子を持つ項目、ノードを項目にした入れ子の一覧の項目を Mermaid の記載順で作る */
export const flowListItems = (input: FlowListInput): MapListItem[] => {
  const { chart, notes, changes, kindLabel } = input;
  const nameOf = new Map<string, string>([
    ...chart.groups.map((group) => [group.id, group.title] as const),
    ...chart.nodes.map((node) => [node.id, node.label] as const),
  ]);
  const order = new Map(chart.nodes.map((node, index) => [node.id, index]));
  const parentOf = new Map<string, string | undefined>([
    ...chart.groups.map((group) => [group.id, group.parent] as const),
    ...chart.nodes.map((node) => [node.id, node.parent] as const),
  ]);
  // グループは、中の最も先に記載したノードの位置に並べる
  const firstOf = (id: string): number => {
    const own = order.get(id);
    if (own !== undefined) return own;
    const inner = [...parentOf.entries()]
      .filter(([, parent]) => parent === id)
      .map(([child]) => firstOf(child));
    return inner.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...inner);
  };
  const outOf = (id: string): string[] =>
    chart.edges
      .filter((edge) => edge.from === id)
      .map(
        (edge) =>
          `→ ${nameOf.get(edge.to) ?? edge.to}${edge.label === undefined ? "" : `（${edge.label}）`}`,
      );
  const itemOf = (id: string): MapListItem => {
    const isGroup = chart.groups.some((group) => group.id === id);
    const children = isGroup ? childrenOf(id) : undefined;
    return {
      id,
      name: nameOf.get(id) ?? id,
      kind: isGroup ? GROUP_KIND : kindLabel(id),
      note: notes[id],
      out: outOf(id),
      change: changes[id],
      children,
    };
  };
  const childrenOf = (parent: string | undefined): MapListItem[] =>
    [...parentOf.entries()]
      .filter(([, owner]) => owner === parent)
      .map(([id]) => id)
      .sort((a, b) => firstOf(a) - firstOf(b))
      .map(itemOf);
  return childrenOf(undefined);
};

/** シーケンス図のメッセージを記載順に「{送信元} → {送信先}: {メッセージ}」の項目（ID はメッセージの番号）にする */
export const sequenceListItems = (sequence: Sequence): MapListItem[] => {
  const labelOf = new Map(
    sequence.participants.map((item) => [item.id, item.label]),
  );
  return sequence.messages.map((message, index) => ({
    id: String(index + 1),
    name: `${labelOf.get(message.from) ?? message.from} → ${labelOf.get(message.to) ?? message.to}: ${message.text}`,
    out: [],
  }));
};

/** 一覧の表示の項目と名前を作る関数 */
export type MapListSource = {
  items: () => MapListItem[];
  label: () => string;
};

/** 隠れていない項目の並び */
const visibleItems = (tree: HTMLElement): HTMLElement[] =>
  [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter(
    (item) => item.parentElement?.closest("[hidden]") === null,
  );

/** フォーカスを持つ項目を移す（`tabindex="0"` は常に 1 つ） */
const moveFocus = (tree: HTMLElement, target: HTMLElement | undefined) => {
  if (target === undefined) return;
  for (const item of tree.querySelectorAll<HTMLElement>('[role="treeitem"]'))
    item.tabIndex = item === target ? 0 : -1;
  target.focus();
};

/** 子を持つ項目を開閉する */
const setOpen = (item: HTMLElement, open: boolean) => {
  item.setAttribute("aria-expanded", String(open));
  const group = item.querySelector<HTMLElement>(':scope > [role="group"]');
  if (group !== null) group.hidden = !open;
};

/** 一覧のキー操作（↑↓・Home・End で移る、→ ← で開閉と親子へ移る） */
const onTreeKey = (tree: HTMLElement, event: KeyboardEvent) => {
  const item = (event.target as HTMLElement).closest<HTMLElement>(
    '[role="treeitem"]',
  );
  if (item === null) return;
  const items = visibleItems(tree);
  const at = items.indexOf(item);
  const expanded = item.getAttribute("aria-expanded");
  const parent = item.parentElement?.closest<HTMLElement>('[role="treeitem"]');
  const moves: Record<string, () => void> = {
    ArrowDown: () => moveFocus(tree, items[at + 1]),
    ArrowUp: () => moveFocus(tree, items[at - 1]),
    Home: () => moveFocus(tree, items[0]),
    End: () => moveFocus(tree, items[items.length - 1]),
    ArrowRight: () =>
      expanded === "false"
        ? setOpen(item, true)
        : moveFocus(tree, items[at + 1]),
    ArrowLeft: () =>
      expanded === "true"
        ? setOpen(item, false)
        : moveFocus(tree, parent ?? undefined),
  };
  const move = moves[event.key];
  if (move === undefined) return;
  if (event.key === "ArrowRight" && expanded === null) return;
  event.preventDefault();
  move();
};

/** 図の枠の一覧の表示のボタンで、表示する枠の中を図と一覧で切り替え、一覧のキー操作を付ける。片付ける関数を返却する */
export const attachMapList = (
  range: HTMLElement,
  source: MapListSource,
): (() => void) => {
  let scroll: { left: number; top: number } | undefined;
  const close = (viewport: HTMLElement, button: HTMLElement) => {
    viewport.querySelector(".mdmark-map-list")?.remove();
    const sizer = viewport.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    if (sizer !== null) sizer.hidden = false;
    if (scroll !== undefined) {
      viewport.scrollLeft = scroll.left;
      viewport.scrollTop = scroll.top;
    }
    button.setAttribute("aria-pressed", "false");
  };
  const open = (viewport: HTMLElement, button: HTMLElement) => {
    scroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
    const sizer = viewport.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    if (sizer !== null) sizer.hidden = true;
    viewport.insertAdjacentHTML(
      "beforeend",
      renderMapList({ label: source.label(), items: source.items() }),
    );
    // 一覧は先頭から見せる（図の位置は閉じるときに戻す）
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    button.setAttribute("aria-pressed", "true");
    viewport
      .querySelector<HTMLElement>('[role="treeitem"]')
      ?.focus({ preventScroll: true });
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>('[data-tool="list"]');
    const viewport = range.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    if (button !== null && viewport !== null) {
      if (button.getAttribute("aria-pressed") === "true")
        close(viewport, button);
      else open(viewport, button);
      return;
    }
    const toggle = target.closest(".mdmark-map-list-toggle");
    const item = toggle?.closest<HTMLElement>("[aria-expanded]");
    if (item) setOpen(item, item.getAttribute("aria-expanded") !== "true");
  };
  const onKey = (event: KeyboardEvent) => {
    const tree = (event.target as HTMLElement).closest<HTMLElement>(
      ".mdmark-map-list",
    );
    if (tree !== null) onTreeKey(tree, event);
  };
  range.addEventListener("click", onClick);
  range.addEventListener("keydown", onKey);
  return () => {
    range.removeEventListener("click", onClick);
    range.removeEventListener("keydown", onKey);
    range.querySelector(".mdmark-map-list")?.remove();
  };
};
