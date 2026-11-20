import type { ResolvedConfig } from "../config.ts";
import { attachDiagrams } from "../diagram/diagram.interact.ts";
import { renderDiagramFrame } from "../diagram/diagram.part.ts";
import {
  linkAnnotationOwners,
  type MapAnnotation,
  readMapAnnotations,
} from "./annotations.ts";
import {
  attachBand,
  type BandHandle,
  type BandStep,
  createFollow,
} from "./band.ts";
import { type MapData, noteTexts, parseMapData } from "./data.ts";
import {
  prefersReducedMotion,
  replaceTips,
  sessionStorageOf,
  termsOf,
} from "./flow-view.ts";
import { renderMapMindmap } from "./map.part.ts";
import { type Mindmap, mindmapItemOf, parseMindmap } from "./mindmap.ts";
import { layoutMindmap, type MindmapLayout } from "./mindmap-layout.ts";
import type { MapArgs } from "./spec.ts";
import {
  emptyMapState,
  type MapState,
  readMapState,
  writeMapState,
} from "./state.ts";

/** `attachMapMindmap` の戻り値 */
export type MapMindmapHandle = {
  /** 時計と操作を外す */
  destroy: () => void;
};

/** 項目の大きさ */
type Size = { width: number; height: number };

/** 補足とマーカーの引数のキーを、項目の `stateKey` にする（同じ文字の 2 つ以上の項目と無い項目は undefined） */
const stateKeyOf = (mindmap: Mindmap, key: string): string | undefined => {
  const found = mindmapItemOf({ mindmap, key });
  return found.kind === "found" ? found.item.stateKey : undefined;
};

/** キーごとの値を、`stateKey` ごとの値にする（適用しないキーは捨てる） */
const byStateKey = <T>(
  mindmap: Mindmap,
  values: Record<string, T>,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      const stateKey = stateKeyOf(mindmap, key);
      return stateKey === undefined ? [] : [[stateKey, value]];
    }),
  );

/** 補足の `layout` のうち、マインドマップに適用する色と閉じた状態 */
const layoutOf = (mindmap: Mindmap, data: MapData) => {
  const layout = byStateKey(mindmap, data.layout);
  const colors = Object.fromEntries(
    Object.entries(layout).flatMap(([key, entry]) =>
      entry.color === undefined ? [] : [[key, entry.color]],
    ),
  );
  const collapsed = Object.entries(layout).flatMap(([key, entry]) =>
    entry.collapsed === true ? [key] : [],
  );
  return { colors, collapsed };
};

/** 案内の手順（強調する項目と中へ入る項目を `stateKey` にする） */
const bandStepsOf = (mindmap: Mindmap, data: MapData): BandStep[] =>
  data.walkthroughs.map((step) => ({
    title: step.title ?? "",
    text: step.text,
    nodes: step.nodes.flatMap((key) => {
      const stateKey = stateKeyOf(mindmap, key);
      return stateKey === undefined ? [] : [stateKey];
    }),
    wires: [],
    enter:
      step.enter === undefined ? undefined : stateKeyOf(mindmap, step.enter),
  }));

/** 項目の親の `stateKey`（親が全体の根か、根なら undefined） */
const parentKeyOf = (mindmap: Mindmap, key: string): string | undefined => {
  const item = mindmap.items.find((entry) => entry.stateKey === key);
  const parent =
    item?.parent === undefined ? undefined : mindmap.items[item.parent];
  return parent === undefined || parent.order === mindmap.root?.order
    ? undefined
    : parent.stateKey;
};

/** 描いた項目の、中身から決まる大きさ（丸は幅と高さの大きいほうの正方形） */
const measureItems = (stage: HTMLElement): Map<string, Size> => {
  const sizes = new Map<string, Size>();
  for (const element of stage.querySelectorAll<HTMLElement>(
    ".map-mindmap-item",
  )) {
    const key = element.dataset.node ?? "";
    const width = element.style.width;
    const minHeight = element.style.minHeight;
    element.style.width = "";
    element.style.minHeight = "";
    const size = { width: element.offsetWidth, height: element.offsetHeight };
    element.style.width = width;
    element.style.minHeight = minHeight;
    const side = Math.max(size.width, size.height);
    sizes.set(
      key,
      element.dataset.shape === "circle" ? { width: side, height: side } : size,
    );
  }
  return sizes;
};

/** 測った大きさが配置に使った大きさと違う項目があるか（大きさの無い項目と 0 の大きさは比べない） */
const sizesChanged = (
  measured: Map<string, Size>,
  used: ReadonlyMap<string, Size>,
): boolean =>
  [...measured].some(([key, size]) => {
    const before = used.get(key);
    if (size.width === 0 || size.height === 0) return false;
    return (
      before === undefined ||
      Math.abs(before.width - size.width) > 0.5 ||
      Math.abs(before.height - size.height) > 0.5
    );
  });

/** 押したボタンか項目の押せる要素を、描き直した後に探し直すセレクタ */
const focusSelectorOf = (element: Element | null): string | undefined => {
  if (!(element instanceof HTMLElement)) return undefined;
  for (const name of ["mindmapToggle", "mindmapEnter", "tool"] as const) {
    const value = element.dataset[name];
    if (value === undefined) continue;
    const attribute = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    return `[data-${attribute}="${CSS.escape(value)}"]`;
  }
  const item = element.closest<HTMLElement>(".map-mindmap-item");
  if (!element.matches(".mdmark-diagram-node-hit") || !item) return undefined;
  return `.map-mindmap-item[data-node="${CSS.escape(item.dataset.node ?? "")}"] > .mdmark-diagram-node-hit`;
};

/** 今の図の根（無ければ全体の根）の子孫のうち、子を持つ項目の `stateKey` */
const collapsibleKeys = (
  mindmap: Mindmap,
  entered: string | undefined,
): string[] => {
  const top =
    mindmap.items.find((item) => item.stateKey === entered) ?? mindmap.root;
  const keys: string[] = [];
  const visit = (order: number) => {
    const item = mindmap.items[order];
    if (!item || item.children.length === 0) return;
    keys.push(item.stateKey);
    for (const child of item.children) visit(child);
  };
  for (const child of top?.children ?? []) visit(child);
  return keys;
};

/** 範囲の図の番号・Mermaid・補足を読む */
const readMindmapRange = (range: HTMLElement) => ({
  index: Number(range.dataset.map ?? "1"),
  mindmap: parseMindmap(range.querySelector("code")?.textContent ?? ""),
  data: parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  ).data,
});

/** 描くたびに引く、範囲から読んだ値 */
type ViewSource = {
  mindmap: Mindmap;
  colors: Record<string, string>;
  notes: Record<string, string>;
  annotations: Record<string, MapAnnotation[]>;
  frameId: string;
  terms: Record<string, string> | undefined;
  hints: boolean;
};

/** 状態の配置（色の上書きを当てる） */
const placeOf = (
  source: ViewSource,
  view: { state: MapState; sizes: ReadonlyMap<string, Size> },
): MindmapLayout => {
  const tree = layoutMindmap({
    mindmap: source.mindmap,
    top: view.state.entered,
    collapsed: new Set(view.state.collapsed),
    sizes: view.sizes,
  });
  for (const item of tree.items)
    item.color = source.colors[item.stateKey] ?? item.color;
  for (const curve of tree.curves)
    curve.color = source.colors[curve.to] ?? curve.color;
  return tree;
};

/** 部品の HTML */
const renderOf = (
  source: ViewSource,
  view: { state: MapState; tree: MindmapLayout; focus: string[] | undefined },
) =>
  renderMapMindmap({
    mindmap: source.mindmap,
    tree: view.tree,
    filled: new Set(Object.keys(source.colors)),
    collapsed: view.state.collapsed,
    entered: view.state.entered,
    selected: view.state.selected[0],
    focus: view.focus === undefined ? undefined : { nodes: view.focus },
    notes: source.notes,
    annotations: source.annotations,
    hints: source.hints,
    id: source.frameId,
    terms: source.terms,
  });

/** ツールのボタン */
const toolsOf = (state: MapState) => [
  {
    name: "back",
    label: "枝の外へ戻る",
    disabled: state.entered === undefined,
  },
  { name: "expandAll", label: "全ての枝を開く" },
  { name: "collapseAll", label: "全ての枝を閉じる" },
  {
    name: "reset",
    label: "配置と選択を元に戻す",
    disabled: state.selected.length === 0,
  },
];

/** 図の枠の表示する枠を、今の図の根の中心が中央に来るようにスクロールする */
const centerRoot = (figure: HTMLElement, tree: MindmapLayout): void => {
  const viewport = figure.querySelector<HTMLElement>(
    ".mdmark-diagram-viewport",
  );
  const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
  const root = tree.items.find((item) => item.side === "root");
  if (!viewport || !stage || !root) return;
  const scale =
    stage.getBoundingClientRect().width / (stage.offsetWidth || 1) || 1;
  viewport.scrollLeft =
    (root.x + root.width / 2) * scale - viewport.clientWidth / 2;
  viewport.scrollTop =
    (root.y + root.height / 2) * scale - viewport.clientHeight / 2;
};

/** `mindmap` を読み取って木の配置で描き、枝の開閉・中へ入る・項目の選択・案内と、状態の保存・ツールチップ・拡大と縮小を付ける */
export const attachMapMindmap = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
): MapMindmapHandle => {
  const { index, mindmap, data } = readMindmapRange(range);
  const layout = layoutOf(mindmap, data);
  const notes = byStateKey(mindmap, data.notes);
  const source: ViewSource = {
    mindmap,
    colors: layout.colors,
    notes: noteTexts(notes),
    annotations: readMapAnnotations({ range, notes }),
    frameId: `map-${index}`,
    terms: termsOf(range),
    hints: config.features.hints === true,
  };
  const storage = sessionStorageOf();
  let state: MapState = {
    ...emptyMapState(),
    ...readMapState({
      index,
      ids: new Set(mindmap.items.map((item) => item.stateKey)),
      urlState: config.map.url_state,
      focus:
        args.focus === undefined ? undefined : stateKeyOf(mindmap, args.focus),
      collapsed: layout.collapsed,
      storage,
      location,
    }),
  };
  let sizes: ReadonlyMap<string, Size> = new Map();
  let focus: string[] | undefined;
  let tree = placeOf(source, { state, sizes });
  const first = renderOf(source, { state, tree, focus });
  range.innerHTML = renderDiagramFrame(
    {
      kind: "map",
      title: args.title ?? "",
      legend: [],
      wide: true,
      exportable: true,
      fitMin: 1,
      tools: toolsOf(state),
      id: source.frameId,
    },
    {
      html: first.html,
      width: tree.width,
      height: tree.height,
      tips: first.tips,
    },
  );
  linkAnnotationOwners(range);
  const figure = range.querySelector("figure") as HTMLElement;
  const follower = createFollow(figure, prefersReducedMotion());
  const stage = figure.querySelector(".mdmark-diagram-stage") as HTMLElement;
  const sizer = figure.querySelector(".mdmark-diagram-sizer") as HTMLElement;
  const detachDiagrams = attachDiagrams({
    root: range,
    placement: config.tooltips.diagramPlacement,
    figures: [figure],
  });
  /** 今の状態で配置して描き直す（測った大きさが変われば配置し直す） */
  const draw = () => {
    tree = placeOf(source, { state, sizes });
    const part = renderOf(source, { state, tree, focus });
    stage.innerHTML = part.html;
    for (const element of [stage, sizer]) {
      element.style.width = `${tree.width}px`;
      element.style.height = `${tree.height}px`;
    }
    replaceTips(figure, part.tips);
    linkAnnotationOwners(range);
    for (const item of toolsOf(state)) {
      const button = figure.querySelector<HTMLButtonElement>(
        `[data-tool="${item.name}"]`,
      );
      if (button) button.disabled = item.disabled === true;
    }
  };
  /** 押したボタン（描き直した後にフォーカスを戻す先） */
  let pressed: Element | null = null;
  /** 描き直し、押したボタンか項目へフォーカスを戻す（消えたときは表示する枠へ移す） */
  const refresh = () => {
    const selector = focusSelectorOf(pressed ?? document.activeElement);
    pressed = null;
    draw();
    const measured = measureItems(stage);
    if (sizesChanged(measured, sizes)) {
      sizes = measured;
      draw();
    }
    if (selector === undefined) return;
    const target =
      figure.querySelector<HTMLElement>(selector) ??
      figure.querySelector<HTMLElement>(".mdmark-diagram-viewport");
    target?.focus();
  };
  const change = (next: MapState) => {
    state = next;
    writeMapState({
      index,
      state,
      urlState: config.map.url_state,
      storage,
      history,
      location,
    });
    refresh();
  };
  /** 項目を選ぶ（選んだ項目なら選択を解除する） */
  const toggleSelected = (key: string) =>
    change({ ...state, selected: state.selected[0] === key ? [] : [key] });
  /** 1 つ外へ戻る */
  const escapeEntered = () => {
    if (state.entered !== undefined)
      change({ ...state, entered: parentKeyOf(mindmap, state.entered) });
  };
  /** Esc: 選んでいれば選択を解除し、選んでいなければ 1 つ外へ戻る */
  const escapeWithKey = () => {
    if (state.selected.length > 0) change({ ...state, selected: [] });
    else escapeEntered();
  };
  /** 今の図の子を持つ全ての項目（今の図の根を除く。閉じて描いていない子孫も含む） */
  const collapsibles = () => collapsibleKeys(mindmap, state.entered);
  const runTool = (name: string | undefined) => {
    if (name === "back") escapeEntered();
    else if (name === "expandAll") change({ ...state, collapsed: [] });
    else if (name === "collapseAll")
      change({ ...state, collapsed: collapsibles() });
    else if (name === "reset") change({ ...state, selected: [] });
  };
  /** 項目を開閉する */
  const toggleCollapsed = (key: string) =>
    change({
      ...state,
      collapsed: state.collapsed.includes(key)
        ? state.collapsed.filter((item) => item !== key)
        : [...state.collapsed, key],
    });
  /** 項目の中へ入る */
  const enterItem = (key: string) =>
    change({
      ...state,
      entered: key,
      collapsed: state.collapsed.filter((item) => item !== key),
    });
  /** 持ち手とツールのボタンなら操作し、`true` を返却する */
  const clickControl = (target: Element | undefined): boolean => {
    const toggle = target?.closest<HTMLElement>("[data-mindmap-toggle]");
    if (toggle) {
      toggleCollapsed(toggle.dataset.mindmapToggle ?? "");
      return true;
    }
    const enter = target?.closest<HTMLElement>("[data-mindmap-enter]");
    if (enter) {
      enterItem(enter.dataset.mindmapEnter ?? "");
      return true;
    }
    const tool = target?.closest<HTMLButtonElement>("[data-tool]");
    if (!tool || tool.disabled) return false;
    runTool(tool.dataset.tool);
    return true;
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    pressed = target?.closest("button") ?? null;
    if (clickControl(target)) return;
    pressed = null;
    // 名前の文字は、ドラッグで文字を選んだときは選ばない
    const onName =
      target?.closest(".map-mindmap-item .mdmark-diagram-node-name") !== null &&
      target !== undefined &&
      String(getSelection() ?? "") === "";
    if (!target?.matches(".mdmark-diagram-node-hit") && !onName) return;
    const key = target.closest<HTMLElement>(".map-mindmap-item")?.dataset.node;
    if (key !== undefined) toggleSelected(key);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (event.key === "Escape") {
      escapeWithKey();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    if (!target?.matches(".mdmark-diagram-node-hit")) return;
    const key = target.closest<HTMLElement>(".map-mindmap-item")?.dataset.node;
    if (key === undefined) return;
    event.preventDefault();
    toggleSelected(key);
  };
  figure.addEventListener("click", onClick);
  figure.addEventListener("keydown", onKeyDown);

  let band: BandHandle | undefined;
  const steps = bandStepsOf(mindmap, data);
  if (steps.length > 0) {
    /** 案内を始めたときの、中へ入っていた項目 */
    let before: string | undefined;
    let walking = false;
    band = attachBand({
      figure,
      mode: "walkthrough",
      steps,
      onStep: (step) => {
        follower.resume();
        follower.reveal(step.nodes);
      },
      apply: (step) => {
        if (!walking) before = state.entered;
        walking = step !== undefined;
        focus = step?.nodes;
        state = {
          ...state,
          entered: step === undefined ? before : (step.enter ?? before),
        };
        refresh();
      },
    });
  }

  refresh();
  centerRoot(figure, tree);
  return {
    destroy: () => {
      band?.destroy();
      follower.destroy();
      detachDiagrams();
      figure.removeEventListener("click", onClick);
      figure.removeEventListener("keydown", onKeyDown);
    },
  };
};
