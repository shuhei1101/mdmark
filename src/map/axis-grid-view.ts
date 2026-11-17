import type { ResolvedConfig } from "../config.ts";
import { attachDiagrams } from "../interact/diagrams.ts";
import { mermaidKindName } from "../mermaid-source.ts";
import { renderDiagramFrame } from "../parts/diagram.ts";
import {
  type MapBandUnit,
  renderMapAxisGrid,
  renderMapAxisGridLegend,
} from "../parts/map.ts";
import { linkAnnotationOwners, readMapAnnotations } from "./annotations.ts";
import {
  type AxisGrid,
  type AxisGridItem,
  type AxisGridKind,
  type AxisGridSelection,
  axisGridItemOf,
  parseAxisGrid,
} from "./axis-grid.ts";
import { type AxisGridLayout, layoutAxisGrid } from "./axis-grid-layout.ts";
import { attachBand, type BandHandle, type BandStep } from "./band.ts";
import { type MapData, noteTexts, parseMapData } from "./data.ts";
import {
  prefersReducedMotion,
  replaceTips,
  sessionStorageOf,
  termsOf,
} from "./flow-view.ts";
import type { MapArgs } from "./spec.ts";
import {
  emptyMapState,
  type MapState,
  readMapState,
  writeMapState,
} from "./state.ts";

/** `attachMapAxisGrid` の戻り値 */
export type MapAxisGridHandle = {
  /** 時計と操作を外す */
  destroy: () => void;
};

/** 再生で進める単位（ブロック図は再生しない） */
const PLAYBACK_UNITS: Partial<Record<AxisGridKind, MapBandUnit>> = {
  gantt: "task",
  timeline: "period",
  gitGraph: "commit",
  journey: "task",
};

/** 補足とマーカーの引数のキーを、項目か section の `stateKey` にする（同じ文字の 2 つ以上・ブランチ・無いキーは undefined） */
const stateKeyOf = (grid: AxisGrid, key: string): string | undefined => {
  const found = axisGridItemOf({ grid, key });
  if (found.kind === "item") return found.item.stateKey;
  if (found.kind === "section") return found.section.stateKey;
  return undefined;
};

/** キーごとの値を、`stateKey` ごとの値にする（適用しないキーは捨てる） */
const byStateKey = <T>(
  grid: AxisGrid,
  values: Record<string, T>,
): Record<string, T> =>
  Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      const stateKey = stateKeyOf(grid, key);
      return stateKey === undefined ? [] : [[stateKey, value]];
    }),
  );

/** `YYYY-MM-DD` を `MM/DD` にする */
const monthDay = (text: string): string =>
  `${text.slice(5, 7)}/${text.slice(8, 10)}`;

/** ガントチャートのタスクの開始日と、含む最後の日 */
const ganttDates = (item: AxisGridItem): string => {
  if (item.detail.kind !== "gantt") return "";
  const end = new Date(`${item.detail.end}T00:00:00Z`);
  const last = new Date(Math.max(end.getTime() - 86_400_000, 0));
  const lastText =
    item.detail.end === item.detail.start
      ? item.detail.start
      : last.toISOString().slice(0, 10);
  return `${monthDay(item.detail.start)} 〜 ${monthDay(lastText)}`;
};

/** 説明の後ろに足す、種類ごとの値（ガントチャートは開始日と終了日、ジャーニーは点数） */
const noteSuffix = (item: AxisGridItem): string => {
  if (item.detail.kind === "gantt") return ganttDates(item);
  if (item.detail.kind === "journey") return `点数 ${item.detail.score}`;
  return "";
};

/** 項目の説明（説明を持つ項目だけ。種類ごとの値を後ろに足す） */
const notesOf = (grid: AxisGrid, data: MapData): Record<string, string> => {
  const texts = noteTexts(byStateKey(grid, data.notes));
  return Object.fromEntries(
    Object.entries(texts).map(([key, text]) => {
      const item = grid.items.find((entry) => entry.stateKey === key);
      const suffix = item === undefined ? "" : noteSuffix(item);
      return [key, suffix === "" ? text : `${text}\n${suffix}`];
    }),
  );
};

/** 補足の `layout` のうち、適用する色と閉じた状態 */
const layoutOf = (grid: AxisGrid, data: MapData) => {
  const layout = byStateKey(grid, data.layout);
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

/** 状態の `selected` の 1 件目（`{kind}:{key}`）を、選んだものにする */
const selectionOf = (state: MapState): AxisGridSelection | undefined => {
  const [first] = state.selected;
  const match = /^(item|branch|actor):(.*)$/s.exec(first ?? "");
  if (!match) return undefined;
  return {
    kind: match[1] as AxisGridSelection["kind"],
    key: match[2] ?? "",
  };
};

/** 状態に保つ選択の文字 */
const selectionText = (selection: AxisGridSelection): string =>
  `${selection.kind}:${selection.key}`;

/** 状態に保てるキー（項目・section・選択の文字） */
const knownIds = (grid: AxisGrid): Set<string> =>
  new Set([
    ...grid.items.map((item) => item.stateKey),
    ...grid.sections.map((section) => section.stateKey),
    ...grid.items.map((item) => `item:${item.stateKey}`),
    ...grid.branches.map((branch) => `branch:${branch}`),
    ...grid.actors.map((actor) => `actor:${actor}`),
  ]);

/** 再生の手順の並び（ガントチャートは開始日の順、ほかは記載順） */
const playbackItems = (grid: AxisGrid): AxisGridItem[] => {
  if (grid.kind === "gantt")
    return [...grid.items].sort((a, b) => {
      const start = (item: AxisGridItem) =>
        item.detail.kind === "gantt" ? item.detail.start : "";
      return start(a).localeCompare(start(b)) || a.order - b.order;
    });
  if (grid.kind === "timeline")
    return grid.items.filter((item) => item.shape === "period");
  return grid.items;
};

/** 再生の手順 1 つのタイトルと説明の文 */
const playbackStep = (
  grid: AxisGrid,
  item: AxisGridItem,
): { title: string; text: string } => {
  const detail = item.detail;
  if (detail.kind === "gitGraph")
    return { title: `${detail.branch} · ${item.key}`, text: item.label };
  if (detail.kind === "journey")
    return {
      title: item.label,
      text: `点数 ${detail.score}・${detail.actors.join("、")}`,
    };
  if (detail.kind === "gantt")
    return { title: item.label, text: ganttDates(item) };
  const events = grid.items.filter((entry) => entry.parent === item.order);
  return {
    title: item.label,
    text: events.map((entry) => entry.label).join("・"),
  };
};

/** 補足の `walkthroughs` があれば案内の手順、無ければ時系列の図の再生の手順 */
const bandStepsOf = (
  grid: AxisGrid,
  data: MapData,
  notes: Record<string, string>,
): { mode: "walkthrough" | "playback"; steps: BandStep[] } => {
  if (data.walkthroughs.length > 0)
    return {
      mode: "walkthrough",
      steps: data.walkthroughs.map((step) => ({
        title: step.title ?? "",
        text: step.text,
        nodes: step.nodes.flatMap((key) => {
          const stateKey = stateKeyOf(grid, key);
          return stateKey === undefined ? [] : [stateKey];
        }),
        wires: [],
        enter:
          step.enter === undefined ? undefined : stateKeyOf(grid, step.enter),
      })),
    };
  if (PLAYBACK_UNITS[grid.kind] === undefined)
    return { mode: "playback", steps: [] };
  return {
    mode: "playback",
    steps: playbackItems(grid).map((item) => {
      const step = playbackStep(grid, item);
      const note = notes[item.stateKey];
      const text = [step.text, note]
        .filter((part) => part !== undefined && part !== "")
        .join("\n");
      return {
        title: step.title,
        text,
        nodes: [item.stateKey],
        wires: [],
        enter: undefined,
      };
    }),
  };
};

/** 強調する項目のうち閉じた section の中の項目を、その section にする */
const focusKeys = (
  grid: AxisGrid,
  state: MapState,
  nodes: string[],
): string[] =>
  nodes.map((key) => {
    let section = grid.items.find((item) => item.stateKey === key)?.section;
    let target = key;
    while (section !== undefined) {
      if (state.collapsed.includes(section) && section !== state.entered)
        target = section;
      const parent = grid.sections.find(
        (entry) => entry.stateKey === section,
      )?.parent;
      section = parent;
    }
    return target;
  });

/** 押したボタンか項目の押せる要素を、描き直した後に探し直すセレクタ */
const focusSelectorOf = (element: Element | null): string | undefined => {
  if (!(element instanceof HTMLElement)) return undefined;
  for (const name of [
    "mapSectionToggle",
    "mapSectionEnter",
    "mapBranch",
    "mapActor",
    "tool",
  ] as const) {
    const value = element.dataset[name];
    if (value === undefined) continue;
    const attribute = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    return `[data-${attribute}="${CSS.escape(value)}"]`;
  }
  const item = element.closest<HTMLElement>(".map-axis-item");
  if (!element.matches(".mdmark-diagram-node-hit") || !item) return undefined;
  return `.map-axis-item[data-node="${CSS.escape(item.dataset.node ?? "")}"] > .mdmark-diagram-node-hit`;
};

/** ツールのボタン */
const toolsOf = (grid: AxisGrid, state: MapState) => [
  ...(grid.sections.length === 0
    ? []
    : [
        {
          name: "back",
          label: "外へ戻る",
          disabled: state.entered === undefined,
        },
        { name: "expandAll", label: "全て開く" },
        { name: "collapseAll", label: "全て閉じる" },
      ]),
  {
    name: "reset",
    label: "配置と選択を元に戻す",
    disabled: state.selected.length === 0,
  },
];

/** 端末の今日の日付（`YYYY-MM-DD`） */
const localToday = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** 範囲から読んだ値 */
type ViewSource = {
  grid: AxisGrid;
  colors: Record<string, string>;
  notes: Record<string, string>;
  annotations: ReturnType<typeof readMapAnnotations>;
  frameId: string;
  terms: Record<string, string> | undefined;
  hints: boolean;
  today: string;
};

/** 状態の配置 */
const placeOf = (source: ViewSource, state: MapState): AxisGridLayout =>
  layoutAxisGrid({
    grid: source.grid,
    entered: state.entered,
    collapsed: new Set(state.collapsed),
    today: source.today,
    selected: selectionOf(state),
  });

/** 部品の HTML */
const renderOf = (
  source: ViewSource,
  view: {
    state: MapState;
    layout: AxisGridLayout;
    focus: string[] | undefined;
  },
) =>
  renderMapAxisGrid({
    grid: source.grid,
    layout: view.layout,
    filled: new Set(Object.keys(source.colors)),
    colors: source.colors,
    collapsed: view.state.collapsed,
    entered: view.state.entered,
    selected: selectionOf(view.state),
    focus: view.focus === undefined ? undefined : { nodes: view.focus },
    notes: source.notes,
    annotations: source.annotations,
    hints: source.hints,
    id: source.frameId,
    terms: source.terms,
  });

/** ジャーニーの人の凡例を、図の枠の凡例の行に入れる */
const fillLegend = (
  figure: HTMLElement,
  source: ViewSource,
  state: MapState,
): void => {
  const legend = figure.querySelector<HTMLElement>(".mdmark-diagram-legend");
  if (!legend || source.grid.kind !== "journey") return;
  legend.innerHTML = renderMapAxisGridLegend({
    grid: source.grid,
    selected: selectionOf(state),
  });
  legend.hidden = source.grid.actors.length === 0;
};

/** 範囲の図の番号・Mermaid・補足を読む */
const readAxisGridRange = (range: HTMLElement) => {
  const kind = (range.dataset.mapKind ?? "gantt") as AxisGridKind;
  return {
    index: Number(range.dataset.map ?? "1"),
    grid: parseAxisGrid({
      kind,
      source: range.querySelector("code")?.textContent ?? "",
    }),
    data: parseMapData(
      range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
    ).data,
  };
};

/** 1 つ外の入れ子（無ければ全体） */
const outerOf = (grid: AxisGrid, entered: string): string | undefined =>
  grid.sections.find((section) => section.stateKey === entered)?.parent;

/** `gantt`・`timeline`・`gitGraph`・`journey`・`block-beta` を読み取って軸と格子の配置で描き、開閉・中へ入る・選択・案内と再生と、状態の保存・ツールチップ・拡大と縮小を付ける */
export const attachMapAxisGrid = (
  range: HTMLElement,
  config: ResolvedConfig,
  options: { args: MapArgs; today?: () => string },
): MapAxisGridHandle => {
  const { args } = options;
  const { index, grid, data } = readAxisGridRange(range);
  const layout = layoutOf(grid, data);
  const notes = notesOf(grid, data);
  const source: ViewSource = {
    grid,
    colors: layout.colors,
    notes,
    annotations: readMapAnnotations({
      range,
      notes: byStateKey(grid, data.notes),
    }),
    frameId: `map-${index}`,
    terms: termsOf(range),
    hints: config.features.hints === true,
    today: (options.today ?? localToday)(),
  };
  const storage = sessionStorageOf();
  let state: MapState = {
    ...emptyMapState(),
    ...readMapState({
      index,
      ids: knownIds(grid),
      urlState: config.map.url_state,
      focus:
        args.focus === undefined ? undefined : stateKeyOf(grid, args.focus),
      collapsed: layout.collapsed,
      storage,
      location,
    }),
  };
  let focus: string[] | undefined;
  let placed = placeOf(source, state);
  const first = renderOf(source, { state, layout: placed, focus });
  range.innerHTML = renderDiagramFrame(
    {
      kind: "map",
      title: args.title ?? grid.title ?? mermaidKindName(grid.firstWord),
      legend: [],
      wide: true,
      fitMin: 1,
      tools: toolsOf(grid, state),
      id: source.frameId,
    },
    {
      html: first.html,
      width: placed.width,
      height: placed.height,
      tips: first.tips,
    },
  );
  linkAnnotationOwners(range);
  const figure = range.querySelector("figure") as HTMLElement;
  const stage = figure.querySelector(".mdmark-diagram-stage") as HTMLElement;
  const sizer = figure.querySelector(".mdmark-diagram-sizer") as HTMLElement;
  fillLegend(figure, source, state);
  const detachDiagrams = attachDiagrams({
    root: range,
    placement: config.tooltips.diagramPlacement,
    figures: [figure],
  });
  /** 今の状態で配置して描き直す */
  const draw = () => {
    placed = placeOf(source, state);
    const part = renderOf(source, {
      state,
      layout: placed,
      focus: focus === undefined ? undefined : focusKeys(grid, state, focus),
    });
    stage.innerHTML = part.html;
    for (const element of [stage, sizer]) {
      element.style.width = `${placed.width}px`;
      element.style.height = `${placed.height}px`;
    }
    replaceTips(figure, part.tips);
    linkAnnotationOwners(range);
    fillLegend(figure, source, state);
    for (const item of toolsOf(grid, state)) {
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
  /** 項目・ブランチ・人を選ぶ（選んだものなら選択を解除する） */
  const toggleSelected = (selection: AxisGridSelection) => {
    const text = selectionText(selection);
    change({
      ...state,
      selected: state.selected[0] === text ? [] : [text],
    });
  };
  /** 1 つ外へ戻る */
  const escapeEntered = () => {
    if (state.entered !== undefined)
      change({ ...state, entered: outerOf(grid, state.entered) });
  };
  /** Esc: 選んでいれば選択を解除し、選んでいなければ 1 つ外へ戻る */
  const escapeWithKey = () => {
    if (state.selected.length > 0) change({ ...state, selected: [] });
    else escapeEntered();
  };
  const runTool = (name: string | undefined) => {
    if (name === "back") escapeEntered();
    else if (name === "expandAll") change({ ...state, collapsed: [] });
    else if (name === "collapseAll")
      change({
        ...state,
        collapsed: grid.sections
          .map((section) => section.stateKey)
          .filter((key) => key !== state.entered),
      });
    else if (name === "reset") change({ ...state, selected: [] });
  };
  /** section を開閉する */
  const toggleCollapsed = (key: string) =>
    change({
      ...state,
      collapsed: state.collapsed.includes(key)
        ? state.collapsed.filter((item) => item !== key)
        : [...state.collapsed, key],
    });
  /** section の中へ入る */
  const enterSection = (key: string) =>
    change({
      ...state,
      entered: key,
      selected: [],
      collapsed: state.collapsed.filter((item) => item !== key),
    });
  /** ボタンの `data-*` の名前ごとの操作 */
  const controls: Array<[keyof DOMStringMap, (value: string) => void]> = [
    ["mapSectionToggle", toggleCollapsed],
    ["mapSectionEnter", enterSection],
    ["mapBranch", (key) => toggleSelected({ kind: "branch", key })],
    ["mapActor", (key) => toggleSelected({ kind: "actor", key })],
  ];
  /** 開閉・中へ入る・ブランチ・人・ツールのボタンなら操作し、`true` を返却する */
  const clickControl = (target: Element | undefined): boolean => {
    const button = target?.closest<HTMLButtonElement>("button");
    if (!button) return false;
    for (const [name, run] of controls) {
      const value = button.dataset[name];
      if (value === undefined) continue;
      run(value);
      return true;
    }
    if (button.dataset.tool === undefined || button.disabled) return false;
    runTool(button.dataset.tool);
    return true;
  };
  /** 押せる要素の項目の `stateKey`（閉じた section の項目は undefined） */
  const hitKey = (target: Element | undefined): string | undefined => {
    if (!target?.matches(".mdmark-diagram-node-hit")) return undefined;
    const item = target.closest<HTMLElement>(".map-axis-item");
    if (!item || item.dataset.shape === "collapsed") return undefined;
    return item.dataset.node;
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    pressed = target?.closest("button") ?? null;
    if (clickControl(target)) return;
    pressed = null;
    const key = hitKey(target);
    if (key !== undefined) toggleSelected({ kind: "item", key });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (event.key === "Escape") {
      escapeWithKey();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    const key = hitKey(target);
    if (key === undefined) return;
    event.preventDefault();
    toggleSelected({ kind: "item", key });
  };
  figure.addEventListener("click", onClick);
  figure.addEventListener("keydown", onKeyDown);

  let band: BandHandle | undefined;
  const plan = bandStepsOf(grid, data, notes);
  if (plan.steps.length > 0) {
    /** 案内を始めたときの、中へ入っていた section */
    let before: string | undefined;
    let walking = false;
    band = attachBand({
      figure,
      mode: plan.mode,
      unit: PLAYBACK_UNITS[grid.kind],
      steps: plan.steps,
      interval: args.interval,
      autoplay: args.play === "autoplay",
      reducedMotion: prefersReducedMotion(),
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
  return {
    destroy: () => {
      band?.destroy();
      detachDiagrams();
      figure.removeEventListener("click", onClick);
      figure.removeEventListener("keydown", onKeyDown);
    },
  };
};
