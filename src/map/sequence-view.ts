import type { ResolvedConfig } from "../config.ts";
import { attachDiagrams } from "../interact/diagrams.ts";
import { renderDiagramFrame } from "../parts/diagram.ts";
import { renderMapSequence, renderPackets } from "../parts/map.ts";
import { linkAnnotationOwners, readMapAnnotations } from "./annotations.ts";
import { attachBand, type BandHandle } from "./band.ts";
import { noteTexts, parseMapData } from "./data.ts";
import { DRAG_THRESHOLD_PX } from "./drag.ts";
import { replaceTips, termsOf } from "./flow-view.ts";
import { parseSequence, SEQ_ARROW_STYLES } from "./sequence.ts";
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

/** シーケンス図を読み取り、状態を読んで表示する行を決めて描き、ブロックの開閉・中だけを描く・参加者の選択と並べ替えを付ける */
export const attachMapSequence = (
  range: HTMLElement,
  config: ResolvedConfig,
  args: MapArgs,
  onStep?: (message: number | undefined) => void,
  follow?: { start: () => void; step: (message: number) => void },
): MapSequenceHandle => {
  const index = Number(range.dataset.map ?? "1");
  const sequence = parseSequence(
    range.querySelector("code")?.textContent ?? "",
  );
  const { data } = parseMapData(
    range.querySelector(".mdmark-map-data")?.textContent ?? undefined,
  );
  const initialOrder = sequence.participants.map((item) => item.id);
  const ids = new Set([
    ...initialOrder,
    ...sequence.fragments.map((_fragment, at) => String(at)),
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
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    if (suppressClick) {
      suppressClick = false;
      if (target?.closest(".map-participant")) return;
    }
    const toggle = target?.closest<HTMLElement>("[data-fragment-toggle]");
    if (toggle) {
      const at = Number(toggle.dataset.fragmentToggle);
      const targets = event.shiftKey ? fragmentsUnder(at) : [String(at)];
      const closing = !state.collapsed.includes(String(at));
      const set = new Set(state.collapsed);
      for (const item of targets) {
        if (closing) set.add(item);
        else set.delete(item);
      }
      change({ ...state, collapsed: [...set] });
      return;
    }
    const enter = target?.closest<HTMLElement>("[data-fragment-enter]");
    if (enter) {
      const at = enter.dataset.fragmentEnter ?? "";
      change({
        ...state,
        entered: at,
        collapsed: state.collapsed.filter((item) => item !== at),
      });
      return;
    }
    const tool = target?.closest<HTMLButtonElement>("[data-tool]");
    if (tool && !tool.disabled) {
      if (tool.dataset.tool === "back" && state.entered !== undefined) {
        const inner = sequence.fragments[Number(state.entered)];
        const outer = sequence.fragments
          .map((item, n) => ({ item, n }))
          .filter(
            ({ item }) =>
              inner !== undefined &&
              item.depth < inner.depth &&
              item.start <= inner.start &&
              inner.end <= item.end,
          )
          .at(-1);
        change({
          ...state,
          entered: outer === undefined ? undefined : String(outer.n),
        });
      } else if (tool.dataset.tool === "expandAll")
        change({ ...state, collapsed: [] });
      else if (tool.dataset.tool === "collapseAll") {
        const depth =
          state.entered === undefined
            ? 0
            : (sequence.fragments[Number(state.entered)]?.depth ?? -1) + 1;
        change({
          ...state,
          collapsed: sequence.fragments.flatMap((item, n) =>
            item.depth === depth && String(n) !== state.entered
              ? [String(n)]
              : [],
          ),
        });
      } else if (tool.dataset.tool === "reset")
        change({ ...state, order: undefined, selected: [] });
      return;
    }
    // 参加者の箱の名前の文字の外を押すと、その参加者を選ぶ
    const participant = target?.closest<HTMLElement>("[data-participant]");
    if (
      participant?.classList.contains("map-participant") &&
      !target?.closest(".mdmark-diagram-node-name")
    ) {
      toggleSelected([participant.dataset.participant ?? ""]);
      return;
    }
    // メッセージの線を押すと、送り手と受け手を選ぶ
    const hit = target?.closest<SVGElement>(".map-wire-hit[data-message]");
    if (hit) {
      const message = sequence.messages[Number(hit.dataset.message)];
      if (message) toggleSelected([message.from, message.to]);
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const participant = target?.closest<HTMLElement>(".map-participant");
    const id = participant?.dataset.participant;
    if (id !== undefined && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggleSelected([id]);
      return;
    }
    // Alt + 左右の矢印で並び順を変える（ブロックの中だけを描いているときは変えない）
    if (
      id !== undefined &&
      event.altKey &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
      state.entered === undefined
    ) {
      event.preventDefault();
      const list = order();
      const at = list.indexOf(id);
      const to = at + (event.key === "ArrowRight" ? 1 : -1);
      if (to < 0 || to >= list.length) return;
      [list[at], list[to]] = [list[to] as string, list[at] as string];
      change({ ...state, order: list });
      figure
        .querySelector<HTMLElement>(
          `[data-participant="${CSS.escape(id)}"].map-participant`,
        )
        ?.focus();
      return;
    }
    if (event.key === "Escape" && state.selected.length > 0)
      change({ ...state, selected: [] });
  };
  /** 参加者の箱の名前の文字の外を押したまま左右へ動かし（4px 動くまでは押した扱い）、離した位置に最も近い列へ移す */
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const head = target?.closest<HTMLElement>(".map-participant");
    const id = head?.dataset.participant;
    if (
      event.button !== 0 ||
      !head ||
      id === undefined ||
      state.entered !== undefined ||
      target?.closest(".mdmark-diagram-node-name, button")
    )
      return;
    const list = order();
    const at = list.indexOf(id);
    // 動かし始めたときの列の位置で判定する
    const rects = list.map(
      (name) =>
        figure
          .querySelector<HTMLElement>(
            `.map-participant[data-participant="${CSS.escape(name)}"]`,
          )
          ?.getBoundingClientRect() ?? head.getBoundingClientRect(),
    );
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
      const centers = rects.map((rect) => (rect.left + rect.right) / 2);
      to = centers.reduce(
        (best, center, index) =>
          Math.abs(center - move.clientX) <
          Math.abs((centers[best] ?? 0) - move.clientX)
            ? index
            : best,
        0,
      );
      const rect = rects[to];
      if (!marker || !rect || to === at) {
        if (marker) marker.hidden = true;
        return;
      }
      // 左へ移すときは移す先の列の左、右へ移すときは右に線を出す（図の倍率で割って図の座標にする）
      const base = container.getBoundingClientRect();
      const scale = base.width / (container.offsetWidth || base.width || 1);
      const edge = to < at ? rect.left - 8 : rect.right + 8;
      marker.style.left = `${(edge - base.left) / (scale || 1)}px`;
      marker.hidden = false;
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
    const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.setAttribute("class", "map-packets map-packets-hover");
    layer.innerHTML = renderPackets([
      {
        owner: `data-message="${at}"`,
        d: hit.getAttribute("d") ?? "",
        length: hit.getTotalLength(),
        fill: "var(--mdmark-color-diagram-line)",
        shape: "circle",
        direction: SEQ_ARROW_STYLES[message.arrow].both ? "both" : "forward",
      },
    ]);
    svg.append(layer);
    // 選択と再生の強調が無いときは、その線と送り手・受け手のほかを薄くする
    if (state.selected.length > 0 || current !== undefined) return;
    const kept = (element: Element): boolean => {
      const own = element.getAttribute("data-message");
      if (own !== null) return Number(own) === at;
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
      reducedMotion:
        typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-reduced-motion: reduce)").matches,
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
