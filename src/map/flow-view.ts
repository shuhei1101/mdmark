import type { ResolvedConfig } from "../config.ts";
import { attachDiagrams, DIAGRAM_REDRAW_EVENT } from "../interact/diagrams.ts";
import { renderDiagramFrame } from "../parts/diagram.ts";
import {
  type MapFlowArgs,
  type MapPacketMark,
  type MapPart,
  renderMapFlow,
  renderMapPackets,
  selectableName,
} from "../parts/map.ts";
import { linkAnnotationOwners, readMapAnnotations } from "./annotations.ts";
import {
  attachBand,
  type BandHandle,
  type BandStep,
  createFollow,
} from "./band.ts";
import { type MapData, type MapStep, noteTexts, parseMapData } from "./data.ts";
import {
  applyWireShifts,
  KEY_MOVE_PX,
  KEY_MOVE_PX_LARGE,
  moveByKey,
  nearestSegment,
  startDrag,
} from "./drag.ts";
import {
  type Flowchart,
  mapLinkProblems,
  parseFlowchart,
} from "./flowchart.ts";
import { layoutMap, type MapLayout, type MapOverride } from "./layout.ts";
import type { MapArgs } from "./spec.ts";
import {
  emptyMapState,
  type MapState,
  readMapState,
  writeMapState,
} from "./state.ts";

/** 強調するときに map-dim を付ける要素のセレクター（ノード・線・ラベル・ライフライン） */
export const DIM_SELECTOR =
  ".mdmark-diagram-node, .mdmark-diagram-wire, .mdmark-diagram-label, .mdmark-diagram-lifeline";

/** attachMapFlow の戻り値 */
export type MapFlowHandle = {
  /** 外から強調を当てる（シーケンス図の再生） */
  focus: (target: { nodes: string[]; wires: string[] }) => void;
  /** 外から当てた強調を解く */
  clearFocus: () => void;
  /** ノードの中心へ表示する枠をスクロールする（シーケンス図の再生を自動で進めている間） */
  follow: (nodes: string[]) => void;
  /** 読者が触って止めたスクロールを再開する */
  resumeFollow: () => void;
  /** 時計・観察・操作を外す */
  destroy: () => void;
};

/** 構成図の描画と操作に、ER 図・状態遷移図が追加する処理（attachMapFlow の extension） */
export type MapFlowExtension = {
  /** parseFlowchart の代わりに配置するノード・グループ・線 */
  chart: Flowchart;
  /** 補足の layout の前に重ねる配置の上書き（ノードの幅・大きさ・上に空ける高さ） */
  overrides?: (view: {
    collapsed: ReadonlySet<string>;
  }) => Record<string, MapOverride>;
  /** 補足の walkthroughs の代わりに帯で進める手順 */
  walkthroughs?: MapStep[] | undefined;
  /** 帯のモード（既定 walkthrough） */
  bandMode?: "walkthrough" | "playback";
  /** 再生で進める単位（既定 message） */
  bandUnit?: "message" | "transition";
  /** 全て閉じるで閉じる、グループのほかの ID（ER 図のテーブル） */
  collapsibles?: string[];
  /** 自動配置の後に、線の経路を引き直す */
  rewire?: (
    layout: MapLayout,
    view: { collapsed: string[] },
  ) => MapLayout["wires"];
  /** renderMapFlow の代わりに図の中身を描く部品 */
  render?: (args: MapFlowArgs) => MapPart;
  /** 強調を当てた後に呼ぶ（行が増える関連のマーカー・同じ状態への遷移を描き直す） */
  afterRender?: (
    figure: HTMLElement,
    layout: MapLayout,
    view: { selected: Set<string>; step: number | undefined },
  ) => void;
  /** 選んだノードから残すノードと線（undefined なら構成図の選び方） */
  selectionOf?: (
    selected: Set<string>,
  ) => { nodes: Set<string>; wires: Set<string> } | undefined;
  /** 閉じたグループの名前の後ろの文字 */
  collapsedTag?: (groupId: string) => string | undefined;
};

/** 補足の layout と状態から、ID ごとの配置の上書きを作る */
const overridesOf = (
  data: MapData,
  state: MapState,
  measured: {
    sizes: Record<string, { w: number; h: number }>;
    base?: Record<string, MapOverride> | undefined;
  },
): Record<string, MapOverride> => {
  const { sizes, base = {} } = measured;
  const overrides: Record<string, MapOverride> = { ...base };
  for (const [id, entry] of Object.entries(data.layout)) {
    overrides[id] = {
      ...overrides[id],
      align: entry.align,
      order: entry.order,
      pos: entry.pos,
      width: entry.width ?? overrides[id]?.width,
      justify: entry.justify,
      ends: entry.ends,
      via: entry.via,
    };
  }
  for (const [id, pos] of Object.entries(state.positions))
    overrides[id] = { ...overrides[id], pos };
  for (const [id, ends] of Object.entries(state.attachments))
    overrides[id] = {
      ...overrides[id],
      ends: { ...overrides[id]?.ends, ...ends },
    };
  for (const [id, size] of Object.entries(sizes))
    overrides[id] = { ...overrides[id], size };
  return overrides;
};

/** 範囲の `data-map-terms`（用語から意味の JSON）。無ければ undefined */
export const termsOf = (
  range: HTMLElement,
): Record<string, string> | undefined =>
  range.dataset.mapTerms === undefined
    ? undefined
    : (JSON.parse(range.dataset.mapTerms) as Record<string, string>);

/** 図の枠の図のツールチップを差し替え、ツールチップの操作を付け直させる */
export const replaceTips = (figure: HTMLElement, tips: string): void => {
  const box = figure.querySelector<HTMLElement>(".mdmark-diagram-box");
  if (!box) return;
  for (const tip of box.querySelectorAll(":scope > .mdmark-diagram-tip"))
    tip.remove();
  box.insertAdjacentHTML("beforeend", tips);
  figure.dispatchEvent(new Event(DIAGRAM_REDRAW_EVENT));
};

/** 強調するノードどうしの線 */
const wiresBetween = (layout: MapLayout, nodes: string[]): string[] => {
  const set = new Set(nodes);
  return layout.wires
    .filter((wire) => set.has(wire.from) && set.has(wire.to))
    .map((wire) => wire.id);
};

/** グループの親（無ければ undefined） */
const parentOf = (chart: Flowchart, id: string): string | undefined =>
  chart.groups.find((group) => group.id === id)?.parent ?? undefined;

/** sessionStorage（使えない環境では `undefined`） */
export const sessionStorageOf = (): Storage | undefined =>
  typeof sessionStorage === "undefined" ? undefined : sessionStorage;

/** 要素の大きさの変化を見る ResizeObserver（使えない環境では `undefined`） */
const resizeObserverOf = (callback: () => void): ResizeObserver | undefined =>
  typeof ResizeObserver === "undefined"
    ? undefined
    : new ResizeObserver(callback);

/** 動きを減らす設定か */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 範囲の図の番号・Mermaid・補足を読む（拡張が読んだ図があればそれを使う） */
const readFlowRange = (
  range: HTMLElement,
  extension: MapFlowExtension | undefined,
): { index: number; chart: Flowchart; data: MapData } => {
  const source = range.querySelector("code")?.textContent ?? "";
  return {
    index: Number(range.dataset.map ?? "1"),
    chart: extension?.chart ?? parseFlowchart(source),
    data: parseMapData(
      range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
    ).data,
  };
};

/** 補足の layout の ID ごとの値（値を持たない ID は除く） */
const layoutValues = (
  data: MapData,
  key: "line" | "color",
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(data.layout).flatMap(([id, entry]) => {
      const value = entry[key];
      return value === undefined ? [] : [[id, value]];
    }),
  );

/** 配置と選択を元に戻すボタンを押せないか（選択も動かした配置も無い） */
const resetDisabled = (state: MapState): boolean =>
  state.selected.length === 0 &&
  Object.keys(state.positions).length === 0 &&
  Object.keys(state.wireShifts).length === 0;

/** 選ぶ・強調するときに残すノードと線 */
type Kept = { nodes: Set<string>; wires: Set<string> };

/** 線を指している間はその線を、次に選択、次に外からの強調を残す */
const keptOf = (context: {
  layout: MapLayout;
  hovered: string | undefined;
  selected: Set<string>;
  focus: { nodes: string[]; wires: string[] } | undefined;
  selectionOf: MapFlowExtension["selectionOf"];
}): Kept | undefined => {
  const { layout, hovered, selected, focus, selectionOf } = context;
  const pointed = layout.wires.find((wire) => wire.id === hovered);
  if (pointed)
    return {
      nodes: new Set([pointed.from, pointed.to]),
      wires: new Set([pointed.id]),
    };
  if (selected.size > 0)
    return selectionOf?.(selected) ?? selectedKept(layout, selected);
  return focus === undefined
    ? undefined
    : { nodes: new Set(focus.nodes), wires: new Set(focus.wires) };
};

/** 選んだノードと、そのノードの線（1 つなら出入りする線、2 つ以上なら選んだノードどうしの線） */
const selectedKept = (layout: MapLayout, selected: Set<string>): Kept => ({
  nodes: selected,
  wires: new Set(
    layout.wires
      .filter((wire) =>
        selected.size === 1
          ? selected.has(wire.from) || selected.has(wire.to)
          : selected.has(wire.from) && selected.has(wire.to),
      )
      .map((wire) => wire.id),
  ),
});

/** ノードの要素に、選択と薄くするクラス・スクリーンリーダー向けの名前を当てる */
const emphasizeNodes = (
  stage: HTMLElement,
  context: { selected: Set<string>; kept: Kept | undefined },
): void => {
  const { selected, kept } = context;
  for (const element of stage.querySelectorAll<Element>(
    ".mdmark-diagram-node[data-node]",
  )) {
    const id = element.getAttribute("data-node") ?? "";
    element.classList.toggle("is-selected", selected.has(id));
    if (element.hasAttribute("aria-roledescription")) {
      element.toggleAttribute("data-selected", selected.has(id));
      const name =
        element.querySelector(".mdmark-diagram-node-name")?.textContent ?? "";
      element.setAttribute(
        "aria-label",
        selectableName(name, selected.has(id)),
      );
    }
    element.classList.toggle(
      "map-dim",
      kept !== undefined && !kept.nodes.has(id),
    );
  }
};

/** 線とラベルの要素に、薄くするクラスを当てる */
const emphasizeWires = (stage: HTMLElement, kept: Kept | undefined): void => {
  for (const element of stage.querySelectorAll<Element>(
    ".mdmark-diagram-wire[data-wire], .mdmark-diagram-label[data-wire], [data-wire-mark]",
  )) {
    const id =
      element.getAttribute("data-wire") ??
      element.getAttribute("data-wire-mark") ??
      "";
    element.classList.toggle(
      "map-dim",
      kept !== undefined && !kept.wires.has(id),
    );
  }
};

/** キーで操作する要素（ノード・グループのタイトルの行の帯・線）と、フォーカスし直す要素のセレクタ */
type KeyTarget = {
  node?: string;
  group?: string;
  wire?: string;
  /** リンク先を持つノードか */
  linked?: boolean;
  selector: string;
};

/** キーで操作するノード。リンク先を持つノードは、ノードの代わりにリンクがフォーカスを受ける */
const nodeKeyTarget = (element: Element | undefined): KeyTarget | undefined => {
  const nodeElement = element?.closest(".mdmark-diagram-node[data-node]");
  const node = nodeElement?.getAttribute("data-node");
  if (!node) return undefined;
  const linked = nodeElement?.querySelector(".mdmark-diagram-node-link");
  const selector = `[data-node="${CSS.escape(node)}"]`;
  return {
    node,
    linked: linked !== null && linked !== undefined,
    selector: linked ? `${selector} .mdmark-diagram-node-link` : selector,
  };
};

/** キーで操作するグループのタイトルの行の帯 */
const groupKeyTarget = (
  element: Element | undefined,
): KeyTarget | undefined => {
  const group = element
    ?.closest(".map-group-bar")
    ?.closest("[data-group]")
    ?.getAttribute("data-group");
  if (!group) return undefined;
  return {
    group,
    selector: `[data-group="${CSS.escape(group)}"] .map-group-bar`,
  };
};

/** キーで操作する線 */
const wireKeyTarget = (element: Element | undefined): KeyTarget | undefined => {
  const wire = element?.closest(".map-wire-hit")?.getAttribute("data-wire");
  if (!wire) return undefined;
  return { wire, selector: `.map-wire-hit[data-wire="${CSS.escape(wire)}"]` };
};

/** キーで操作する要素 */
const keyTargetOf = (element: Element | undefined): KeyTarget | undefined =>
  nodeKeyTarget(element) ?? groupKeyTarget(element) ?? wireKeyTarget(element);

/** ドラッグを始める要素（ノード・線・グループのタイトルの行）。ボタンと名前と列の上では始めない */
const dragStartOf = (
  event: PointerEvent,
):
  | { node: string | null | undefined; wire: string | null | undefined }
  | undefined => {
  const target = event.target instanceof Element ? event.target : undefined;
  if (
    !target ||
    target.closest("button, .mdmark-diagram-node-name, .map-er-columns")
  )
    return undefined;
  const node = target.closest("[data-node]")?.getAttribute("data-node");
  const wire = target.closest(".map-wire-hit")?.getAttribute("data-wire");
  const head = target.closest(".map-group-head, .map-group-bar");
  if (!node && !wire && !head) return undefined;
  return { node, wire };
};

/** 動かしたノードの上の次の click を止める（動かさずに押したときだけリンクを開く） */
const suppressNextClick = (node: string): void => {
  const suppress = (click: MouseEvent) => {
    click.preventDefault();
    // 動かしたノードの上の click は、利用側が document で受けてもリンク先を開かないよう、伝播も止める
    const target = click.target instanceof Element ? click.target : null;
    if (target?.closest(`[data-node="${CSS.escape(node)}"]`))
      click.stopPropagation();
    window.removeEventListener("click", suppress, true);
  };
  window.addEventListener("click", suppress, true);
  // click が続かないとき（指を離した場所が別の要素）は、次の操作の click を止めない
  setTimeout(() => window.removeEventListener("click", suppress, true));
};

/** 点に一番近い線の区間を動かせる向きのポインター（横の区間は上下、縦の区間は左右） */
const segmentCursor = (
  wire: MapLayout["wires"][number],
  point: [number, number],
): string => {
  const segment = nearestSegment(wire, point);
  if (segment === undefined) return "";
  const a = wire.points[segment];
  const b = wire.points[segment + 1];
  if (!a || !b) return "";
  return a[1] === b[1] ? "ns-resize" : "ew-resize";
};

/** 案内の手順 */
const bandStepsOf = (walkthroughs: MapStep[]): BandStep[] =>
  walkthroughs.map((step) => ({
    title: step.title ?? "",
    text: step.text,
    nodes: step.nodes,
    wires: step.edges ?? [],
    enter: step.enter,
  }));

/** 案内の帯の出し方（拡張が無ければ案内） */
const bandModeOf = (
  extension: MapFlowExtension | undefined,
): { mode: "walkthrough" | "playback"; unit?: "message" | "transition" } => ({
  mode: extension?.bandMode ?? "walkthrough",
  ...(extension?.bandUnit === undefined ? {} : { unit: extension.bandUnit }),
});

/** 強調するノードと線（線を指定しなければ、ノードどうしの線） */
const focusOf = (
  layout: MapLayout,
  target: { nodes: string[]; wires: string[] },
): { nodes: string[]; wires: string[] } => ({
  nodes: target.nodes,
  wires:
    target.wires.length > 0 ? target.wires : wiresBetween(layout, target.nodes),
});

/** 構成図を読み取り、状態を読んで配置し、描いて測った大きさで配置し直し、操作を付ける */
export const attachMapFlow = (
  range: HTMLElement,
  config: ResolvedConfig,
  options: { args: MapArgs; onWalk?: () => void; extension?: MapFlowExtension },
): MapFlowHandle => {
  const { args, onWalk, extension } = options;
  const { index, chart, data } = readFlowRange(range, extension);
  const ids = new Set([
    ...chart.nodes.map((node) => node.id),
    ...chart.groups.map((group) => group.id),
  ]);
  const storage = sessionStorageOf();
  let state: MapState = {
    ...emptyMapState(),
    ...readMapState({
      index,
      ids,
      urlState: config.map.url_state,
      focus: args.focus,
      collapsed: Object.entries(data.layout)
        .filter(([, entry]) => entry.collapsed === true)
        .map(([id]) => id),
      storage,
      location,
    }),
  };
  const notes = noteTexts(data.notes);
  const annotations = readMapAnnotations({ range, notes: data.notes });
  const links = mapLinkProblems(chart.links).allowed;
  const wireLines = layoutValues(data, "line");
  const colors = layoutValues(data, "color");
  const sizes: Record<string, { w: number; h: number }> = {};
  let focus: { nodes: string[]; wires: string[] } | undefined;
  /** 指している線の ID */
  let hovered: string | undefined;
  /** 状態から自動配置し、拡張があれば線を引き直す */
  const place = (): MapLayout => {
    const placed = layoutMap(
      chart,
      { collapsed: state.collapsed, entered: state.entered },
      {
        overrides: overridesOf(data, state, {
          sizes,
          base: extension?.overrides?.({ collapsed: new Set(state.collapsed) }),
        }),
        nodeFit: config.map.node_fit,
      },
    );
    return extension?.rewire
      ? {
          ...placed,
          wires: extension.rewire(placed, { collapsed: state.collapsed }),
        }
      : placed;
  };
  let layout: MapLayout = place();
  /** 帯で今出している手順の番号 */
  let currentStep: number | undefined;
  const frameId = `map-${index}`;
  const tools = () => [
    {
      name: "back",
      label: "外へ戻る",
      disabled: state.entered === undefined,
    },
    { name: "expandAll", label: "全て開く" },
    { name: "collapseAll", label: "全て閉じる" },
    {
      name: "reset",
      label: "配置と選択を元に戻す",
      disabled: resetDisabled(state),
    },
  ];
  const terms = termsOf(range);
  const body = () => {
    const applied = applyWireShifts(layout, state);
    const shown = { ...layout, wires: applied.wires };
    const packets: MapPacketMark[] = [];
    const part = (extension?.render ?? renderMapFlow)({
      layout: shown,
      kinds: config.map.kinds,
      lines: config.map.lines,
      wireLines,
      notes,
      annotations,
      links,
      colors,
      collapsed: state.collapsed,
      entered: state.entered,
      selected: state.selected,
      focus,
      packets,
      dragging: undefined,
      id: frameId,
      terms,
      collapsedTag: extension?.collapsedTag,
    });
    return {
      html: part.html,
      width: layout.width,
      height: layout.height,
      tips: part.tips,
    };
  };
  range.innerHTML = renderDiagramFrame(
    {
      kind: "map",
      title: args.title ?? "",
      legend: [],
      wide: true,
      // 等倍より縮めず、収まらない分は図の枠の中で横にスクロールする
      fitMin: 1,
      tools: tools(),
      id: frameId,
    },
    body(),
  );
  linkAnnotationOwners(range);
  const figure = range.querySelector<HTMLElement>("figure") as HTMLElement;
  const detachDiagrams = attachDiagrams({
    root: range,
    placement: "bottom",
    figures: [figure],
  });
  // シーケンス図の再生を自動で進めている間に、送り手と受け手のノードへ表示する枠をスクロールする
  const follower = createFollow(figure, prefersReducedMotion());

  const save = () =>
    writeMapState({
      index,
      state,
      urlState: config.map.url_state,
      storage,
      history,
      location,
    });
  /** 図の中身を描き直す */
  const drawStage = () => {
    const part = body();
    const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
    const sizer = figure.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    if (stage) {
      stage.innerHTML = part.html;
      stage.style.width = `${part.width}px`;
      stage.style.height = `${part.height}px`;
    }
    if (sizer) {
      sizer.style.width = `${part.width}px`;
      sizer.style.height = `${part.height}px`;
    }
    replaceTips(figure, part.tips);
    linkAnnotationOwners(range);
  };
  /** 状態から配置し直して、図の中身とツールを描き直す */
  const refresh = (relayout = true) => {
    if (relayout) layout = place();
    drawStage();
    for (const item of tools()) {
      const button = figure.querySelector<HTMLButtonElement>(
        `[data-tool="${item.name}"]`,
      );
      if (button) button.disabled = item.disabled === true;
    }
    emphasize();
    observeNodes();
  };
  /** ノードの大きさの変化（文字の読み込みなど）を見て、測り直す */
  const resizeObserver = resizeObserverOf(() => measure());
  const observeNodes = () => {
    if (!resizeObserver) return;
    resizeObserver.disconnect();
    for (const element of figure.querySelectorAll(
      ".mdmark-diagram-stage > .mdmark-diagram-node[data-node]",
    ))
      resizeObserver.observe(element);
  };
  const change = (next: MapState) => {
    state = next;
    save();
    refresh();
  };
  /** 線の上に流すデータの印（補足の layout の packet の色と形状。両向きの線は両方へ） */
  const packetsOf = (wires: Iterable<string>): MapPacketMark[] =>
    [...wires].flatMap((id) => {
      const wire = layout.wires.find((item) => item.id === id);
      if (!wire) return [];
      const packet = data.layout[id]?.packet;
      return [
        {
          wire: id,
          direction: wire.both ? "both" : "forward",
          color: packet?.color,
          shape: packet?.shape ?? "circle",
        },
      ];
    });
  /** 選択と強調を、描いた要素のクラスとデータの印で当て直す（ノードと線の要素は差し替えない）。線を指している間はその線を、次に選択、次に外からの強調を当てる */
  const emphasize = () => {
    const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
    if (!stage) return;
    const selected = new Set(state.selected);
    const kept = keptOf({
      layout,
      hovered,
      selected,
      focus,
      selectionOf: extension?.selectionOf,
    });
    emphasizeNodes(stage, { selected, kept });
    emphasizeWires(stage, kept);
    const layer = stage.querySelector(".map-packets");
    if (layer)
      layer.innerHTML = renderMapPackets(
        {
          layout: { ...layout, wires: applyWireShifts(layout, state).wires },
          kinds: config.map.kinds,
          lines: config.map.lines,
          wireLines,
          colors,
        },
        packetsOf(kept?.wires ?? []),
      );
    const reset = figure.querySelector<HTMLButtonElement>(
      '[data-tool="reset"]',
    );
    if (reset) reset.disabled = resetDisabled(state);
    extension?.afterRender?.(figure, layout, {
      selected,
      step: currentStep,
    });
  };
  /** 選択だけを変える（配置し直さない） */
  const changeSelection = (selected: string[]) => {
    state = { ...state, selected };
    save();
    emphasize();
  };
  /** 描いたノードの中身を測り、見積もりより大きいノードを測った大きさにして配置し直す */
  const measure = () => {
    let changed = false;
    for (const node of layout.nodes) {
      const element = figure.querySelector<HTMLElement>(
        `.mdmark-diagram-node[data-node="${CSS.escape(node.id)}"]`,
      );
      if (!element) continue;
      // 枠線を含む高さに、中身があふれた分を足す
      const over = Math.ceil(element.scrollHeight - element.clientHeight);
      if (over > 1) {
        sizes[node.id] = { w: node.w, h: node.h + over };
        changed = true;
      }
    }
    if (changed) refresh();
  };
  measure();
  observeNodes();
  // 保った選択の強調と印を、初めに描いた図にも当てる
  emphasize();

  const groupsUnder = (id: string): string[] =>
    chart.groups
      .filter((group) => {
        for (
          let at: string | undefined = group.id;
          at;
          at = parentOf(chart, at)
        )
          if (at === id) return true;
        return false;
      })
      .map((group) => group.id);
  const toggleGroup = (id: string, all: boolean) => {
    const targets = all ? groupsUnder(id) : [id];
    const closing = !state.collapsed.includes(id);
    const set = new Set(state.collapsed);
    for (const target of targets) {
      if (closing) set.add(target);
      else set.delete(target);
    }
    change({ ...state, collapsed: [...set] });
  };
  const select = (ids: string[]) => {
    const all = ids.every((id) => state.selected.includes(id));
    const next = all
      ? state.selected.filter((id) => !ids.includes(id))
      : [...new Set([...state.selected, ...ids])];
    changeSelection(next);
  };
  /** ノードの中身の開閉（ER 図のテーブルの列）。測った大きさを捨てて配置し直す */
  const toggleNode = (id: string) => {
    delete sizes[id];
    const set = new Set(state.collapsed);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    change({ ...state, collapsed: [...set] });
  };
  /** ツールのボタンの操作 */
  const runTool = (name: string | undefined) => {
    if (name === "back" && state.entered !== undefined)
      change({ ...state, entered: parentOf(chart, state.entered) });
    else if (name === "expandAll") change({ ...state, collapsed: [] });
    else if (name === "collapseAll")
      change({
        ...state,
        collapsed: [
          ...chart.groups.map((group) => group.id),
          ...(extension?.collapsibles ?? []),
        ].filter((id) => id !== state.entered),
      });
    else if (name === "reset")
      change({
        ...state,
        selected: [],
        positions: {},
        wireShifts: {},
        attachments: {},
      });
  };
  /** グループとノードの中身の開閉のボタンなら開閉し、`true` を返却する */
  const clickToggle = (target: Element | undefined, all: boolean) => {
    const toggle = target?.closest<HTMLElement>("[data-group-toggle]");
    if (toggle) {
      toggleGroup(toggle.dataset.groupToggle ?? "", all);
      return true;
    }
    const own = target?.closest<HTMLElement>("[data-node-toggle]");
    if (!own) return false;
    toggleNode(own.dataset.nodeToggle ?? "");
    return true;
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (clickToggle(target, event.shiftKey)) return;
    const enter = target?.closest<HTMLElement>("[data-group-enter]");
    if (enter) {
      change({ ...state, entered: enter.dataset.groupEnter, selected: [] });
      return;
    }
    const tool = target?.closest<HTMLButtonElement>("[data-tool]");
    if (tool && !tool.disabled) runTool(tool.dataset.tool);
  };
  /** 図の中身の倍率と、ポインターの位置の図の中身の座標 */
  const stageScale = (): number => {
    const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
    if (!stage) return 1;
    return stage.getBoundingClientRect().width / (stage.offsetWidth || 1) || 1;
  };
  const stagePoint = (event: PointerEvent): [number, number] => {
    const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
    const rect = stage?.getBoundingClientRect();
    const scale = stageScale();
    return rect
      ? [
          (event.clientX - rect.left) / scale,
          (event.clientY - rect.top) / scale,
        ]
      : [0, 0];
  };
  /** 線の両端のノードを選ぶ */
  const selectWire = (id: string) => {
    const item = layout.wires.find((one) => one.id === id);
    if (item) select([item.from, item.to]);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const start = dragStartOf(event);
    if (!start) return;
    const { node, wire } = start;
    event.preventDefault();
    // 動かした後の click ではノードのリンクを開かない（動かさずに押したときだけ開く）
    let moved = true;
    startDrag({
      event,
      layout: { ...layout, wires: applyWireShifts(layout, state).wires },
      state,
      scale: stageScale(),
      pointOf: stagePoint,
      onMove: (next) => {
        state = next;
        refresh();
      },
      onClick: () => {
        moved = false;
        if (node) select([node]);
        else if (wire) selectWire(wire);
      },
    });
    const finish = () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      save();
      if (moved && node) suppressNextClick(node);
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  /** Alt + 矢印キーで動かす（Shift も押すと大きく） */
  const moveWithKey = (
    keyTarget: KeyTarget,
    key: { arrow: [number, number]; large: boolean },
  ) => {
    const step = key.large ? KEY_MOVE_PX_LARGE : KEY_MOVE_PX;
    const next = moveByKey({
      layout: { ...layout, wires: applyWireShifts(layout, state).wires },
      state,
      target: keyTarget,
      dx: key.arrow[0] * step,
      dy: key.arrow[1] * step,
    });
    if (!next) return;
    change(next);
    figure.querySelector<HTMLElement>(keyTarget.selector)?.focus();
  };
  /** Enter・Space でノードを、Enter で線の両端を選ぶ（リンクの Enter はリンクを開く）。選んだら `true` を返却する */
  const selectWithKey = (keyTarget: KeyTarget, event: KeyboardEvent) => {
    const { key } = event;
    if (key === "Enter" && keyTarget.linked) return false;
    if (key !== "Enter" && !(key === " " && keyTarget.node)) return false;
    selectKeyTarget(keyTarget, event);
    return true;
  };
  /** キーで操作するノードか、線の両端を選び、フォーカスし直す */
  const selectKeyTarget = (keyTarget: KeyTarget, event: KeyboardEvent) => {
    if (keyTarget.node) select([keyTarget.node]);
    else if (keyTarget.wire) selectWire(keyTarget.wire);
    else return;
    event.preventDefault();
    figure.querySelector<HTMLElement>(keyTarget.selector)?.focus();
  };
  /** Escape で選択を外し、選んでいなければ外へ戻る */
  const escapeWithKey = () => {
    if (state.selected.length > 0) changeSelection([]);
    else if (state.entered !== undefined)
      change({ ...state, entered: parentOf(chart, state.entered) });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const element = event.target instanceof Element ? event.target : undefined;
    const keyTarget = keyTargetOf(element);
    const arrow = ARROWS[event.key];
    if (keyTarget && arrow && event.altKey) {
      event.preventDefault();
      moveWithKey(keyTarget, { arrow, large: event.shiftKey });
      return;
    }
    if (keyTarget && selectWithKey(keyTarget, event)) return;
    if (event.key === "Escape") escapeWithKey();
  };
  // 線の区間の上では、区間を動かせる向きのポインターにする（横の区間は上下、縦の区間は左右）
  const onPointerMove = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const hit = target?.closest<SVGPathElement>(".map-wire-hit[data-wire]");
    if (!hit) return;
    const wire = applyWireShifts(layout, state).wires.find(
      (item) => item.id === hit.dataset.wire,
    );
    hit.style.cursor = wire ? segmentCursor(wire, stagePoint(event)) : "";
  };
  const onPointerOver = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const id = target?.closest(".map-wire-hit")?.getAttribute("data-wire");
    if (id && id !== hovered) {
      hovered = id;
      emphasize();
    }
  };
  const onPointerOut = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (hovered !== undefined && target?.closest(".map-wire-hit")) {
      hovered = undefined;
      emphasize();
    }
  };
  figure.addEventListener("click", onClick);
  figure.addEventListener("pointerdown", onPointerDown);
  figure.addEventListener("keydown", onKeyDown);
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const id = target?.closest(".map-wire-hit")?.getAttribute("data-wire");
    if (id && id !== hovered) {
      hovered = id;
      emphasize();
    }
  };
  const onFocusOut = (event: FocusEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (hovered !== undefined && target?.closest(".map-wire-hit")) {
      hovered = undefined;
      emphasize();
    }
  };
  figure.addEventListener("focusin", onFocusIn);
  figure.addEventListener("focusout", onFocusOut);
  figure.addEventListener("pointermove", onPointerMove);
  figure.addEventListener("pointerover", onPointerOver);
  figure.addEventListener("pointerout", onPointerOut);

  let band: BandHandle | undefined;
  /** 案内を始めたときに中へ入っていたグループ（停止で戻す） */
  let walkFrom: { entered: string | undefined } | undefined;
  /** 案内の手順を当てる。始めたら外からの強調を解き、止めたら始めたときのグループへ戻す */
  const applyStep = (step: BandStep | undefined, steps: BandStep[]) => {
    currentStep = step === undefined ? undefined : steps.indexOf(step);
    if (step === undefined) {
      leaveWalk();
      focus = undefined;
    } else {
      onWalk?.();
      walkFrom ??= { entered: state.entered };
      // 手順の enter のグループへ入り、enter を持たない手順は案内を始めた段の図で出す
      const entered = step.enter ?? walkFrom.entered;
      if (entered !== state.entered) state = { ...state, entered };
      focus = focusOf(layout, step);
    }
    refresh();
  };
  /** 案内を止めたら、案内を始めたときに中へ入っていたグループへ戻す */
  const leaveWalk = () => {
    if (walkFrom === undefined) return;
    state = { ...state, entered: walkFrom.entered };
    walkFrom = undefined;
    save();
  };
  const walkthroughs = extension?.walkthroughs ?? data.walkthroughs;
  if (walkthroughs.length > 0) {
    const steps = bandStepsOf(walkthroughs);
    band = attachBand({
      figure,
      ...bandModeOf(extension),
      steps,
      interval: args.interval,
      autoplay: args.play === "autoplay",
      reducedMotion: prefersReducedMotion(),
      apply: (step) => applyStep(step, steps),
    });
  }

  return {
    focus: (target) => {
      band?.stop();
      focus = focusOf(layout, target);
      emphasize();
    },
    clearFocus: () => {
      focus = undefined;
      emphasize();
    },
    follow: follower.reveal,
    resumeFollow: follower.resume,
    destroy: () => {
      band?.destroy();
      follower.destroy();
      resizeObserver?.disconnect();
      detachDiagrams();
      figure.removeEventListener("click", onClick);
      figure.removeEventListener("pointerdown", onPointerDown);
      figure.removeEventListener("keydown", onKeyDown);
      figure.removeEventListener("focusin", onFocusIn);
      figure.removeEventListener("focusout", onFocusOut);
      figure.removeEventListener("pointermove", onPointerMove);
      figure.removeEventListener("pointerover", onPointerOver);
      figure.removeEventListener("pointerout", onPointerOut);
    },
  };
};
