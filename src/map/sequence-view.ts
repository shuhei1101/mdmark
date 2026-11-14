import type { ResolvedConfig } from "../config.ts";
import { attachDiagrams } from "../interact/diagrams.ts";
import { renderDiagramFrame } from "../parts/diagram.ts";
import { renderMapSequence, renderPackets } from "../parts/map.ts";
import { linkAnnotationOwners, readMapAnnotations } from "./annotations.ts";
import { attachBand, type BandHandle } from "./band.ts";
import { noteTexts, parseMapData } from "./data.ts";
import { DRAG_THRESHOLD_PX } from "./drag.ts";
import {
  prefersReducedMotion,
  replaceTips,
  sessionStorageOf,
  termsOf,
} from "./flow-view.ts";
import { parseSequence, type Sequence, SEQ_ARROW_STYLES } from "./sequence.ts";
import { sequenceRows } from "./sequence-rows.ts";
import type { MapArgs } from "./spec.ts";
import {
  emptyMapState,
  type MapState,
  readMapState,
  writeMapState,
} from "./state.ts";

/** 線を指している間だけ薄くした要素の class（離すと外す） */
const HOVER_DIM_CLASS = "map-hover-dim";
/** attachMapSequence の戻り値 */
export type MapSequenceHandle = {
  /** 補足の plays_over（再生を重ねる構成図の番号） */
  playsOver: number | undefined;
  /** 再生の強調を解く（構成図の案内を始めたとき） */
  clear: () => void;
  /** 時計と操作を外す */
  destroy: () => void;
};

/** 範囲の図の番号・Mermaid・補足を読む */
const readSequenceRange = (range: HTMLElement) => ({
  index: Number(range.dataset.map ?? "1"),
  sequence: parseSequence(range.querySelector("code")?.textContent ?? ""),
  data: parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  ).data,
});

/** 中だけを描いているブロックの、1 つ外のブロック（無ければ `undefined`） */
const outerFragmentOf = (
  sequence: Sequence,
  entered: string,
): string | undefined => {
  const inner = sequence.fragments[Number(entered)];
  if (inner === undefined) return undefined;
  const outer = sequence.fragments
    .map((item, n) => ({ item, n }))
    .filter(
      ({ item }) =>
        item.depth < inner.depth &&
        item.start <= inner.start &&
        inner.end <= item.end,
    )
    .at(-1);
  return outer === undefined ? undefined : String(outer.n);
};

/** 全て閉じるときに閉じるブロック（中だけを描いているブロックのすぐ内側の段） */
const collapsibleOf = (
  sequence: Sequence,
  entered: string | undefined,
): string[] => {
  const depth =
    entered === undefined
      ? 0
      : (sequence.fragments[Number(entered)]?.depth ?? -1) + 1;
  return sequence.fragments.flatMap((item, n) =>
    item.depth === depth && String(n) !== entered ? [String(n)] : [],
  );
};

/** Alt + 左右の矢印の向き（ほかのキーは 0） */
const sideStepOf = (event: KeyboardEvent): number => {
  if (!event.altKey) return 0;
  if (event.key === "ArrowRight") return 1;
  return event.key === "ArrowLeft" ? -1 : 0;
};

/** 並べ替えを始める参加者の箱（名前の文字とボタンの上と、左ボタンのほかでは始めない） */
const pressedHeadOf = (
  event: PointerEvent,
): { head: HTMLElement; id: string } | undefined => {
  const target = event.target instanceof Element ? event.target : undefined;
  const head = target?.closest<HTMLElement>(".map-participant");
  const id = head?.dataset.participant;
  if (event.button !== 0 || !head || id === undefined) return undefined;
  if (target?.closest(".mdmark-diagram-node-name, button")) return undefined;
  return { head, id };
};

/** 参加者の列の位置 */
const columnRectsOf = (
  figure: HTMLElement,
  columns: { list: string[]; head: HTMLElement },
): DOMRect[] =>
  columns.list.map(
    (name) =>
      figure
        .querySelector<HTMLElement>(
          `.map-participant[data-participant="${CSS.escape(name)}"]`,
        )
        ?.getBoundingClientRect() ?? columns.head.getBoundingClientRect(),
  );

/** 左右の位置に最も近い列 */
const nearestColumn = (rects: DOMRect[], x: number): number => {
  const centers = rects.map((rect) => (rect.left + rect.right) / 2);
  return centers.reduce(
    (best, center, index) =>
      Math.abs(center - x) < Math.abs((centers[best] ?? 0) - x) ? index : best,
    0,
  );
};

/** 移す先を示す線を出す。左へ移すときは移す先の列の左、右へ移すときは右に出し（図の倍率で割って図の座標にする）、移さないときは隠す */
const placeInsertLine = (
  marker: HTMLElement,
  place: {
    container: HTMLElement;
    rect: DOMRect | undefined;
    to: number;
    at: number;
  },
): void => {
  const { container, rect, to, at } = place;
  if (!rect || to === at) {
    marker.hidden = true;
    return;
  }
  const base = container.getBoundingClientRect();
  const scale = base.width / (container.offsetWidth || base.width || 1);
  const edge = to < at ? rect.left - 8 : rect.right + 8;
  marker.style.left = `${(edge - base.left) / (scale || 1)}px`;
  marker.hidden = false;
};

/** 指している線に流すデータの印の層 */
const hoverPacketLayer = (
  hit: SVGPathElement,
  message: { at: number; both: boolean },
): SVGGElement => {
  const { at, both } = message;
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("class", "map-packets map-packets-hover");
  layer.innerHTML = renderPackets([
    {
      owner: `data-message="${at}"`,
      d: hit.getAttribute("d") ?? "",
      length: hit.getTotalLength(),
      fill: "var(--mdmark-color-diagram-line)",
      shape: "circle",
      direction: both ? "both" : "forward",
    },
  ]);
  return layer;
};

/** 指しているメッセージの線と、送り手・受け手のほかを薄くする（指している間だけの class も付ける） */
const dimExceptMessage = (
  figure: HTMLElement,
  message: { at: number; from: string; to: string },
): void => {
  const kept = (element: Element): boolean => {
    const own = element.getAttribute("data-message");
    if (own !== null) return Number(own) === message.at;
    const name =
      element.getAttribute("data-participant") ??
      element.getAttribute("data-lifeline");
    return name === message.from || name === message.to;
  };
  for (const element of figure.querySelectorAll(
    ".mdmark-diagram-stage :is(.mdmark-diagram-wire[data-message], .mdmark-diagram-label[data-message], .map-participant, .mdmark-diagram-lifeline)",
  )) {
    if (kept(element) || element.classList.contains("map-dim")) continue;
    element.classList.add("map-dim", HOVER_DIM_CLASS);
  }
};

/** シーケンス図を読み取り、状態を読んで表示する行を決めて描き、ブロックの開閉・中だけを描く・参加者の選択と並べ替えを付ける */
export const attachMapSequence = (
  range: HTMLElement,
  config: ResolvedConfig,
  options: {
    args: MapArgs;
    onStep?: (message: number | undefined) => void;
    follow?: { start: () => void; step: (message: number) => void };
  },
): MapSequenceHandle => {
  const { args, onStep, follow } = options;
  const { index, sequence, data } = readSequenceRange(range);
  const initialOrder = sequence.participants.map((item) => item.id);
  const ids = new Set([
    ...initialOrder,
    ...sequence.fragments.map((_fragment, at) => String(at)),
  ]);
  const storage = sessionStorageOf();
  let state: MapState = {
    ...emptyMapState(),
    ...readMapState({
      index,
      ids,
      urlState: config.map.url_state,
      focus: args.focus,
      collapsed: [],
      storage,
      location,
    }),
  };
  let current: number | undefined;
  const order = () => {
    const known = new Set(initialOrder);
    const saved = (state.order ?? []).filter((id) => known.has(id));
    return [...saved, ...initialOrder.filter((id) => !saved.includes(id))];
  };
  const kinds = Object.fromEntries(
    sequence.participants.map((item) => [
      item.id,
      item.actor ? config.map.kinds.actor : undefined,
    ]),
  );
  const frameId = `map-${index}`;
  const terms = termsOf(range);
  const notes = noteTexts(data.notes);
  const annotations = readMapAnnotations({ range, notes: data.notes });
  const view = () => {
    const rows = sequenceRows(sequence, {
      order: order(),
      collapsed: state.collapsed.map(Number),
      entered: state.entered === undefined ? undefined : Number(state.entered),
    });
    const part = renderMapSequence({
      sequence,
      rows: rows.rows,
      participants: rows.participants,
      collapsed: state.collapsed.map(Number),
      entered: state.entered === undefined ? undefined : Number(state.entered),
      selected: state.selected,
      focus: current === undefined ? undefined : { message: current },
      kinds,
      id: frameId,
      terms,
      notes,
      annotations,
    });
    return { html: part.html, tips: part.tips, rows };
  };
  const tools = () => [
    {
      name: "back",
      label: "ブロックの外へ戻る",
      disabled: state.entered === undefined,
    },
    { name: "expandAll", label: "全てのブロックを開く" },
    { name: "collapseAll", label: "全てのブロックを閉じる" },
    {
      name: "reset",
      label: "参加者の並び順と選択を元に戻す",
      disabled:
        state.selected.length === 0 &&
        order().every((id, at) => id === initialOrder[at]),
    },
  ];
  const sizeOf = (html: string) => {
    const width = Number(/<svg[^>]*\swidth="([\d.]+)"/.exec(html)?.[1] ?? 0);
    const height = Number(/<svg[^>]*\sheight="([\d.]+)"/.exec(html)?.[1] ?? 0);
    return { width, height };
  };
  const first = view();
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
    { html: first.html, ...sizeOf(first.html), tips: first.tips },
  );
  linkAnnotationOwners(range);
  const figure = range.querySelector<HTMLElement>("figure") as HTMLElement;
  const detachDiagrams = attachDiagrams({
    root: range,
    placement: "bottom",
    figures: [figure],
  });
  const save = () =>
    writeMapState({
      index,
      state,
      urlState: config.map.url_state,
      storage,
      history,
      location,
    });
  const refresh = () => {
    const { html, tips, rows } = view();
    // 開閉・中だけを描くで再生するメッセージが変わったら、帯の手順を差し替えて再生を止める
    const next = shownMessages(rows);
    if (band && next.join(",") !== shown.join(",")) {
      shown = next;
      band.update(stepsOf(shown));
      if (current !== undefined) {
        current = undefined;
        onStep?.(undefined);
        refresh();
        return;
      }
    }
    const { width, height } = sizeOf(html);
    const stage = figure.querySelector<HTMLElement>(".mdmark-diagram-stage");
    const sizer = figure.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    if (stage) {
      stage.innerHTML = html;
      stage.style.width = `${width}px`;
      stage.style.height = `${height}px`;
    }
    if (sizer) {
      sizer.style.width = `${width}px`;
      sizer.style.height = `${height}px`;
    }
    replaceTips(figure, tips);
    linkAnnotationOwners(range);
    for (const item of tools()) {
      const button = figure.querySelector<HTMLButtonElement>(
        `[data-tool="${item.name}"]`,
      );
      if (button) button.disabled = item.disabled === true;
    }
  };
  const change = (next: MapState) => {
    state = next;
    save();
    refresh();
  };
  /** ブロックの中にあるブロック（自分を含む）の番号 */
  const fragmentsUnder = (at: number): string[] => {
    const outer = sequence.fragments[at];
    if (!outer) return [];
    return sequence.fragments.flatMap((item, n) =>
      item.start >= outer.start && item.end <= outer.end ? [String(n)] : [],
    );
  };
  const toggleSelected = (ids: string[]) => {
    const all = ids.every((id) => state.selected.includes(id));
    change({
      ...state,
      selected: all
        ? state.selected.filter((id) => !ids.includes(id))
        : [...new Set([...state.selected, ...ids])],
    });
  };
  /** 並べ替えのドラッグを離した直後の click で選ばない */
  let suppressClick = false;
  /** ブロックを開閉する（Shift を押すと中のブロックも） */
  const toggleFragment = (at: number, all: boolean) => {
    const targets = all ? fragmentsUnder(at) : [String(at)];
    const closing = !state.collapsed.includes(String(at));
    const set = new Set(state.collapsed);
    for (const item of targets) {
      if (closing) set.add(item);
      else set.delete(item);
    }
    change({ ...state, collapsed: [...set] });
  };
  /** ツールのボタンの操作 */
  const runTool = (name: string | undefined) => {
    if (name === "back" && state.entered !== undefined)
      change({ ...state, entered: outerFragmentOf(sequence, state.entered) });
    else if (name === "expandAll") change({ ...state, collapsed: [] });
    else if (name === "collapseAll")
      change({ ...state, collapsed: collapsibleOf(sequence, state.entered) });
    else if (name === "reset")
      change({ ...state, order: undefined, selected: [] });
  };
  /** ブロックのタブのボタンとツールのボタンなら操作し、`true` を返却する */
  const clickControl = (target: Element | undefined, all: boolean) => {
    const toggle = target?.closest<HTMLElement>("[data-fragment-toggle]");
    if (toggle) {
      toggleFragment(Number(toggle.dataset.fragmentToggle), all);
      return true;
    }
    const enter = target?.closest<HTMLElement>("[data-fragment-enter]");
    if (enter) {
      const at = enter.dataset.fragmentEnter ?? "";
      change({
        ...state,
        entered: at,
        collapsed: state.collapsed.filter((item) => item !== at),
      });
      return true;
    }
    const tool = target?.closest<HTMLButtonElement>("[data-tool]");
    if (!tool || tool.disabled) return false;
    runTool(tool.dataset.tool);
    return true;
  };
  /** 参加者の箱の名前の文字の外を押すとその参加者を、メッセージの線を押すと送り手と受け手を選ぶ */
  const clickSelect = (target: Element | undefined) => {
    const participant = target?.closest<HTMLElement>("[data-participant]");
    if (
      participant?.classList.contains("map-participant") &&
      !target?.closest(".mdmark-diagram-node-name")
    ) {
      toggleSelected([participant.dataset.participant ?? ""]);
      return;
    }
    const hit = target?.closest<SVGElement>(".map-wire-hit[data-message]");
    if (!hit) return;
    const message = sequence.messages[Number(hit.dataset.message)];
    if (message) toggleSelected([message.from, message.to]);
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (suppressClick) {
      suppressClick = false;
      if (target?.closest(".map-participant")) return;
    }
    if (clickControl(target, event.shiftKey)) return;
    clickSelect(target);
  };
  /** 参加者を左右へ 1 つ移す */
  const moveParticipant = (id: string, step: number) => {
    const list = order();
    const at = list.indexOf(id);
    const to = at + step;
    if (to < 0 || to >= list.length) return;
    [list[at], list[to]] = [list[to] as string, list[at] as string];
    change({ ...state, order: list });
    figure
      .querySelector<HTMLElement>(
        `[data-participant="${CSS.escape(id)}"].map-participant`,
      )
      ?.focus();
  };
  /** 参加者の上のキー操作（Enter・Space で選び、Alt + 左右の矢印で並び順を変える）。操作したら `true` を返却する */
  const participantKey = (id: string, event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSelected([id]);
      return true;
    }
    // ブロックの中だけを描いているときは並び順を変えない
    const step = sideStepOf(event);
    if (step === 0 || state.entered !== undefined) return false;
    event.preventDefault();
    moveParticipant(id, step);
    return true;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const id =
      target?.closest<HTMLElement>(".map-participant")?.dataset.participant;
    if (id !== undefined && participantKey(id, event)) return;
    if (event.key === "Escape" && state.selected.length > 0)
      change({ ...state, selected: [] });
  };
  /** 参加者の箱の名前の文字の外を押したまま左右へ動かし（4px 動くまでは押した扱い）、離した位置に最も近い列へ移す */
  const onPointerDown = (event: PointerEvent) => {
    const pressed =
      state.entered === undefined ? pressedHeadOf(event) : undefined;
    if (!pressed) return;
    const { head, id } = pressed;
    const list = order();
    const at = list.indexOf(id);
    // 動かし始めたときの列の位置で判定する
    const rects = columnRectsOf(figure, { list, head });
    const container = head.parentElement as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    let to = at;
    let marker: HTMLElement | undefined;
    const onMove = (move: PointerEvent) => {
      if (
        !dragging &&
        Math.hypot(move.clientX - startX, move.clientY - startY) <
          DRAG_THRESHOLD_PX
      )
        return;
      if (!dragging) {
        dragging = true;
        marker = document.createElement("div");
        marker.className = "map-insert-line";
        marker.hidden = true;
        container.append(marker);
        head.classList.add("is-dragging");
      }
      head.style.translate = `${move.clientX - startX}px 0`;
      to = nearestColumn(rects, move.clientX);
      if (marker)
        placeInsertLine(marker, { container, rect: rects[to], to, at });
    };
    const release = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      head.style.translate = "";
      head.classList.remove("is-dragging");
      marker?.remove();
    };
    // ブラウザが指のドラッグを文書のスクロールに切り替えたときは、並び順を変えずに戻す
    const onCancel = () => release();
    const onUp = () => {
      release();
      if (!dragging) return;
      suppressClick = true;
      if (to === at) return;
      const next = [...list];
      next.splice(at, 1);
      next.splice(to, 0, id);
      change({ ...state, order: next });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };
  // メッセージの線を指している間は、その線にデータの印を流す（選択・再生で流している線には重ねない）
  const onPointerOver = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const hit = target?.closest<SVGPathElement>(".map-wire-hit[data-message]");
    const at = Number(hit?.dataset.message);
    const message = sequence.messages[at];
    if (!hit || !message) return;
    const svg = hit.ownerSVGElement;
    if (!svg || svg.querySelector(`.map-packet[data-message="${at}"]`)) return;
    svg.append(
      hoverPacketLayer(hit, { at, both: SEQ_ARROW_STYLES[message.arrow].both }),
    );
    // 選択と再生の強調が無いときは、その線と送り手・受け手のほかを薄くする
    if (state.selected.length > 0 || current !== undefined) return;
    dimExceptMessage(figure, { at, from: message.from, to: message.to });
  };
  const onPointerOut = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (!target?.closest(".map-wire-hit")) return;
    for (const layer of figure.querySelectorAll(".map-packets-hover"))
      layer.remove();
    for (const element of figure.querySelectorAll(`.${HOVER_DIM_CLASS}`))
      element.classList.remove("map-dim", HOVER_DIM_CLASS);
  };
  figure.addEventListener("click", onClick);
  figure.addEventListener("pointerdown", onPointerDown);
  figure.addEventListener("keydown", onKeyDown);
  figure.addEventListener("pointerover", onPointerOver);
  figure.addEventListener("pointerout", onPointerOut);

  let band: BandHandle | undefined;
  /** 再生で進めるメッセージ（閉じたブロックと、中だけを描くブロックの外のメッセージを除く） */
  const shownMessages = (rows: ReturnType<typeof sequenceRows>): number[] =>
    rows.rows.flatMap((row) => (row.kind === "message" ? [row.message] : []));
  let shown = shownMessages(first.rows);
  const stepsOf = (messages: number[]) =>
    messages.flatMap((at) => {
      const message = sequence.messages[at];
      if (!message) return [];
      return [
        {
          title: message.text,
          text: [
            `${sequence.participants.find((item) => item.id === message.from)?.label ?? message.from} → ${sequence.participants.find((item) => item.id === message.to)?.label ?? message.to}`,
            data.notes[String(at + 1)]?.text ?? "",
          ]
            .filter((line) => line !== "")
            .join("\n"),
          nodes: [message.from, message.to],
          wires: [String(at)],
          enter: undefined,
        },
      ];
    });
  if (sequence.messages.length > 0) {
    band = attachBand({
      figure,
      mode: "playback",
      steps: stepsOf(shown),
      interval: args.interval,
      autoplay: args.play === "autoplay",
      reducedMotion: prefersReducedMotion(),
      apply: (step) => {
        current =
          step === undefined ? undefined : Number(step.wires[0] ?? Number.NaN);
        if (Number.isNaN(current)) current = undefined;
        refresh();
        onStep?.(current);
      },
      ...(follow === undefined
        ? {}
        : {
            follow: {
              start: follow.start,
              step: (step) => {
                const message = Number(step.wires[0] ?? Number.NaN);
                if (!Number.isNaN(message)) follow.step(message);
              },
            },
          }),
    });
  }

  return {
    playsOver: data.plays_over,
    clear: () => band?.stop(),
    destroy: () => {
      band?.destroy();
      detachDiagrams();
      figure.removeEventListener("click", onClick);
      figure.removeEventListener("pointerdown", onPointerDown);
      figure.removeEventListener("keydown", onKeyDown);
      figure.removeEventListener("pointerover", onPointerOver);
      figure.removeEventListener("pointerout", onPointerOut);
    },
  };
};
