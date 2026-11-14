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
  sizes: Record<string, { w: number; h: number }>,
  base: Record<string, MapOverride> = {},
): Record<string, MapOverride> => {
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

/** 構成図を読み取り、状態を読んで配置し、描いて測った大きさで配置し直し、操作を付ける */
export const attachMapFlow = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
  onWalk?: () => void,
  extension?: MapFlowExtension,
): MapFlowHandle => {
  const index = Number(range.dataset.map ?? "1");
  const source = range.querySelector("code")?.textContent ?? "";
  const chart = extension?.chart ?? parseFlowchart(source);
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const ids = new Set([
    ...chart.nodes.map((node) => node.id),
    ...chart.groups.map((group) => group.id),
  ]);
  const storage =
    typeof sessionStorage === "undefined" ? undefined : sessionStorage;
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
  const wireLines = Object.fromEntries(
    Object.entries(data.layout).flatMap(([id, entry]) =>
      entry.line === undefined ? [] : [[id, entry.line]],
    ),
  );
  const colors = Object.fromEntries(
    Object.entries(data.layout).flatMap(([id, entry]) =>
      entry.color === undefined ? [] : [[id, entry.color]],
    ),
  );
  const sizes: Record<string, { w: number; h: number }> = {};
  let focus: { nodes: string[]; wires: string[] } | undefined;
  /** 指している線の ID */
  let hovered: string | undefined;
  /** 状態から自動配置し、拡張があれば線を引き直す */
  const place = (): MapLayout => {
    const placed = layoutMap(
      chart,
      { collapsed: state.collapsed, entered: state.entered },
      overridesOf(
        data,
        state,
        sizes,
        extension?.overrides?.({ collapsed: new Set(state.collapsed) }),
      ),
      config.map.node_fit,
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
      disabled:
        state.selected.length === 0 &&
        Object.keys(state.positions).length === 0 &&
        Object.keys(state.wireShifts).length === 0,
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
  const follower = createFollow(
    figure,
    typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

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
  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => measure());
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
    const pointed = layout.wires.find((wire) => wire.id === hovered);
    const kept = pointed
      ? {
          nodes: new Set([pointed.from, pointed.to]),
          wires: new Set([pointed.id]),
        }
      : selected.size > 0
        ? (extension?.selectionOf?.(selected) ?? {
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
          })
        : focus === undefined
          ? undefined
          : { nodes: new Set(focus.nodes), wires: new Set(focus.wires) };
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
    if (reset)
      reset.disabled =
        state.selected.length === 0 &&
        Object.keys(state.positions).length === 0 &&
        Object.keys(state.wireShifts).length === 0;
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
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const toggle = target?.closest<HTMLElement>("[data-group-toggle]");
    if (toggle) {
      toggleGroup(toggle.dataset.groupToggle ?? "", event.shiftKey);
      return;
    }
    // ノードの中身の開閉（ER 図のテーブルの列）。測った大きさを捨てて配置し直す
    const own = target?.closest<HTMLElement>("[data-node-toggle]");
    if (own) {
      const id = own.dataset.nodeToggle ?? "";
      delete sizes[id];
      const set = new Set(state.collapsed);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      change({ ...state, collapsed: [...set] });
      return;
    }
    const enter = target?.closest<HTMLElement>("[data-group-enter]");
    if (enter) {
      change({ ...state, entered: enter.dataset.groupEnter, selected: [] });
      return;
    }
    const tool = target?.closest<HTMLButtonElement>("[data-tool]");
    if (!tool || tool.disabled) return;
    if (tool.dataset.tool === "back" && state.entered !== undefined)
      change({ ...state, entered: parentOf(chart, state.entered) });
    else if (tool.dataset.tool === "expandAll")
      change({ ...state, collapsed: [] });
    else if (tool.dataset.tool === "collapseAll")
      change({
        ...state,
        collapsed: [
          ...chart.groups.map((group) => group.id),
          ...(extension?.collapsibles ?? []),
        ].filter((id) => id !== state.entered),
      });
    else if (tool.dataset.tool === "reset")
      change({
        ...state,
        selected: [],
        positions: {},
        wireShifts: {},
        attachments: {},
      });
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
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : undefined;
    if (
      !target ||
      target.closest("button, .mdmark-diagram-node-name, .map-er-columns")
    )
      return;
    const node = target.closest("[data-node]")?.getAttribute("data-node");
    const wire = target.closest(".map-wire-hit")?.getAttribute("data-wire");
    const head = target.closest(".map-group-head, .map-group-bar");
    if (!node && !wire && !head) return;
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
        else if (wire) {
          const item = layout.wires.find((one) => one.id === wire);
          if (item) select([item.from, item.to]);
        }
      },
    });
    const finish = () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      save();
      if (!moved || !node) return;
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
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  /** キーで操作する要素（ノード・グループのタイトルの行の帯・線） */
  const keyTargetOf = (element: Element | undefined) => {
    const nodeElement = element?.closest(".mdmark-diagram-node[data-node]");
    const node = nodeElement?.getAttribute("data-node");
    // リンク先を持つノードは、ノードの代わりにリンクがフォーカスを受ける
    if (node) {
      const linked = nodeElement?.querySelector(".mdmark-diagram-node-link");
      const selector = `[data-node="${CSS.escape(node)}"]`;
      return {
        node,
        linked: linked !== null && linked !== undefined,
        selector: linked ? `${selector} .mdmark-diagram-node-link` : selector,
      };
    }
    const group = element
      ?.closest(".map-group-bar")
      ?.closest("[data-group]")
      ?.getAttribute("data-group");
    if (group)
      return {
        group,
        selector: `[data-group="${CSS.escape(group)}"] .map-group-bar`,
      };
    const wire = element?.closest(".map-wire-hit")?.getAttribute("data-wire");
    if (wire)
      return {
        wire,
        selector: `.map-wire-hit[data-wire="${CSS.escape(wire)}"]`,
      };
    return undefined;
  };
  const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const element = event.target instanceof Element ? event.target : undefined;
    const keyTarget = keyTargetOf(element);
    const arrow = ARROWS[event.key];
    // Alt + 矢印キーで動かす（Shift も押すと大きく）
    if (keyTarget && arrow && event.altKey) {
      event.preventDefault();
      const step = event.shiftKey ? KEY_MOVE_PX_LARGE : KEY_MOVE_PX;
      const next = moveByKey({
        layout: { ...layout, wires: applyWireShifts(layout, state).wires },
        state,
        target: keyTarget,
        dx: arrow[0] * step,
        dy: arrow[1] * step,
      });
      if (!next) return;
      change(next);
      figure.querySelector<HTMLElement>(keyTarget.selector)?.focus();
      return;
    }
    // Enter・Space でノードを、Enter で線の両端を選ぶ
    if (
      keyTarget &&
      (event.key === "Enter" || (event.key === " " && keyTarget.node)) &&
      // リンクの Enter はリンクを開く
      !(event.key === "Enter" && keyTarget.linked)
    ) {
      if (keyTarget.node) {
        event.preventDefault();
        select([keyTarget.node]);
      } else if (keyTarget.wire) {
        event.preventDefault();
        const item = layout.wires.find((one) => one.id === keyTarget.wire);
        if (item) select([item.from, item.to]);
      }
      if (keyTarget.node || keyTarget.wire)
        figure.querySelector<HTMLElement>(keyTarget.selector)?.focus();
      return;
    }
    if (event.key !== "Escape") return;
    if (state.selected.length > 0) changeSelection([]);
    else if (state.entered !== undefined)
      change({ ...state, entered: parentOf(chart, state.entered) });
  };
  // 線の区間の上では、区間を動かせる向きのポインターにする（横の区間は上下、縦の区間は左右）
  const onPointerMove = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const hit = target?.closest<SVGPathElement>(".map-wire-hit[data-wire]");
    if (!hit) return;
    const wire = applyWireShifts(layout, state).wires.find(
      (item) => item.id === hit.dataset.wire,
    );
    const segment = wire && nearestSegment(wire, stagePoint(event));
    const a = segment === undefined ? undefined : wire?.points[segment];
    const b = segment === undefined ? undefined : wire?.points[segment + 1];
    hit.style.cursor =
      a && b ? (a[1] === b[1] ? "ns-resize" : "ew-resize") : "";
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
  const walkthroughs = extension?.walkthroughs ?? data.walkthroughs;
  if (walkthroughs.length > 0) {
    const steps: BandStep[] = walkthroughs.map((step) => ({
      title: step.title ?? "",
      text: step.text,
      nodes: step.nodes,
      wires: step.edges ?? [],
      enter: step.enter,
    }));
    band = attachBand({
      figure,
      mode: extension?.bandMode ?? "walkthrough",
      ...(extension?.bandUnit === undefined
        ? {}
        : { unit: extension.bandUnit }),
      steps,
      interval: args.interval,
      autoplay: args.play === "autoplay",
      reducedMotion:
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
      apply: (step) => {
        currentStep = step === undefined ? undefined : steps.indexOf(step);
        if (step !== undefined) {
          onWalk?.();
          walkFrom ??= { entered: state.entered };
        } else if (walkFrom !== undefined) {
          state = { ...state, entered: walkFrom.entered };
          walkFrom = undefined;
          save();
        }
        // 手順の enter のグループへ入り、enter を持たない手順は案内を始めた段の図で出す
        if (step !== undefined) {
          const entered = step.enter ?? walkFrom?.entered;
          if (entered !== state.entered) state = { ...state, entered };
        }
        focus =
          step === undefined
            ? undefined
            : {
                nodes: step.nodes,
                wires:
                  step.wires.length > 0
                    ? step.wires
                    : wiresBetween(layout, step.nodes),
              };
        refresh();
      },
    });
  }

  return {
    focus: (target) => {
      band?.stop();
      focus = {
        nodes: target.nodes,
        wires:
          target.wires.length > 0
            ? target.wires
            : wiresBetween(layout, target.nodes),
      };
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
