import type {
  MdmarkDiagramNode,
  MdmarkDiagramWire,
  MdmarkFlowDefinition,
} from "../diagram/definition.ts";
import type { MapLayout } from "../map/layout.ts";
import {
  SEQ_ARROW_STYLES,
  type Sequence,
  type SequenceFragment,
  type SequenceMessage,
} from "../map/sequence.ts";
import type { SequenceRow } from "../map/sequence-rows.ts";
import type { MapKind, MapLine } from "../map/spec.ts";
import { renderFlow } from "./diagram.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 線の上を流れるデータの印 */
export type MapPacketMark = {
  wire: string;
  color: string;
  shape: "circle" | "square" | "diamond";
  reverse: boolean;
};

/** 部品『mapの構成図』の引数 */
export type MapFlowArgs = {
  layout: MapLayout;
  /** 設定の map.kinds（Mermaid のクラスごとのノードの種類） */
  kinds: Record<string, MapKind>;
  /** 設定の map.lines（矢印ごとと名前ごとの線の種類） */
  lines: Record<string, MapLine>;
  /** 補足の layout の line（線の ID ごとの線の種類の名前） */
  wireLines?: Record<string, string> | undefined;
  /** 補足の notes（ID ごとの説明） */
  notes?: Record<string, string> | undefined;
  collapsed: string[];
  entered: string | undefined;
  selected: string[];
  focus: { nodes: string[]; wires: string[] } | undefined;
  packets: MapPacketMark[];
  dragging: string | undefined;
  /** 図の番号（ツールチップと矢じりの id の頭） */
  id?: string | undefined;
};

/** 開閉の山形のボタン */
const disclosure = (id: string, title: string, expanded: boolean): string =>
  `<button class="map-disclosure" type="button" data-group-toggle="${escapeHtml(id)}" aria-expanded="${expanded}" aria-label="${escapeHtml(`${title}を${expanded ? "閉じる" : "開く"}`)}" title="${expanded ? "閉じる" : "開く"}">${iconSvg(expanded ? "chevron-down" : "chevron-right")}</button>`;

/** グループのタイトル。今入っているグループは押せない文字にする */
const groupTitle = (id: string, title: string, current: boolean): string =>
  current
    ? `<span class="map-group-title is-current">${escapeHtml(title)}</span>`
    : `<button class="map-group-title" type="button" data-group-enter="${escapeHtml(id)}" aria-label="${escapeHtml(`${title}の中へ入る`)}" title="中へ入る">${escapeHtml(title)}</button>`;

/** 強調するノードと線（選択が強調より優先する） */
const keptOf = (
  args: MapFlowArgs,
): { nodes: Set<string>; wires: Set<string> } | undefined => {
  const selected = new Set(args.selected);
  if (selected.size > 0) {
    const wires = args.layout.wires.filter((wire) =>
      selected.size === 1
        ? selected.has(wire.from) || selected.has(wire.to)
        : selected.has(wire.from) && selected.has(wire.to),
    );
    return { nodes: selected, wires: new Set(wires.map((wire) => wire.id)) };
  }
  if (args.focus === undefined) return undefined;
  return {
    nodes: new Set(args.focus.nodes),
    wires: new Set(args.focus.wires),
  };
};

/** 描いた HTML の、属性 `{name}="{id}"` を持つ要素の class に名前を足す */
const addClass = (
  html: string,
  attribute: string,
  id: string,
  name: string,
): string => {
  const value = escapeHtml(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(
    new RegExp(
      `<([a-z]+) class="([^"]*)"([^>]*\\s${attribute}="${value}")`,
      "g",
    ),
    (_all, tag: string, classes: string, rest: string) =>
      `<${tag} class="${classes} ${name}"${rest}`,
  );
};

/** 部品『mapの構成図』の HTML。フロー図の部品の定義にしたノードと線を renderFlow で描き、グループの面とタイトルの行・開閉と中へ入るボタン・閉じたグループを重ねる */
export const renderMapFlow = (args: MapFlowArgs): string => {
  const { layout } = args;
  const kindOf = (classes: string[] | undefined): MapKind | undefined => {
    const name = (classes ?? []).find((item) => item in args.kinds);
    return name === undefined ? undefined : args.kinds[name];
  };
  const open = layout.groups.filter((group) => !group.collapsed);
  const closed = layout.groups.filter((group) => group.collapsed);
  const nodes: MdmarkDiagramNode[] = layout.nodes.map((node) => {
    const kind = kindOf(node.classes);
    const note = args.notes?.[node.id];
    return {
      id: node.id,
      kind: "script",
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
      name: node.label ?? node.lines.join(""),
      style: {
        label: kind?.label,
        icon: kind?.icon,
        shape: kind?.shape,
        color: kind?.color,
      },
      ...(note === undefined ? {} : { hint: note }),
    };
  });
  const wires: MdmarkDiagramWire[] = layout.wires.map((wire) => {
    const named = args.wireLines?.[wire.id];
    const line =
      (named === undefined ? undefined : args.lines[named]) ??
      args.lines[wire.arrow ?? "-->"] ??
      {};
    const tip = [
      ...(wire.merged ?? []).map(
        (item) =>
          `${item.from} → ${item.to}${item.label ? `：${item.label}` : ""}`,
      ),
      ...(args.notes?.[wire.id] === undefined ? [] : [args.notes[wire.id]]),
    ].join("\n");
    return {
      id: wire.id,
      from: wire.from,
      to: wire.to,
      line: "flow",
      points: wire.points,
      ...(wire.merged === undefined && wire.label !== undefined
        ? { label: wire.label }
        : {}),
      ...(tip === "" ? {} : { tip }),
      style: { ...line, both: wire.both ?? false },
    };
  });
  const definition: MdmarkFlowDefinition = {
    title: "",
    scope: "",
    updated: "",
    width: layout.width,
    height: layout.height,
    nodes,
    wires,
  };
  let html = renderFlow(definition, args.id ?? "map", true).html;
  for (const node of layout.nodes) {
    if (node.faded) html = addClass(html, "data-node", node.id, "map-faded");
  }
  const kept = keptOf(args);
  if (kept) {
    for (const node of layout.nodes) {
      if (!kept.nodes.has(node.id))
        html = addClass(html, "data-node", node.id, "map-dim");
    }
    for (const wire of layout.wires) {
      if (!kept.wires.has(wire.id))
        html = addClass(html, "data-wire", wire.id, "map-dim");
    }
  }
  for (const id of args.selected)
    html = addClass(html, "data-node", id, "is-selected");
  if (args.dragging !== undefined)
    html = addClass(html, "data-node", args.dragging, "is-dragging");
  // グループは外側から順に、線とノードの下に重ねる
  const groups = [...open]
    .sort((a, b) => a.ancestors.length - b.ancestors.length)
    .map((group) => {
      const current = group.id === args.entered;
      const classes = `map-group${group.faded ? " map-faded" : ""}${current ? " is-entered" : ""}${args.dragging === group.id ? " is-dragging" : ""}`;
      return `<div class="${classes}" data-group="${escapeHtml(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><div class="map-group-head">${disclosure(group.id, group.title, true)}${groupTitle(group.id, group.title, current)}</div></div>`;
    })
    .join("");
  // 閉じたグループは、二重の枠線の 1 つのノードにする（本数とラベルは出さない）
  const closedHtml = closed
    .map(
      (group) =>
        `<div class="mdmark-diagram-node map-closed-group${group.faded ? " map-faded" : ""}" data-group="${escapeHtml(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><div class="map-group-head">${disclosure(group.id, group.title, false)}${groupTitle(group.id, group.title, false)}</div></div>`,
    )
    .join("");
  const packets = args.packets
    .map(
      (packet) =>
        `<span class="map-packet" data-wire="${escapeHtml(packet.wire)}" data-shape="${packet.shape}" data-reverse="${packet.reverse}" style="--map-packet-color:${escapeHtml(packet.color)}"></span>`,
    )
    .join("");
  // 線を押す・指す場所: 見える線より太い透明の線（区間の移動にも使う）
  const hits = layout.wires
    .map(
      (wire) =>
        `<path class="map-wire-hit" data-wire="${escapeHtml(wire.id)}" d="${wire.points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join("")}"></path>`,
    )
    .join("");
  const hitLayer = `<svg class="map-wire-hits" width="${layout.width}" height="${layout.height}">${hits}</svg>`;
  return `${groups}${html}${hitLayer}${closedHtml}${packets}`;
};

/** 部品『案内の帯』の引数 */
export type MapBandArgs = {
  mode: "walkthrough" | "playback";
  total: number;
  index: number | undefined;
  title: string;
  text: string;
  auto: boolean;
  label: string;
};

/** モードごとのボタンのスクリーンリーダー向けの名前 */
const NAMES = {
  walkthrough: { prev: "前の手順", stop: "案内をやめる", next: "次の手順" },
  playback: {
    prev: "前のメッセージ",
    stop: "再生をやめる",
    next: "次のメッセージ",
  },
} as const;

/** 部品『案内の帯』の HTML */
export const renderMapBand = (args: MapBandArgs): string => {
  const names = NAMES[args.mode];
  const button = (
    action: string,
    label: string,
    icon: Parameters<typeof iconSvg>[0],
    extra = "",
  ) =>
    `<button class="mdmark-diagram-tool" type="button" data-band="${action}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"${extra}>${iconSvg(icon)}</button>`;
  const count = `${args.index === undefined ? "–" : args.index + 1}/${args.total}`;
  const title = `<strong class="map-band-title"${args.title === "" ? " hidden" : ""}>${escapeHtml(args.title)}</strong>`;
  const text = `<p class="map-band-text" aria-live="polite"${args.text === "" ? " hidden" : ""}>${escapeHtml(args.text)}</p>`;
  const actions = [
    button("prev", names.prev, "chevron-left"),
    button(
      "stop",
      names.stop,
      "square",
      args.index === undefined ? ' disabled="disabled"' : "",
    ),
    button(
      "auto",
      args.auto ? "一時停止" : "自動で進める",
      args.auto ? "pause" : "play",
      ` aria-pressed="${args.auto}"`,
    ),
    button("next", names.next, "chevron-right"),
  ].join("");
  return `<div class="map-band" role="region" aria-label="${escapeHtml(args.label)}" data-mode="${args.mode}"><div class="map-band-head"><span class="map-band-count">${count}</span>${title}<div class="map-band-actions">${actions}</div></div>${text}</div>`;
};

/** 部品『mapのシーケンス図』の引数 */
export type MapSequenceArgs = {
  sequence: Sequence;
  rows: SequenceRow[];
  participants: string[];
  collapsed: number[];
  entered: number | undefined;
  selected: string[];
  focus: { message: number } | undefined;
  /** 設定の map.kinds を参加者の ID で引いた種類 */
  kinds?: Record<string, MapKind | undefined> | undefined;
  /** 図の番号（矢じりの id の頭） */
  id?: string | undefined;
};

/** シーケンス図の寸法（px） */
export const MAP_SEQ = {
  colGap: 180,
  firstX: 92,
  headW: 150,
  headH: 56,
  headTop: 16,
  rowH: 52,
  firstY: 116,
  pad: 24,
} as const;

/** ブロックのタブの中身（rect は名前だけ） */
const fragmentTitle = (fragment: SequenceFragment): string =>
  `${fragment.kind === "rect" ? "" : `<b>${fragment.kind}</b> `}${escapeHtml(fragment.label)}`;

/** 部品『mapのシーケンス図』の HTML。参加者・ライフライン・メッセージに、ブロックのタブの開閉と名前のボタン・区間・注記・活性化の帯・参加者の選択を重ねる */
export const renderMapSequence = (args: MapSequenceArgs): string => {
  const { sequence, rows, participants } = args;
  const id = args.id ?? "map-seq";
  const x = new Map(
    participants.map((name, index) => [
      name,
      MAP_SEQ.firstX + index * MAP_SEQ.colGap,
    ]),
  );
  const rowY = (index: number) => MAP_SEQ.firstY + index * MAP_SEQ.rowH;
  const lastX =
    MAP_SEQ.firstX + Math.max(0, participants.length - 1) * MAP_SEQ.colGap;
  const width = lastX + MAP_SEQ.headW / 2 + MAP_SEQ.pad * 4;
  const height =
    rowY(Math.max(0, rows.length - 1)) + MAP_SEQ.rowH + MAP_SEQ.pad;
  const selected = new Set(args.selected);
  const related = (message: SequenceMessage) =>
    selected.size === 0
      ? undefined
      : selected.size === 1
        ? selected.has(message.from) || selected.has(message.to)
        : selected.has(message.from) && selected.has(message.to);
  const rowOfMessage = new Map<number, number>();
  rows.forEach((row, at) => {
    if (row.kind === "message") rowOfMessage.set(row.message, at);
  });
  const under: string[] = [];
  const above: string[] = [];
  const overlay: string[] = [];
  /** ブロックが囲む左右（関わる参加者の列） */
  const spanOf = (fragment: SequenceFragment): [number, number] => {
    const xs = sequence.messages
      .slice(fragment.start, fragment.end)
      .flatMap((message) => [x.get(message.from), x.get(message.to)])
      .filter((value): value is number => value !== undefined);
    const pad = 70 - fragment.depth * 10;
    return xs.length === 0
      ? [MAP_SEQ.firstX - pad, lastX + pad]
      : [Math.min(...xs) - pad, Math.max(...xs) + pad];
  };
  const tab = (
    fragment: SequenceFragment,
    index: number,
    expanded: boolean,
    left: number,
    top: number,
    extra = "",
  ) => {
    const label = `${fragment.kind}「${fragment.label}」`;
    const body =
      index === args.entered
        ? `<span class="map-seq-fragment-title is-current">${fragmentTitle(fragment)}</span>`
        : `<button class="map-disclosure" type="button" data-fragment-toggle="${index}" aria-expanded="${expanded}" aria-label="${escapeHtml(`${label}を${expanded ? "閉じる" : "開く"}`)}">${iconSvg(expanded ? "chevron-down" : "chevron-right")}</button><button class="map-seq-fragment-title" type="button" data-fragment-enter="${index}" aria-label="${escapeHtml(`${label}の中だけを見る`)}" title="このブロックの中だけを見る">${fragmentTitle(fragment)}</button>`;
    return `<span class="map-seq-fragment-tab" data-kind="${fragment.kind}" data-fragment="${index}" style="left:${left}px;top:${top}px">${body}${extra}</span>`;
  };
  rows.forEach((row, at) => {
    if (row.kind === "collapsed") {
      const fragment = sequence.fragments[row.fragment];
      if (!fragment) return;
      const [left, right] = spanOf(fragment);
      const top = rowY(at) - 30;
      under.push(
        `<rect class="map-seq-fragment is-collapsed" x="${left}" y="${top}" width="${right - left}" height="40" rx="4"></rect>`,
      );
      overlay.push(
        tab(
          fragment,
          row.fragment,
          false,
          left,
          top,
          `<span class="map-seq-fragment-count">メッセージ ${row.count} 件</span>`,
        ),
      );
    } else if (row.kind === "fragment") {
      const fragment = sequence.fragments[row.fragment];
      if (!fragment) return;
      const [left, right] = spanOf(fragment);
      const inside = rows
        .map((item, index) => ({ item, index }))
        .filter(
          ({ item }) =>
            (item.kind === "message" &&
              fragment.start <= item.message &&
              item.message < fragment.end) ||
            (item.kind === "collapsed" &&
              (sequence.fragments[item.fragment]?.start ?? -1) >=
                fragment.start &&
              (sequence.fragments[item.fragment]?.end ?? Infinity) <=
                fragment.end),
        );
      const lastRow = Math.max(at, ...inside.map(({ index }) => index));
      const top = rowY(at) - 30;
      const bottom = rowY(lastRow) + 14;
      under.push(
        `<rect class="map-seq-fragment${fragment.kind === "rect" ? " is-rect" : ""}" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="4"></rect>`,
      );
      overlay.push(tab(fragment, row.fragment, true, left, top));
    } else if (row.kind === "section") {
      const fragment = sequence.fragments[row.fragment];
      const section = fragment?.sections[row.section];
      if (!fragment || !section) return;
      const [left, right] = spanOf(fragment);
      const y = rowY(at) - 14;
      under.push(
        `<line class="map-seq-section" x1="${left}" x2="${right}" y1="${y}" y2="${y}"></line>`,
      );
      overlay.push(
        `<span class="map-seq-section-label" style="left:${left + 8}px;top:${y + 2}px">[${escapeHtml(section.label)}]</span>`,
      );
    } else if (row.kind === "note") {
      const note = sequence.notes[row.note];
      if (!note) return;
      const xs = note.of
        .map((name) => x.get(name))
        .filter((value): value is number => value !== undefined);
      if (xs.length === 0) return;
      const [left, right] =
        note.placement === "left"
          ? [(xs[0] as number) - 170, (xs[0] as number) - 16]
          : note.placement === "right"
            ? [(xs[0] as number) + 16, (xs[0] as number) + 170]
            : [Math.min(...xs) - 60, Math.max(...xs) + 60];
      overlay.push(
        `<div class="map-seq-note" style="left:${left}px;top:${rowY(at) - 32}px;width:${right - left}px">${escapeHtml(note.text)}</div>`,
      );
    }
  });
  // 活性化の帯: 参加者の縦線の上に、始まりの行から終わりの行まで（入れ子は右へずらす）
  const rowOf = (message: number) =>
    rowOfMessage.get(message) ??
    rows.findIndex(
      (row) =>
        row.kind === "collapsed" &&
        (sequence.fragments[row.fragment]?.start ?? Infinity) <= message &&
        message < (sequence.fragments[row.fragment]?.end ?? -1),
    );
  for (const activation of sequence.activations) {
    const center = x.get(activation.id);
    const start = rowOf(activation.start);
    const end = rowOf(activation.end);
    if (center === undefined || start < 0 || end < 0) continue;
    const left = center - 5 + activation.depth * 6;
    above.push(
      `<rect class="map-seq-activation" x="${left}" y="${rowY(start)}" width="10" height="${Math.max(12, rowY(end) - rowY(start))}"></rect>`,
    );
  }
  const activeEdge = (
    name: string,
    message: number,
    at: number,
    towards: number,
  ) => {
    const depths = sequence.activations
      .filter(
        (item) =>
          item.id === name && item.start <= message && message <= item.end,
      )
      .map((item) => item.depth);
    if (depths.length === 0) return at;
    return towards > at ? at + 5 + Math.max(...depths) * 6 : at - 5;
  };
  const wires: string[] = [];
  const labels: string[] = [];
  const dimByPlay = args.focus !== undefined && selected.size === 0;
  for (const [message, at] of rowOfMessage) {
    const item = sequence.messages[message];
    if (!item) continue;
    const x1 = x.get(item.from);
    const x2 = x.get(item.to);
    if (x1 === undefined || x2 === undefined) continue;
    const y = rowY(at);
    const style = SEQ_ARROW_STYLES[item.arrow];
    const hit = related(item);
    const dim =
      hit === false || (dimByPlay && message !== args.focus?.message)
        ? " map-dim"
        : "";
    const self = item.from === item.to;
    const start = self ? x1 : activeEdge(item.from, message, x1, x2);
    const end = self ? x2 : activeEdge(item.to, message, x2, x1);
    const d = self
      ? `M${x1} ${y - 8}H${x1 + 40}V${y + 8}H${x1 + 4}`
      : `M${start} ${y}H${end + Math.sign(start - end)}`;
    const head =
      style.head === "none"
        ? ""
        : ` marker-end="url(#${id}-head-${style.head})"`;
    const both = style.both
      ? ` marker-start="url(#${id}-head-${style.head})"`
      : "";
    wires.push(
      `<path class="mdmark-diagram-wire${dim}" data-line="map" data-message="${message}" d="${d}"${style.dotted ? ' stroke-dasharray="6 4"' : ""} stroke-width="1.5"${head}${both}></path><path class="map-wire-hit" data-message="${message}" d="${d}"></path>`,
    );
    const number = sequence.autonumber ? `${message + 1} ` : "";
    labels.push(
      `<span class="mdmark-diagram-label${dim}" data-message="${message}" style="left:${(start + end) / 2}px;top:${y - 14}px">${escapeHtml(`${number}${item.text}`)}</span>`,
    );
  }
  const focusEnds =
    args.focus === undefined
      ? undefined
      : sequence.messages[args.focus.message];
  const lifelines = participants
    .map((name) => {
      const dim =
        (selected.size > 0 && !selected.has(name)) ||
        (dimByPlay &&
          focusEnds !== undefined &&
          name !== focusEnds.from &&
          name !== focusEnds.to)
          ? " map-dim"
          : "";
      return `<line class="mdmark-diagram-lifeline${dim}" data-lifeline="${escapeHtml(name)}" x1="${x.get(name)}" y1="${MAP_SEQ.headTop + MAP_SEQ.headH}" x2="${x.get(name)}" y2="${height - 12}"></line>`;
    })
    .join("");
  const markers = (["filled", "cross", "async"] as const)
    .map((head) => {
      const shape =
        head === "filled"
          ? '<path d="M0,0 L9,4.5 L0,9 z"></path>'
          : head === "cross"
            ? '<path d="M1,1 L8,8 M8,1 L1,8" fill="none" stroke-width="1.5"></path>'
            : '<path d="M1,1 L8,4.5 L1,8" fill="none" stroke-width="1.5"></path>';
      return `<marker id="${id}-head-${head}" class="mdmark-diagram-arrowhead" data-head="${head}" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker>`;
    })
    .join("");
  const labelOf = (name: string) =>
    sequence.participants.find((item) => item.id === name)?.label ?? name;
  const heads = participants
    .map((name) => {
      const kind = args.kinds?.[name];
      const icon =
        kind?.icon === undefined
          ? ""
          : `<span class="mdmark-map-icon" data-icon="${escapeHtml(kind.icon)}" aria-hidden="true"></span>`;
      const tag =
        kind?.label === undefined
          ? ""
          : `<span>${escapeHtml(kind.label)}</span>`;
      const dim =
        (selected.size > 0 && !selected.has(name)) ||
        (dimByPlay &&
          focusEnds !== undefined &&
          name !== focusEnds.from &&
          name !== focusEnds.to)
          ? " map-dim"
          : "";
      return `<div class="mdmark-diagram-node map-participant map-kinded${dim}${selected.has(name) ? " is-selected" : ""}" data-kind="map" data-shape="${kind?.shape ?? "rounded"}"${kind?.color === undefined ? "" : ` data-color="${escapeHtml(kind.color)}"`} data-node="${escapeHtml(name)}" data-participant="${escapeHtml(name)}" role="button" tabindex="0" aria-pressed="${selected.has(name)}" style="left:${(x.get(name) ?? 0) - MAP_SEQ.headW / 2}px;top:${MAP_SEQ.headTop}px;width:${MAP_SEQ.headW}px"><span class="mdmark-diagram-node-kind${icon === "" && tag === "" ? " is-empty" : ""}">${icon}${tag}</span><span class="mdmark-diagram-node-name">${escapeHtml(labelOf(name))}</span></div>`;
    })
    .join("");
  return [
    `<svg class="mdmark-diagram-wires" width="${width}" height="${height}" aria-hidden="true"><defs>${markers}</defs><g class="map-seq-under">${under.join("")}</g>${lifelines}${wires.join("")}<g class="map-seq-above">${above.join("")}</g></svg>`,
    labels.join(""),
    overlay.join(""),
    `<div class="mdmark-diagram-seq-heads" style="width:${width}px;height:${MAP_SEQ.headTop + MAP_SEQ.headH + 8}px">${heads}</div>`,
  ].join("");
};
