import type { ResolvedConfig } from "../config.ts";
import {
  attachDiagrams,
  DIAGRAM_REDRAW_EVENT,
} from "../diagram/diagram.interact.ts";
import { renderDiagramFrame } from "../diagram/diagram.part.ts";
import type { ResolveIdLink } from "../render/sanitize.ts";
import { DRAG_THRESHOLD, zoomControlOf } from "../shared/zoom.interact.ts";
import { linkAnnotationOwners, readMapAnnotations } from "./annotations.ts";
import {
  attachBand,
  type BandHandle,
  type BandStep,
  createFollow,
} from "./band.ts";
import {
  type MapChange,
  type MapData,
  type MapStep,
  noteTexts,
  parseMapData,
} from "./data.ts";
import {
  applyWireShifts,
  KEY_MOVE_PX,
  KEY_MOVE_PX_LARGE,
  moveByKey,
  resizeByKey,
  nearestSegment,
  startDrag,
} from "./drag.ts";
import {
  type Flowchart,
  mapLinkProblems,
  parseFlowchart,
} from "./flowchart.ts";
import {
  LABEL_METRICS,
  layoutMap,
  type MapLayout,
  type MapOverride,
  type MeasureText,
  separateWires,
} from "./layout.ts";
import { attachMapList, flowListItems } from "./list.ts";
import {
  type MapFlowArgs,
  type MapPacketMark,
  type MapPart,
  renderMapFlow,
  renderMapPackets,
  selectableName,
} from "./map.part.ts";
import type { MapArgs, MapKind, MapLine } from "./spec.ts";
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
    /** 補足の layout の width を持つ ID から幅 */
    widths: Record<string, number>;
    /** layoutMap に指定するのと同じ、名前の 1 行の幅を測る関数 */
    measureText: MeasureText;
  }) => Record<string, MapOverride>;
  /** 補足の walkthroughs の代わりに帯で進める手順 */
  walkthroughs?: MapStep[] | undefined;
  /** 帯のモード（既定 walkthrough） */
  bandMode?: "walkthrough" | "playback";
  /** 再生で進める単位（既定 message） */
  bandUnit?: "message" | "transition" | "relation";
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
  /** 設定の map.kinds に重ねるノードの種類 */
  kinds?: Record<string, MapKind> | undefined;
  /** 設定の map.lines に重ねる線の種類 */
  lines?: Record<string, MapLine> | undefined;
  /** 印に title が無いときの図の枠のタイトル */
  title?: string | undefined;
  /** 選べるノードか（undefined なら全てのノードを選べる） */
  selectable?: ((id: string) => boolean) | undefined;
  /** 線ごとのデータの印の向き（undefined なら線の元から先。both の線は両向き） */
  packetDirection?: ((wireId: string) => "forward" | "backward") | undefined;
};

/** 1 つのノードと、そのノードの線と相手のノード */
export const neighborKept = (
  edges: Array<{ id: string; from: string; to: string }>,
  id: string,
): { nodes: Set<string>; wires: Set<string> } => {
  const near = edges.filter((edge) => edge.from === id || edge.to === id);
  return {
    nodes: new Set([id, ...near.flatMap((edge) => [edge.from, edge.to])]),
    wires: new Set(near.map((edge) => edge.id)),
  };
};

/** 2 つのノードをつなぐ最短の経路に乗る全てのノードと線（つながらなければ 2 つのノードだけ） */
export const shortestPathKept = (
  edges: Array<{ id: string; from: string; to: string }>,
  ends: [string, string],
): { nodes: Set<string>; wires: Set<string> } => {
  const distances = (start: string): Map<string, number> => {
    const dist = new Map([[start, 0]]);
    const queue = [start];
    for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
      const base = dist.get(at) ?? 0;
      for (const edge of edges) {
        const next =
          edge.from === at ? edge.to : edge.to === at ? edge.from : undefined;
        if (next !== undefined && !dist.has(next)) {
          dist.set(next, base + 1);
          queue.push(next);
        }
      }
    }
    return dist;
  };
  const [a, b] = ends;
  const fromA = distances(a);
  const fromB = distances(b);
  const total = fromA.get(b);
  const nodes = new Set([a, b]);
  const wires = new Set<string>();
  if (total === undefined) return { nodes, wires };
  for (const edge of edges) {
    for (const [u, v] of [
      [edge.from, edge.to],
      [edge.to, edge.from],
    ] as const) {
      const du = fromA.get(u);
      const dv = fromB.get(v);
      if (du === undefined || dv === undefined || du + 1 + dv !== total)
        continue;
      nodes.add(u);
      nodes.add(v);
      wires.add(edge.id);
    }
  }
  return { nodes, wires };
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
  for (const [id, minSize] of Object.entries(state.groupSizes))
    overrides[id] = { ...overrides[id], minSize };
  return overrides;
};

/** 範囲の書体と名前の文字の大きさ・太さで名前の 1 行の幅を canvas で測る関数（同じ文字の列は覚えて使い回す）と、覚えた幅を測り直して変わったかを返す関数 */
const textMeasurerOf = (
  range: HTMLElement,
): { measureText: MeasureText; remeasure: () => boolean } => {
  const context = document.createElement("canvas").getContext("2d");
  if (!context)
    throw new Error("名前の幅を測る canvas の 2D の描画を使えません");
  let widths = new Map<string, number>();
  let font: string | undefined;
  return {
    measureText: (text) => {
      const known = widths.get(text);
      if (known !== undefined) return known;
      font ??= `700 ${LABEL_METRICS.nameSize}px ${getComputedStyle(range).fontFamily}`;
      context.font = font;
      const width = context.measureText(text).width;
      widths.set(text, width);
      return width;
    },
    remeasure: () => {
      const before = widths;
      widths = new Map();
      font = undefined;
      return [...before].some(([text, width]) => {
        font ??= `700 ${LABEL_METRICS.nameSize}px ${getComputedStyle(range).fontFamily}`;
        context.font = font;
        return context.measureText(text).width !== width;
      });
    },
  };
};

/** 拡張の上書きに、種類の形状が pill のノードの左の余白を重ねる */
const withPaddings = (
  paddings: Record<string, MapOverride>,
  base: Record<string, MapOverride> | undefined,
): Record<string, MapOverride> => {
  const merged: Record<string, MapOverride> = { ...base };
  for (const [id, padding] of Object.entries(paddings))
    merged[id] = { ...padding, ...merged[id] };
  return merged;
};

/** 種類の形状が pill のノードの、左の余白の上書き */
const pillPaddings = (
  chart: Flowchart,
  kinds: Record<string, MapKind>,
): Record<string, MapOverride> =>
  Object.fromEntries(
    chart.nodes
      .filter((node) => {
        // 描く側と同じく、map.kinds にある最初のクラスの種類の形状で決める
        const name = node.classes.find((item) => item in kinds);
        return name !== undefined && kinds[name]?.shape === "pill";
      })
      .map((node) => [node.id, { padLeft: LABEL_METRICS.padPill }]),
  );

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

/** 絶対配置でなく、`display` が `none` でない子要素 */
const inFlowChildren = (element: HTMLElement): Element[] =>
  [...element.children].filter((child) => {
    const style = getComputedStyle(child);
    return (
      !["absolute", "fixed"].includes(style.position) &&
      style.display !== "none"
    );
  });

/**
 * ノードの中身が上下の余白と枠線の内側に入る高さから、ノードの高さを引いた量（px。配置の座標の単位）。
 * 中身の高さは、最初の子要素のマージンの上端から最後の子要素のマージンの下端までで、中身を上寄せにするノードも上下の中央に配置するノードも同じ量になる
 */
const contentOverflow = (element: HTMLElement): number => {
  const children = inFlowChildren(element);
  const first = children[0];
  const last = children.at(-1);
  if (!first || !last || element.offsetHeight === 0) return 0;
  const scale = element.getBoundingClientRect().height / element.offsetHeight;
  const top =
    first.getBoundingClientRect().top / scale -
    Number.parseFloat(getComputedStyle(first).marginTop);
  const bottom =
    last.getBoundingClientRect().bottom / scale +
    Number.parseFloat(getComputedStyle(last).marginBottom);
  const style = getComputedStyle(element);
  const frame = [
    style.paddingTop,
    style.paddingBottom,
    style.borderTopWidth,
    style.borderBottomWidth,
  ].reduce((sum, value) => sum + Number.parseFloat(value), 0);
  return bottom - top + frame - element.offsetHeight;
};

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
  Object.keys(state.wireShifts).length === 0 &&
  Object.keys(state.groupSizes).length === 0;

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
    // 選べるノードは、ノードの div に選んだかを付け、名前をノードを覆う押せる要素に付ける
    const focusable = element.querySelector(
      ":scope > .mdmark-diagram-node-hit",
    );
    if (focusable) {
      element.toggleAttribute("data-selected", selected.has(id));
      const name =
        element.querySelector(".mdmark-diagram-node-name")?.textContent ?? "";
      // 計画した変更のノードは、名前の末尾に変更の名前（バッジの文字）を保つ
      const change = element.querySelector(":scope > .mdmark-map-change");
      focusable.setAttribute(
        "aria-label",
        `${selectableName(name, selected.has(id))}${change === null ? "" : `、${change.textContent ?? ""}`}`,
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

/** キーで操作するノード。ノードの代わりに、リンク先を持つノードはリンク、持たないノードはノードを覆う押せる要素がフォーカスを受ける */
const nodeKeyTarget = (element: Element | undefined): KeyTarget | undefined => {
  const nodeElement = element?.closest(".mdmark-diagram-node[data-node]");
  const node = nodeElement?.getAttribute("data-node");
  if (!node) return undefined;
  const linked = nodeElement?.querySelector(".mdmark-diagram-node-link");
  const hit = nodeElement?.querySelector(":scope > .mdmark-diagram-node-hit");
  const selector = `[data-node="${CSS.escape(node)}"]`;
  const focusable = linked
    ? " .mdmark-diagram-node-link"
    : hit
      ? " > .mdmark-diagram-node-hit"
      : "";
  return {
    node,
    linked: linked !== null && linked !== undefined,
    selector: `${selector}${focusable}`,
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
  if (!target) return undefined;
  const corner = target.closest(".map-group-resize");
  if (
    !corner &&
    target.closest(
      "button, .mdmark-diagram-node-name, .map-er-columns, .map-class-members",
    )
  )
    return undefined;
  const node = target.closest("[data-node]")?.getAttribute("data-node");
  const wire = target.closest(".map-wire-hit")?.getAttribute("data-wire");
  const head = target.closest(".map-group-head, .map-group-bar");
  if (!node && !wire && !head && !corner) return undefined;
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
): {
  mode: "walkthrough" | "playback";
  unit?: "message" | "transition" | "relation";
} => ({
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

/** 閉じたグループの中のノードを最も外の閉じたグループに、描いていない線を両端を同じく付け替えた描いた線にする */
const visibleTargetOf = (
  context: { chart: Flowchart; layout: MapLayout; collapsed: string[] },
  target: { nodes: string[]; wires: string[] },
): { nodes: string[]; wires: string[] } => {
  const { chart, layout } = context;
  const closed = new Set(context.collapsed);
  const visible = (id: string): string => {
    let shown = id;
    let at =
      chart.nodes.find((node) => node.id === id)?.parent ?? parentOf(chart, id);
    for (; at !== undefined; at = parentOf(chart, at))
      if (closed.has(at)) shown = at;
    return shown;
  };
  const drawn = new Set(layout.wires.map((wire) => wire.id));
  const wires = target.wires.flatMap((id) => {
    if (drawn.has(id)) return [id];
    const edge = chart.edges.find((item) => item.id === id);
    if (!edge) return [];
    const from = visible(edge.from);
    const to = visible(edge.to);
    return layout.wires
      .filter((wire) => wire.from === from && wire.to === to)
      .map((wire) => wire.id);
  });
  return { nodes: [...new Set(target.nodes.map(visible))], wires };
};

/** 補足の changes のうち、図のノード・グループ・線の ID を指すものだけを残す（列・メンバーと無い ID を除く） */
const changesOf = (
  chart: Flowchart,
  data: MapData,
): Record<string, MapChange> => {
  const ids = new Set([
    ...chart.nodes.map((node) => node.id),
    ...chart.groups.map((group) => group.id),
    ...chart.edges.map((edge) => edge.id),
  ]);
  return Object.fromEntries(
    Object.entries(data.changes)
      .filter(([id]) => ids.has(id))
      .map(([id, change]) => [id, change.type]),
  );
};

/** ノードの Mermaid のクラスから、設定の map.kinds の種類の名前を返却する（無ければ undefined） */
const kindLabelOf = (
  chart: Flowchart,
  target: { id: string; kinds: Record<string, MapKind> },
): string | undefined => {
  const classes =
    chart.nodes.find((node) => node.id === target.id)?.classes ?? [];
  for (const name of classes) {
    const kind = target.kinds[name];
    if (kind !== undefined) return kind.label ?? name;
  }
  return undefined;
};

/** 構成図を読み取り、状態を読んで配置し、描いて測った大きさで配置し直し、操作を付ける */
export const attachMapFlow = (
  range: HTMLElement,
  config: ResolvedConfig,
  options: {
    args: MapArgs;
    onWalk?: () => void;
    extension?: MapFlowExtension;
    resolveIdLink?: ResolveIdLink;
  },
): MapFlowHandle => {
  const { args, onWalk, extension, resolveIdLink } = options;
  const { index, chart, data } = readFlowRange(range, extension);
  const kinds = { ...config.map.kinds, ...extension?.kinds };
  const lines = { ...config.map.lines, ...extension?.lines };
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
  const links = mapLinkProblems({
    links: chart.links,
    idLinks: { mode: "resolve", resolveIdLink },
  }).allowed;
  const wireLines = layoutValues(data, "line");
  const colors = layoutValues(data, "color");
  const changes = changesOf(chart, data);
  const sizes: Record<string, { w: number; h: number }> = {};
  const measurer = textMeasurerOf(range);
  const { measureText } = measurer;
  const paddings = pillPaddings(chart, kinds);
  let focus: { nodes: string[]; wires: string[] } | undefined;
  /** 指している線の ID */
  let hovered: string | undefined;
  /** 状態から自動配置し、拡張があれば線を引き直し、同じ区間の線を並べる */
  const placeOnce = (spread: number) => {
    const placed = layoutMap(
      chart,
      { collapsed: state.collapsed, entered: state.entered },
      {
        overrides: overridesOf(data, state, {
          sizes,
          base: withPaddings(
            paddings,
            extension?.overrides?.({
              collapsed: new Set(state.collapsed),
              widths: Object.fromEntries(
                Object.entries(data.layout).flatMap(([id, entry]) =>
                  entry.width === undefined ? [] : [[id, entry.width]],
                ),
              ),
              measureText,
            }),
          ),
        }),
        nodeFit: config.map.node_fit,
        spread,
        measureText,
      },
    );
    const rewired: MapLayout = extension?.rewire
      ? {
          ...placed,
          wires: extension.rewire(placed, { collapsed: state.collapsed }),
        }
      : placed;
    const separated = separateWires(rewired);
    return {
      layout: { ...rewired, wires: separated.wires },
      crowded: separated.crowded,
    };
  };
  /** 配置する: 並べた線が通り道に収まらなければ、足りない幅だけ間を広げて 1 回だけ配置し直す */
  const place = (): MapLayout => {
    const first = placeOnce(0);
    return first.crowded > 0 ? placeOnce(first.crowded).layout : first.layout;
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
      kinds,
      lines,
      wireLines,
      notes,
      annotations,
      hints: config.features.hints === true,
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
      changes,
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
      title: args.title ?? extension?.title ?? "",
      legend: [],
      wide: true,
      // 等倍より縮めず、収まらない分は図の枠の中で横にスクロールする
      fitMin: 1,
      tools: tools(),
      exportable: true,
      listable: true,
      id: frameId,
    },
    body(),
  );
  const detachList = attachMapList(range, {
    label: () =>
      `${range.querySelector(".mdmark-diagram-title")?.textContent ?? ""}の一覧`,
    items: () =>
      flowListItems({
        chart,
        notes,
        changes,
        kindLabel: (id) => kindLabelOf(chart, { id, kinds }),
      }),
  });
  linkAnnotationOwners(range);
  const figure = range.querySelector<HTMLElement>("figure") as HTMLElement;
  const detachDiagrams = attachDiagrams({
    root: range,
    placement: config.tooltips.diagramPlacement,
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
    const viewport = figure.querySelector<HTMLElement>(
      ".mdmark-diagram-viewport",
    );
    const zoom = viewport ? zoomControlOf(viewport) : undefined;
    const resized =
      stage !== null &&
      (stage.style.width !== `${part.width}px` ||
        stage.style.height !== `${part.height}px`);
    if (stage) {
      stage.innerHTML = part.html;
      stage.style.width = `${part.width}px`;
      stage.style.height = `${part.height}px`;
    }
    if (zoom) {
      // 中身の大きさが変わったら、倍率の文字を保って倍率と大きさのノードを合わせる
      if (resized) zoom.resize({ width: part.width, height: part.height });
    } else if (sizer) {
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
      ".mdmark-diagram-stage > .mdmark-diagram-node:is([data-node], .map-closed-group)",
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
          direction: wire.both
            ? "both"
            : (extension?.packetDirection?.(id) ?? "forward"),
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
          kinds,
          lines,
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
  /** 描いたノードと閉じたグループの中身を測り、見積もりより大きいものを測った大きさにして配置し直す */
  const measure = () => {
    let changed = false;
    const measured = [
      ...layout.nodes.map((node) => ({ item: node, attribute: "data-node" })),
      ...layout.groups
        .filter((group) => group.collapsed)
        .map((group) => ({ item: group, attribute: "data-group" })),
    ];
    for (const { item, attribute } of measured) {
      const element = figure.querySelector<HTMLElement>(
        `.mdmark-diagram-node[${attribute}="${CSS.escape(item.id)}"]`,
      );
      if (!element) continue;
      // 中身が上下の余白の内側に入る高さに足りない分を、高さに追加する
      const over = Math.ceil(contentOverflow(element));
      if (over > 1) {
        sizes[item.id] = { w: item.w, h: item.h + over };
        changed = true;
      }
    }
    if (changed) refresh();
  };
  measure();
  observeNodes();
  // 書体を読み込み終えたら名前の幅を測り直し、変わっていれば測った大きさを捨てて配置し直す
  let destroyed = false;
  void document.fonts?.ready.then(() => {
    if (destroyed || !measurer.remeasure()) return;
    for (const id of Object.keys(sizes)) delete sizes[id];
    refresh();
  });
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
  const select = (candidates: string[]) => {
    const ids = candidates.filter((id) => extension?.selectable?.(id) ?? true);
    if (ids.length === 0) return;
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
        groupSizes: {},
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
    // 指ではノード・グループ・線の区間を動かさず、指の移動を表示する枠のスクロールに任せる。動かさずに離したら選ぶ
    if (event.pointerType === "touch") {
      const from = { x: event.clientX, y: event.clientY };
      const release = (up: PointerEvent) => {
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", release);
        const distance = Math.hypot(up.clientX - from.x, up.clientY - from.y);
        if (up.type !== "pointerup" || distance > DRAG_THRESHOLD) return;
        if (node) select([node]);
        else if (wire) selectWire(wire);
      };
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", release);
      return;
    }
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
  /** グループの角で矢印キーを押して大きさを変える（Shift も押すと大きく） */
  const resizeWithKey = (
    group: string,
    key: { arrow: [number, number]; large: boolean },
  ) => {
    const step = key.large ? KEY_MOVE_PX_LARGE : KEY_MOVE_PX;
    const next = resizeByKey({
      layout,
      state,
      group,
      dw: key.arrow[0] * step,
      dh: key.arrow[1] * step,
    });
    if (!next) return;
    change(next);
    figure
      .querySelector<HTMLElement>(
        `[data-group="${CSS.escape(group)}"] .map-group-resize`,
      )
      ?.focus();
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
    const corner = element
      ?.closest(".map-group-resize")
      ?.closest("[data-group]")
      ?.getAttribute("data-group");
    if (corner && arrow) {
      event.preventDefault();
      resizeWithKey(corner, { arrow, large: event.shiftKey });
      return;
    }
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
      focus = focusOf(
        layout,
        visibleTargetOf({ chart, layout, collapsed: state.collapsed }, step),
      );
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
      apply: (step) => {
        applyStep(step, steps);
      },
      onStep: (step) => {
        follower.resume();
        follower.reveal(step.nodes);
      },
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
      destroyed = true;
      detachList();
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
