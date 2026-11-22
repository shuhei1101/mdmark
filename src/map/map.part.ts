import type {
  MdmarkDiagramNode,
  MdmarkDiagramWire,
  MdmarkFlowDefinition,
  MdmarkMermaidShape,
} from "../diagram/definition.ts";
import {
  createTips,
  type DiagramAnnotation,
  type DiagramAnnotations,
  groupInfo,
  infoLabel,
  ownerIdAttribute,
  renderFlow,
  renderText,
  safeCssColor,
  type TermLookup,
  type TipList,
} from "../diagram/diagram.part.ts";
import { NOTE_OWNER_PREFIX, noteOwnerId } from "../footnote/footnote.part.ts";
import { isColorName } from "../shared/colors.logic.ts";
import { escapeHtml } from "../shared/escape.logic.ts";
import { iconNodeSvg, type MdmarkIconNode } from "../shared/icon-node.logic.ts";
import { bundledIconNode, iconSvg } from "../shared/icons.part.ts";
import type {
  AxisGrid,
  AxisGridItem,
  AxisGridSection,
  AxisGridSelection,
} from "./axis-grid.ts";
import {
  AXIS_GRID_LAYOUT,
  type AxisGridFrame,
  type AxisGridLayout,
  type AxisGridPlacement,
} from "./axis-grid-layout.ts";
import type { MapChange } from "./data.ts";
import {
  estimateTextWidth,
  LABEL_METRICS,
  MAP_LAYOUT,
  type MapLayout,
} from "./layout.ts";
import {
  type MermaidNodeStyle,
  type MermaidWireStyle,
  textColorOn,
} from "./mermaid-style.ts";
import type { Mindmap, MindmapItem } from "./mindmap.ts";
import type { MindmapLayout, MindmapPlacement } from "./mindmap-layout.ts";
import { MINDMAP_LAYOUT } from "./mindmap-layout.ts";
import {
  DEFAULT_PACKET_STYLE,
  type PacketFill,
  type PacketPath,
  type PacketShape,
  type PacketStyle,
  renderPackets,
  resolvePacketMark,
} from "./packet.ts";
import {
  SEQ_ARROW_STYLES,
  type Sequence,
  type SequenceArrowStyle,
  type SequenceFragment,
  type SequenceMessage,
  type SequenceNote,
} from "./sequence.ts";
import type { SequenceRow } from "./sequence-rows.ts";
import type { MapKind, MapLine } from "./spec.ts";

/** 線の上を流れるデータの印。color は色の名前か line・source・target（省く・知らない値は線の番号の色）、shape・fill を省くと線の番号と設定で決める */
export type MapPacketMark = {
  wire: string;
  direction: "forward" | "backward" | "both";
  color: string | undefined;
  shape: PacketShape | undefined;
  fill?: PacketFill | undefined;
};

/** 線の既定の色 */
const LINE_FILL = "var(--mdmark-color-diagram-line)";

/** 色の名前を CSS 変数にする。色の名前の一覧に無い値は undefined（利用側の文字を CSS の値にそのまま埋めない） */
export const colorVar = (
  name: string | undefined,
  tone: "text" | "bg" = "text",
): string | undefined =>
  name !== undefined && isColorName(name)
    ? `var(--mdmark-color-accent-${name}-${tone})`
    : undefined;

/** 折れ線の SVG の経路と長さ */
const polyline = (points: Array<[number, number]>) => ({
  d: points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
    .join(""),
  length: points
    .slice(1)
    .reduce(
      (sum, [x, y], index) =>
        sum +
        Math.hypot(
          x - (points[index] as [number, number])[0],
          y - (points[index] as [number, number])[1],
        ),
      0,
    ),
});

/** 部品『mapの構成図』の引数 */
export type MapFlowArgs = {
  layout: MapLayout;
  /** 用語から意味（`data-map-terms`）。ノードの名前の中の用語に下線を付ける */
  terms?: Record<string, string> | undefined;
  /** 設定の map.kinds（Mermaid のクラスごとのノードの種類） */
  kinds: Record<string, MapKind>;
  /** 設定の map.lines（矢印ごとと名前ごとの線の種類） */
  lines: Record<string, MapLine>;
  /** 補足の layout の line（線の ID ごとの線の種類の名前） */
  wireLines?: Record<string, string> | undefined;
  /** 補足の notes（ノード・グループ・線の ID ごとの説明） */
  notes?: Record<string, string> | undefined;
  /** 補足の notes の annotations（要素の ID ごとの注記。番号の順） */
  annotations?: Record<string, DiagramAnnotation[]> | undefined;
  /** 機能 `hints` がオンか（既定 `true`）。オフなら説明と注記のツールチップとマーカーを作らず、注記の持ち主の `id` を要素そのものに付ける */
  hints?: boolean | undefined;
  /** `mapLinkProblems` が許したノードのリンク先 */
  links?: Record<string, string> | undefined;
  /** 補足の layout の color（グループの ID ごとの色の名前） */
  colors?: Record<string, string> | undefined;
  collapsed: string[];
  entered: string | undefined;
  selected: string[];
  focus: { nodes: string[]; wires: string[] } | undefined;
  packets: MapPacketMark[];
  dragging: string | undefined;
  /** 図の番号（ツールチップと矢じりの id の頭） */
  id?: string | undefined;
  /** 閉じたグループの名前の後ろの文字（無ければ「ノード {数} 件」） */
  collapsedTag?: ((groupId: string) => string | undefined) | undefined;
  /** ノードの ID ごとの状態遷移図の形状（`start`・`end`・`choice` は名前と種類の行を出さずフォーカスを持たない。`note` は種類の行「ノート」） */
  shapes?: Record<string, MapStateShape> | undefined;
  /** ノードの ID ごとに、種類の行の末尾とノードの末尾へ入れる HTML と、そのツールチップ */
  nodeParts?: Record<string, MapNodePart> | undefined;
  /** 選択と強調の代わりに残すノードと線（ほかを薄くする） */
  keep?: { nodes: string[]; wires: string[] } | undefined;
  /** 補足の changes のノード・グループ・線の ID ごとの計画した変更 */
  changes?: Record<string, MapChange> | undefined;
  /** Mermaid の `style`・`classDef`・`linkStyle` の色（線はその線の ID から） */
  styles?: MapMermaidStyles | undefined;
  /** 設定の map.packets（無いときは `{ fill: "tinted", palette: "accent" }`） */
  packetStyle?: PacketStyle | undefined;
};

/** renderMapFlow に渡す Mermaid の色（`readMermaidStyles` の戻り値の、線の番号を線の ID に置き換えたもの） */
export type MapMermaidStyles = {
  nodes: Record<string, MermaidNodeStyle>;
  wires: Record<string, MermaidWireStyle>;
  defaultWire?: MermaidWireStyle | undefined;
};

/** 状態遷移図のノードの形状（`junction` はアーキテクチャ図の分岐点） */
export type MapStateShape =
  | "start"
  | "end"
  | "choice"
  | "note"
  | "junction"
  | "fork";

/** ノードの中へ入れる HTML（`head` は種類の行の末尾、`body` はノードの末尾） */
export type MapNodePart = { head: string; body: string; tips: string };

/** 形状ごとの読み上げる名前 */
const STATE_SHAPE_NAMES = {
  start: "開始",
  end: "終了",
  choice: "分岐",
  note: "ノート",
  junction: "分岐点",
  fork: "並行の分岐と合流",
} satisfies Record<MapStateShape, string>;

/** html の index から始まる要素の、対応する閉じタグの位置（無ければ -1） */
const closingOf = (html: string, index: number, tag: string): number => {
  const pattern = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  pattern.lastIndex = index;
  let depth = 0;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] === "/" ? -1 : 1;
    if (depth === 0) return match.index;
  }
  return -1;
};

/** ノードの種類の行の末尾と、ノードの末尾へ HTML を入れる */
const insertNodePart = (
  html: string,
  id: string,
  part: MapNodePart,
): string => {
  const at = html.indexOf(`data-node="${escapeHtml(id)}"`);
  const start = at < 0 ? -1 : html.lastIndexOf("<div", at);
  const end = start < 0 ? -1 : closingOf(html, start, "div");
  if (end < 0) return html;
  let node = html.slice(start, end);
  const kindAt = node.indexOf('<span class="mdmark-diagram-node-kind');
  if (kindAt >= 0 && part.head !== "") {
    const kindEnd = closingOf(node, kindAt, "span");
    node =
      `${node.slice(0, kindEnd)}${part.head}${node.slice(kindEnd)}`.replace(
        'class="mdmark-diagram-node-kind is-empty"',
        'class="mdmark-diagram-node-kind"',
      );
  }
  return `${html.slice(0, start)}${node}${part.body}${html.slice(end)}`;
};

/** 開閉の山形のボタン */
const disclosure = (id: string, title: string, expanded: boolean): string =>
  `<button class="map-disclosure" type="button" data-group-toggle="${escapeHtml(id)}" aria-expanded="${expanded}" aria-label="${escapeHtml(`${title}を${expanded ? "閉じる" : "開く"}`)}" title="${expanded ? "閉じる" : "開く"}">${iconSvg(expanded ? "chevron-down" : "chevron-right")}</button>`;

/** グループのタイトル。今入っているグループは押せない文字にする。`ownerId` は `hints` がオフのときの注記の持ち主の `id` */
const groupTitle = (
  group: { id: string; title: string },
  current: boolean,
  ownerId?: string,
): string => {
  const { id, title } = group;
  const owner = ownerId === undefined ? "" : ` id="${escapeHtml(ownerId)}"`;
  return current
    ? `<span class="map-group-title is-current"${owner}${ownerId === undefined ? "" : ' tabindex="-1"'}>${escapeHtml(title)}</span>`
    : `<button class="map-group-title" type="button"${owner} data-group-enter="${escapeHtml(id)}" aria-label="${escapeHtml(`${title}の中へ入る`)}" title="中へ入る">${escapeHtml(title)}</button>`;
};

/** `hints` がオフのとき、注記を持つ要素の持ち主の `id`（オンか注記を持たなければ `undefined`） */
const plainOwnerId = (
  args: {
    hints?: boolean | undefined;
    annotations?: Record<string, DiagramAnnotation[]> | undefined;
    id?: string | undefined;
  },
  elementId: string,
): string | undefined =>
  args.hints === false && (args.annotations?.[elementId]?.length ?? 0) > 0
    ? noteOwnerId(noteOwnerPrefix(args.id), elementId)
    : undefined;

/** 強調するノードと線（選択が強調より優先する） */
const keptOf = (
  args: MapFlowArgs,
): { nodes: Set<string>; wires: Set<string> } | undefined => {
  if (args.keep !== undefined)
    return { nodes: new Set(args.keep.nodes), wires: new Set(args.keep.wires) };
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

/** 描いた HTML の、`data-node="{value}"` のノードに `data-selected` を付ける（`value` は正規表現に逃がした ID） */
const markSelected = (html: string, value: string): string =>
  html.replace(
    new RegExp(
      `(<div class="[^"]*map-kinded[^"]*"[^>]*\\sdata-node="${value}")`,
    ),
    "$1 data-selected",
  );

/** ID を逃がして、正規表現に入れる値にする */
const regExpValue = (id: string): string =>
  escapeHtml(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 描いた HTML の、属性 `{attribute}="{id}"` を持つ要素の class に `name` を足す */
const addClass = (
  html: string,
  target: { attribute: string; id: string; name: string },
): string => {
  const { attribute, id, name } = target;
  return html.replace(
    new RegExp(
      `<([a-z]+) class="([^"]*)"([^>]*\\s${attribute}="${regExpValue(id)}")`,
      "g",
    ),
    (_all: string, ...groups: string[]) => {
      const [tag = "", classes = "", rest = ""] = groups;
      return `<${tag} class="${classes} ${name}"${rest}`;
    },
  );
};

/** Mermaid のクラスから、設定の map.kinds の種類を返却する（無ければ `undefined`） */
const kindOf = (
  kinds: Record<string, MapKind>,
  classes: string[] | undefined,
): MapKind | undefined => {
  const name = (classes ?? []).find((item) => item in kinds);
  return name === undefined ? undefined : kinds[name];
};

/** 構成図の線 1 本 */
type MapWire = MapLayout["wires"][number];

/** 線の種類（補足の layout の line の名前を、矢印ごとの種類より優先する） */
const wireLineOf = (
  args: Pick<MapFlowArgs, "lines" | "wireLines">,
  wire: MapWire,
): MapLine | undefined => {
  const named = args.wireLines?.[wire.id];
  return (
    (named === undefined ? undefined : args.lines[named]) ??
    args.lines[wire.arrow ?? "-->"]
  );
};

/** 構成図の線の上のデータの印の SVG。線の番号・出発点のノードの色・設定の塗り方から見た目を決める */
export const renderMapPackets = (
  args: Pick<
    MapFlowArgs,
    | "layout"
    | "kinds"
    | "lines"
    | "wireLines"
    | "colors"
    | "styles"
    | "packetStyle"
  >,
  marks: MapPacketMark[],
): string => {
  const { layout } = args;
  const style = args.packetStyle ?? DEFAULT_PACKET_STYLE;
  const nodeColor = (id: string): string | undefined => {
    const node = layout.nodes.find((item) => item.id === id);
    return (
      colorVar(kindOf(args.kinds, node?.classes)?.color) ??
      args.styles?.nodes[id]?.fill
    );
  };
  const colored = layout.nodes.some((node) => nodeColor(node.id) !== undefined);
  const packetPaths = marks.flatMap((packet): PacketPath[] => {
    const index = layout.wires.findIndex((item) => item.id === packet.wire);
    const wire = layout.wires[index];
    if (!wire) return [];
    const lineColor = colorVar(
      args.colors?.[wire.id] ?? wireLineOf(args, wire)?.color,
    );
    const color =
      packet.color === "source"
        ? nodeColor(wire.from)
        : packet.color === "target"
          ? nodeColor(wire.to)
          : packet.color === "line"
            ? (lineColor ?? LINE_FILL)
            : colorVar(packet.color);
    return [
      {
        owner: `data-wire="${escapeHtml(wire.id)}"`,
        ...polyline(wire.points),
        mark: resolvePacketMark({
          index,
          wire: wire.id,
          style,
          override: { color, shape: packet.shape, fill: packet.fill },
          sourceColor: nodeColor(wire.from),
          colored,
        }),
        direction: packet.direction,
      },
    ];
  });
  return renderPackets(packetPaths);
};

/** 部品の HTML と、図の枠の `.mdmark-diagram-box` に配置するツールチップの HTML */
export type MapPart = { html: string; tips: string };

/** 文字の中の用語（`terms` のキー。長い用語を先に照合する）を `{{用語}}` で囲む */
const markTerms = (text: string, words: string[]): string => {
  if (words.length === 0) return text;
  let out = "";
  let at = 0;
  while (at < text.length) {
    const word = words.find((item) => text.startsWith(item, at));
    if (word === undefined) {
      out += text[at];
      at += 1;
    } else {
      out += `{{${word}}}`;
      at += word.length;
    }
  }
  return out;
};

/** ツールチップの説明の文（逃がした HTML）の中の用語を、フォーカスを持たない下線にし、末尾に「{用語}：{意味}」の行を並べる */
const markTipTerms = (
  tips: string,
  terms: Record<string, string> | undefined,
): string => {
  const words = Object.keys(terms ?? {}).sort((a, b) => b.length - a.length);
  if (words.length === 0) return tips;
  return tips.replace(
    /<span class="mdmark-term-tip-meaning">([\s\S]*?)<\/span>/g,
    (whole, text: string) => {
      const used: string[] = [];
      let out = "";
      let at = 0;
      while (at < text.length) {
        const word = words.find((item) =>
          text.startsWith(escapeHtml(item), at),
        );
        if (word === undefined) {
          out += text[at];
          at += 1;
          continue;
        }
        if (!used.includes(word)) used.push(word);
        out += `<span class="mdmark-term">${escapeHtml(word)}</span>`;
        at += escapeHtml(word).length;
      }
      if (used.length === 0) return whole;
      const lines = used
        .map(
          (word) =>
            `<span class="mdmark-term-tip-meaning map-tip-term"><span class="mdmark-term">${escapeHtml(word)}</span>：${escapeHtml(terms?.[word] ?? "")}</span>`,
        )
        .join("");
      return `<span class="mdmark-term-tip-meaning">${out}</span>${lines}`;
    },
  );
};

/** 用語の下線を付けるための、用語の並び・意味の参照・ツールチップ */
type TermMarker = {
  /** 文字を逃がし、用語を `span.mdmark-term` にした HTML */
  render: (text: string) => string;
  tips: TipList;
};

/** `terms`（用語から意味）の下線を付ける関数と、そのツールチップ */
const termMarker = (
  terms: Record<string, string> | undefined,
  id: string,
): TermMarker => {
  const words = Object.keys(terms ?? {}).sort((a, b) => b.length - a.length);
  const lookup: TermLookup = (word) => terms?.[word];
  const tips = createTips(`${id}-term`);
  const found = { terms: false };
  return {
    render: (text) =>
      renderText(markTerms(text, words), { tips, lookup, found }),
    tips,
  };
};

/** 構成図のノードで使うキー（選ぶ・動かす） */
const MAP_NODE_KEYS =
  "Enter Space Alt+ArrowLeft Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight";

/** リンク先を持つノードのリンクのキー操作（Enter はリンクを開く） */
const MAP_LINK_KEYS =
  "Space Alt+ArrowLeft Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight";

/** 選べるノード・参加者のスクリーンリーダー向けの名前（選んでいれば末尾に「（選択中）」） */
export const selectableName = (name: string, selected: boolean): string =>
  selected ? `${name}（選択中）` : name;

/** 図の番号（`map-{図の通し番号}`）から、注記の持ち主の `id` の頭 */
export const noteOwnerPrefix = (id: string | undefined): string =>
  `${NOTE_OWNER_PREFIX}${(id ?? "map").replace(/^map-/, "")}-`;

/** 構成図の要素の名前を引く関数 */
type FlowNames = {
  /** ノード・グループの ID から名前（無ければ ID） */
  nameOf: (id: string) => string;
  /** 線の押せる帯のスクリーンリーダー向けの名前 */
  wireName: (wire: MapWire) => string;
};

/** 構成図の要素の名前を引く関数を返却する */
const flowNamesOf = (layout: MapLayout): FlowNames => {
  const names = new Map<string, string>([
    ...layout.groups.map((group): [string, string] => [group.id, group.title]),
    ...layout.nodes.map((node): [string, string] => [
      node.id,
      node.label ?? node.lines.join(""),
    ]),
  ]);
  const nameOf = (id: string): string => names.get(id) ?? id;
  return {
    nameOf,
    wireName: (wire) =>
      `${nameOf(wire.from)}から${nameOf(wire.to)}への線${wire.merged === undefined && wire.label !== undefined ? `「${wire.label}」` : ""}`,
  };
};

/** 構成図のノード 1 つ */
type MapNode = MapLayout["nodes"][number];

/** renderFlow に渡すノード（`notes` の説明を `hint`、`links` のリンク先を `href` にする） */
const flowNode = (args: MapFlowArgs, node: MapNode): MdmarkDiagramNode => {
  const note = args.notes?.[node.id];
  const href = args.links?.[node.id];
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    name: node.label ?? node.lines.join(""),
    style: flowNodeStyle(args, node),
    ...(note === undefined ? {} : { hint: note }),
    ...(href === undefined ? {} : { href }),
  };
};

/** Mermaid の面・枠線・文字の色（`color` が無く `fill` があるときの文字は `textColorOn`。`changed` なら枠線を持たせない） */
const mermaidPaint = (
  painted: MermaidNodeStyle | undefined,
  changed: boolean,
): { fill?: string; stroke?: string; text?: string } => {
  if (painted === undefined) return {};
  const text =
    painted.color ??
    (painted.fill === undefined ? undefined : textColorOn(painted.fill));
  return {
    ...(painted.fill === undefined ? {} : { fill: painted.fill }),
    ...(painted.stroke === undefined || changed
      ? {}
      : { stroke: painted.stroke }),
    ...(text === undefined ? {} : { text }),
  };
};

/** ノードの種類の行・アイコン・形状・色 */
const flowNodeStyle = (
  args: MapFlowArgs,
  node: MapNode,
): MdmarkDiagramNode["style"] => {
  const kind = kindOf(args.kinds, node.classes) ?? {};
  const note = args.shapes?.[node.id] === "note";
  // 計画した変更を持つノードは、変更の色の枠線を優先する
  const changed = args.changes?.[node.id] !== undefined;
  return {
    label: note ? STATE_SHAPE_NAMES.note : kind.label,
    icon: kind.icon,
    // layoutMap は map の種類の形状に無い Mermaid の形状だけを持たせる
    shape: (node.shape as MdmarkMermaidShape | undefined) ?? kind.shape,
    color: args.colors?.[node.id] ?? kind.color,
    ...mermaidPaint(args.styles?.nodes[node.id], changed),
  };
};

/** 線の横に置くラベルと線の間（px）、ラベルの高さ（px）、ラベルの左右の余白と枠線の幅（px） */
const LABEL_BESIDE = { gap: 6, height: 20, inset: 14 } as const;

/** ラベルの文字の幅の見積もり（px。12px の文字） */
const labelWidth = (text: string): number =>
  (estimateTextWidth(text) * 12) / LABEL_METRICS.nameSize + LABEL_BESIDE.inset;

/** 線の最も長い区間より長いラベルを、横の区間は線の上、縦の区間は線の右に置く中心（短いラベルは undefined） */
const besideLabelAt = (
  points: Point[],
  text: string,
): [number, number] | undefined => {
  let best: { from: Point; to: Point; length: number } | undefined;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) continue;
    const length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    if (!best || length > best.length) best = { from, to, length };
  }
  const width = labelWidth(text);
  if (!best || width <= best.length) return undefined;
  const mid: [number, number] = [
    (best.from[0] + best.to[0]) / 2,
    (best.from[1] + best.to[1]) / 2,
  ];
  return best.from[1] === best.to[1]
    ? [mid[0], mid[1] - LABEL_BESIDE.gap - LABEL_BESIDE.height / 2]
    : [mid[0] + LABEL_BESIDE.gap + width / 2, mid[1]];
};

/** renderFlow に渡す線（まとめた線のラベルは出さない） */
const flowWire = (args: MapFlowArgs, wire: MapWire): MdmarkDiagramWire => {
  const line = wireLineOf(args, wire) ?? {};
  const tip = flowWireTip(args, wire);
  return {
    id: wire.id,
    from: wire.from,
    to: wire.to,
    points: wire.points,
    ...(wire.merged === undefined && wire.label !== undefined
      ? flowLabel(wire.points, wire.label)
      : {}),
    ...(tip === "" ? {} : { tip }),
    style: {
      ...line,
      color: args.colors?.[wire.id] ?? line.color,
      both: wire.both ?? false,
      ...(wire.ends === undefined ? {} : { ends: wire.ends }),
      ...wirePaint(args, wire.id),
    },
  };
};

/** 線のラベルと、線より長いラベルの線の横の位置 */
const flowLabel = (
  points: Point[],
  label: string,
): Pick<MdmarkDiagramWire, "label" | "labelAt" | "beside"> => {
  const at = besideLabelAt(points, label);
  return at === undefined ? { label } : { label, labelAt: at, beside: true };
};

/** 線の Mermaid の色（`linkStyle {番号}` を `linkStyle default` に重ねる。計画した変更を持つ線は変更の色を優先する） */
const wirePaint = (
  args: MapFlowArgs,
  id: string,
): { stroke?: string; text?: string } => {
  const paint = { ...args.styles?.defaultWire, ...args.styles?.wires[id] };
  return {
    ...(paint.stroke === undefined || args.changes?.[id] !== undefined
      ? {}
      : { stroke: paint.stroke }),
    ...(paint.color === undefined ? {} : { text: paint.color }),
  };
};

/** 線の説明。まとめた線は、補足の notes に説明を持つ元の線だけを並べる */
const flowWireTip = (args: MapFlowArgs, wire: MapWire): string => {
  const own = args.notes?.[wire.id];
  return [
    ...(wire.merged ?? []).flatMap((item) => {
      const note = args.notes?.[`${item.from}->${item.to}`];
      return note === undefined || note === ""
        ? []
        : [`${item.fromLabel} → ${item.toLabel}：${note}`];
    }),
    ...(own === undefined ? [] : [own]),
  ].join("\n");
};

/** ラベルを持たない線の説明とまとめた元の線、注記だけを持つ線の、線の押せる帯を持ち主にしたツールチップと、ツールチップを持つ線 */
const flowWireTips = (context: {
  args: MapFlowArgs;
  mapId: string;
  wires: MdmarkDiagramWire[];
  wireName: (wire: MapWire) => string;
}): { tips: TipList; tipped: Set<string> } => {
  const { args, mapId, wires, wireName } = context;
  const tips = createTips(`${mapId}-wire`);
  const tipped = new Set<string>();
  for (const wire of wires) {
    const notes = args.annotations?.[wire.id];
    if (wire.tip === undefined && !notes?.length) continue;
    tipped.add(wire.id);
    // ラベルと説明を持つ線は、ラベルのツールチップが説明と注記を出す
    if (wire.label !== undefined && wire.tip !== undefined) continue;
    const shown = args.layout.wires.find((item) => item.id === wire.id);
    tips.add({
      kind: "wire",
      label: shown === undefined ? wire.id : wireName(shown),
      tip: wire.tip,
      owner: wire.id,
      annotations: notes,
    });
  }
  return { tips, tipped };
};

/** ノードの名前の中の用語に下線を付ける（名前の文字は逃がしたまま、名前の要素の中に置く） */
const markNodeTerms = (
  html: string,
  context: { nodes: MapNode[]; marker: TermMarker },
): string => {
  let out = html;
  for (const node of context.nodes) {
    const label = node.label ?? node.lines.join("");
    const marked = context.marker.render(label);
    if (marked === escapeHtml(label)) continue;
    out = out.replace(
      new RegExp(
        `(data-node="${regExpValue(node.id)}"[^>]*>[\\s\\S]*?<span class="mdmark-diagram-node-name">)[\\s\\S]*?(</span>)`,
      ),
      (_whole, head: string, tail: string) => `${head}${marked}${tail}`,
    );
  }
  return out;
};

/** ノードはフォーカスして Enter・Space で選び、Alt + 矢印キーで動かせる。リンク先を持つノードは、ノードの代わりにリンクがフォーカスを受ける */
const markFlowNodes = (
  html: string,
  context: { args: MapFlowArgs; nameOf: (id: string) => string },
): string => {
  const selectedIds = new Set(context.args.selected);
  return context.args.layout.nodes.reduce(
    (out, node) => markFlowNode(out, { ...context, node, selectedIds }),
    html,
  );
};

/** ノード 1 つに、形状か、選ぶ・動かすキー操作の属性を付ける */
const markFlowNode = (
  html: string,
  context: {
    args: MapFlowArgs;
    nameOf: (id: string) => string;
    node: MapNode;
    selectedIds: Set<string>;
  },
): string => {
  const { args, nameOf, node, selectedIds } = context;
  const value = regExpValue(node.id);
  const shape = args.shapes?.[node.id];
  // 開始・終了・分岐は形状だけを描き、選ばない
  if (shape !== undefined && shape !== "note") {
    return html.replace(
      new RegExp(
        `(<div class="[^"]*map-kinded[^"]*"[^>]*?) data-shape="[^"]*"([^>]*\\sdata-node="${value}")`,
      ),
      `$1 data-shape="${shape}"$2 role="img" aria-label="${STATE_SHAPE_NAMES[shape]}"`,
    );
  }
  const selected = selectedIds.has(node.id);
  const name = escapeHtml(selectableName(nameOf(node.id), selected));
  if (args.links?.[node.id] !== undefined) {
    const linked = html.replace(
      new RegExp(
        `(<div class="[^"]*map-kinded[^"]*"[^>]*\\sdata-node="${value}"[^>]*>[\\s\\S]*?<a class="mdmark-diagram-node-link" href="[^"]*") aria-label="[^"]*"`,
      ),
      `$1${ownerAttribute(plainOwnerId(args, node.id))} data-drag-owner aria-roledescription="ノード" aria-keyshortcuts="${MAP_LINK_KEYS}" aria-label="${name}"`,
    );
    return selected ? markSelected(linked, value) : linked;
  }
  // ノードの div はフォーカスを受けず、ノードを覆う押せる要素を先頭に入れて、中身をその兄弟にする
  const hit = html.replace(
    new RegExp(
      `(<div class="[^"]*map-kinded[^"]*"[^>]*\\sdata-node="${value}"[^>]*>)`,
    ),
    `$1<span class="mdmark-diagram-node-hit"${ownerAttribute(plainOwnerId(args, node.id))} data-drag-owner role="button" tabindex="0" aria-roledescription="ノード" aria-keyshortcuts="${MAP_NODE_KEYS}" aria-label="${name}"></span>`,
  );
  return selected ? markSelected(hit, value) : hit;
};

/** 計画した変更の名前（バッジとスクリーンリーダー向けの名前） */
export const MAP_CHANGE_LABELS: Readonly<Record<MapChange, string>> = {
  added: "追加",
  changed: "変更",
  removed: "削除",
};

/** 計画した変更のバッジ（読み上げは押せる要素の名前に足すため `aria-hidden`） */
export const mapChangeBadge = (change: MapChange): string =>
  `<span class="mdmark-map-change" data-change="${change}" aria-hidden="true">${MAP_CHANGE_LABELS[change]}</span>`;

/** 計画した変更を、ノード・グループに class とバッジ、押せる要素の名前の末尾に変更の名前、線に class で付ける */
const markChanges = (html: string, args: MapFlowArgs): string => {
  let out = html;
  for (const [id, change] of Object.entries(args.changes ?? {})) {
    const value = regExpValue(id);
    const name = `map-change-${change}`;
    out = addClass(out, { attribute: "data-node", id, name });
    out = addClass(out, { attribute: "data-group", id, name });
    out = addClass(out, { attribute: "data-wire", id, name });
    out = out.replace(
      new RegExp(
        `(<div class="[^"]*\\bmdmark-diagram-node\\b[^"]*"[^>]*\\sdata-(?:node|group)="${value}"[^>]*>|<div class="[^"]*\\bmap-group\\b[^"]*"[^>]*\\sdata-group="${value}"[^>]*>)`,
        "g",
      ),
      `$1${mapChangeBadge(change)}`,
    );
    out = out.replace(
      new RegExp(
        `(\\sdata-node="${value}"[^>]*>[\\s\\S]*?class="mdmark-diagram-node-(?:hit|link)"[^>]*?aria-label=")([^"]*)"`,
      ),
      `$1$2、${MAP_CHANGE_LABELS[change]}"`,
    );
  }
  return out;
};

/** 持ち主の `id` の属性（無ければ空） */
const ownerAttribute = (ownerId: string | undefined): string =>
  ownerId === undefined ? "" : ` id="${escapeHtml(ownerId)}"`;

/** 薄く残したノードに `map-faded` を付ける */
const fadeNodes = (html: string, nodes: MapNode[]): string =>
  nodes
    .filter((node) => node.faded)
    .reduce(
      (out, node) =>
        addClass(out, {
          attribute: "data-node",
          id: node.id,
          name: "map-faded",
        }),
      html,
    );

/** ノードの中へ HTML を入れ、入れた HTML のツールチップを返却する */
const insertNodeParts = (
  html: string,
  nodeParts: Record<string, MapNodePart> | undefined,
): { html: string; tips: string } => {
  let out = html;
  let tips = "";
  for (const [id, part] of Object.entries(nodeParts ?? {})) {
    out = insertNodePart(out, id, part);
    tips += part.tips;
  }
  return { html: out, tips };
};

/** 強調するノードと線のほかを薄くする */
const dimUnkept = (html: string, args: MapFlowArgs): string => {
  const kept = keptOf(args);
  if (!kept) return html;
  const nodes = args.layout.nodes
    .filter((node) => !kept.nodes.has(node.id))
    .map((node) => ({ attribute: "data-node", id: node.id }));
  const wires = args.layout.wires
    .filter((wire) => !kept.wires.has(wire.id))
    .map((wire) => ({ attribute: "data-wire", id: wire.id }));
  return [...nodes, ...wires].reduce(
    (out, target) => addClass(out, { ...target, name: "map-dim" }),
    html,
  );
};

/** 選んだノードと、ドラッグしているノードのクラスを付ける */
const markFlowState = (html: string, args: MapFlowArgs): string => {
  const selected = args.selected.reduce(
    (out, id) =>
      addClass(out, { attribute: "data-node", id, name: "is-selected" }),
    html,
  );
  return args.dragging === undefined
    ? selected
    : addClass(selected, {
        attribute: "data-node",
        id: args.dragging,
        name: "is-dragging",
      });
};

/** グループの色の名前を、面と文字の色の変数にする（知らない名前は色を持たない） */
const groupTint = (args: MapFlowArgs, id: string): string => {
  const name = args.colors?.[id];
  const fill = colorVar(name, "bg");
  const ink = colorVar(name);
  return fill === undefined || ink === undefined
    ? ""
    : `;--map-fill:${fill};--map-ink:${ink}`;
};

/** グループのタイトルの右に配置する説明のマーカー */
type GroupMark = (id: string, title: string) => string;

/** 構成図のグループ 1 つ */
type MapGroup = MapLayout["groups"][number];

/** 開いたグループの面とタイトルの行。グループは外側から順に、線とノードの下に重ねる */
const renderOpenGroups = (args: MapFlowArgs, groupMark: GroupMark): string =>
  args.layout.groups
    .filter((group) => !group.collapsed)
    .sort((a, b) => a.ancestors.length - b.ancestors.length)
    .map((group) => renderOpenGroup({ args, group, groupMark }))
    .join("");

/** グループの右下の角の大きさを変えるボタンの斜線 */
const GROUP_RESIZE_ICON =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M14 6 6 14M14 10l-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

/** 動かせるグループの左・右・下の縁の帯と、右下の角の大きさを変えるボタン */
const groupFrame = (title: string): string =>
  `${["is-left", "is-right", "is-bottom"].map((side) => `<div class="map-group-bar ${side}" data-drag-owner aria-hidden="true"></div>`).join("")}<button class="map-group-resize" type="button" data-drag-owner aria-label="${escapeHtml(`${title}の大きさを変える`)}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight" title="ドラッグでグループの大きさを変える">${GROUP_RESIZE_ICON}</button>`;

/** 開いたグループ 1 つの面とタイトルの行 */
const renderOpenGroup = (context: {
  args: MapFlowArgs;
  group: MapGroup;
  groupMark: GroupMark;
}): string => {
  const { args, group, groupMark } = context;
  const current = group.id === args.entered;
  // 中へ入ったグループと薄く残したグループのほかは、タイトルの行の帯をドラッグして動かせる
  const movable = !current && !group.faded;
  const classes = `map-group${group.faded ? " map-faded" : ""}${current ? " is-entered" : ""}${movable ? " map-movable" : ""}${args.dragging === group.id ? " is-dragging" : ""}`;
  const bar = movable
    ? `<div class="map-group-bar" data-drag-owner tabindex="0" role="button" aria-label="${escapeHtml(`${group.title}を動かす`)}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" title="ドラッグでグループを動かす"></div>`
    : "";
  return `<div class="${classes}" data-group="${escapeHtml(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px${groupTint(args, group.id)}">${bar}<div class="map-group-head" data-drag-owner>${disclosure(group.id, group.title, true)}${groupTitle(group, current, plainOwnerId(args, group.id))}${groupMark(group.id, group.title)}</div>${movable ? groupFrame(group.title) : ""}</div>`;
};

/** 閉じたグループの名前の後ろの文字（無ければ「ノード {数} 件」） */
const closedCount = (args: MapFlowArgs, group: MapGroup): string => {
  const tag =
    args.collapsedTag?.(group.id) ??
    (group.count === undefined ? undefined : `ノード ${group.count} 件`);
  return tag === undefined
    ? ""
    : `<span class="map-closed-count">${escapeHtml(tag)}</span>`;
};

/** 閉じたグループは、二重の枠線の 1 つのノードにする（本数とラベルは出さない） */
const renderClosedGroups = (args: MapFlowArgs, groupMark: GroupMark): string =>
  args.layout.groups
    .filter((group) => group.collapsed)
    .map(
      (group) =>
        `<div class="mdmark-diagram-node map-closed-group${group.faded ? " map-faded" : ""}" data-group="${escapeHtml(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><div class="map-group-head" data-drag-owner>${disclosure(group.id, group.title, false)}${groupTitle(group, false, plainOwnerId(args, group.id))}${groupMark(group.id, group.title)}</div>${closedCount(args, group)}</div>`,
    )
    .join("");

/** 線の押せる範囲の帯の幅（px） */
const WIRE_HIT_WIDTH = 14;

/** `M`・`L`・`H`・`V`（絶対座標）だけの path の `d` を点の並びにする */
const pathPoints = (d: string): Point[] => {
  const points: Point[] = [];
  for (const [, command, values] of d.matchAll(/([MLHV])([^MLHV]*)/g)) {
    const numbers = (values ?? "")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    const last = points.at(-1) ?? [0, 0];
    if (command === "H") points.push([numbers[0] ?? last[0], last[1]]);
    else if (command === "V") points.push([last[0], numbers[0] ?? last[1]]);
    else points.push([numbers[0] ?? 0, numbers[1] ?? 0]);
  }
  return points;
};

/** 線の押せる範囲の区間ごとの帯。`focus` の属性は最も長い区間（長さが同じときは先の区間）の帯に持たせ、ほかの帯は読み上げから除外する */
const wireHitBands = (points: Point[], focus: string): string => {
  const segments = points
    .slice(1)
    .map((point, index): [Point, Point] => [points[index] as Point, point]);
  const lengths = segments.map(
    ([a, b]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]),
  );
  const focusIndex = lengths.indexOf(Math.max(...lengths));
  const half = WIRE_HIT_WIDTH / 2;
  return segments
    .map(([a, b], index) => {
      const x = Math.min(a[0], b[0]) - half;
      const y = Math.min(a[1], b[1]) - half;
      const width = Math.abs(a[0] - b[0]) + WIRE_HIT_WIDTH;
      const height = Math.abs(a[1] - b[1]) + WIRE_HIT_WIDTH;
      const axis = a[0] === b[0] ? "y" : "x";
      const attributes = index === focusIndex ? focus : ' aria-hidden="true"';
      return `<rect class="map-wire-hit-segment" data-segment="${index}" data-axis="${axis}" x="${x}" y="${y}" width="${width}" height="${height}"${attributes}></rect>`;
    })
    .join("");
};

/** 線を押す・指す場所: 線ごとの `g` に、区間ごとの透明の帯を並べる（区間の移動にも使う） */
const renderWireHits = (context: {
  layout: MapLayout;
  annotations: DiagramAnnotations | undefined;
  tipped: Set<string>;
  wireName: (wire: MapWire) => string;
}): string => {
  const { layout, annotations, tipped, wireName } = context;
  const hits = layout.wires
    .map(
      (wire) =>
        `<g class="map-wire-hit" data-wire="${escapeHtml(wire.id)}" data-drag-owner>${wireHitBands(wire.points as Point[], `${ownerIdAttribute(annotations, wire.id)}${tipped.has(wire.id) ? ` data-tip-owner="${escapeHtml(wire.id)}"` : ""} tabindex="0" role="button" aria-label="${escapeHtml(wireName(wire))}"`)}</g>`,
    )
    .join("");
  return `<svg class="map-wire-hits" width="${layout.width}" height="${layout.height}">${hits}</svg>`;
};

/** 部品『mapの構成図』の HTML。ノードと線（`notes` の説明を `hint`、`links` のリンク先を `href` にする）を renderFlow で描き、グループの面とタイトルの行・開閉と中へ入るボタン・説明のマーカー・閉じたグループを重ねる */
export const renderMapFlow = (args: MapFlowArgs): MapPart => {
  const { layout } = args;
  const mapId = args.id ?? "map";
  const hints = args.hints !== false;
  // `hints` がオフなら、説明と注記のツールチップとマーカーの元を渡さない（注記の持ち主の `id` は要素そのものに付ける）
  const tipArgs: MapFlowArgs = hints
    ? args
    : { ...args, notes: undefined, annotations: undefined };
  const names = flowNamesOf(layout);
  const wires = layout.wires.map((wire) => flowWire(tipArgs, wire));
  const definition: MdmarkFlowDefinition = {
    width: layout.width,
    height: layout.height,
    nodes: layout.nodes.map((node) => flowNode(args, node)),
    wires,
  };
  const ownerPrefix = noteOwnerPrefix(args.id);
  const annotations =
    args.annotations === undefined
      ? undefined
      : { items: args.annotations, ownerPrefix };
  const palette = (args.packetStyle ?? DEFAULT_PACKET_STYLE).palette;
  const part = renderFlow(definition, mapId, {
    hints,
    annotations: hints ? annotations : undefined,
    underNodes: `<svg class="map-packets" data-packet-palette="${palette}" width="${layout.width}" height="${layout.height}" aria-hidden="true">${renderMapPackets(args, args.packets)}</svg>`,
  });
  const wireTips = flowWireTips({
    args: tipArgs,
    mapId,
    wires,
    wireName: names.wireName,
  });
  const marker = termMarker(args.terms, mapId);
  let html = markNodeTerms(part.html, { nodes: layout.nodes, marker });
  html = fadeNodes(
    markFlowNodes(html, { args, nameOf: names.nameOf }),
    layout.nodes,
  );
  const inserted = insertNodeParts(html, args.nodeParts);
  html = markFlowState(dimUnkept(inserted.html, args), args);
  // 説明を持つグループは、タイトルの右にノードと同じマーカーを配置する
  const groupTips = createTips(`${mapId}-group`);
  const groupMark: GroupMark = (id, title) =>
    groupInfo({
      hint: tipArgs.notes?.[id],
      label: title,
      owner: `group:${id}`,
      tips: groupTips,
      annotations: tipArgs.annotations?.[id],
      ownerId: noteOwnerId(ownerPrefix, id),
    });
  const groups = renderOpenGroups(args, groupMark);
  const closedHtml = renderClosedGroups(args, groupMark);
  const hitLayer = renderWireHits({
    layout,
    annotations,
    tipped: wireTips.tipped,
    wireName: names.wireName,
  });
  return {
    html: markChanges(`${groups}${html}${hitLayer}${closedHtml}`, args),
    tips: `${markTipTerms(`${part.tips}${wireTips.tips.html()}${groupTips.html()}`, args.terms)}${marker.tips.html()}${inserted.tips}`,
  };
};

/** 再生で進める単位 */
export type MapBandUnit =
  | "message"
  | "transition"
  | "task"
  | "period"
  | "commit"
  | "relation";

/** 部品『案内の帯』の引数 */
export type MapBandArgs = {
  mode: "walkthrough" | "playback";
  /** 再生で進める単位（既定 message。transition は状態遷移図の遷移、task はガントチャートとジャーニーのタスク、period はタイムラインの期間、commit は Git グラフの commit） */
  unit?: MapBandUnit | undefined;
  /** 手順の数（区切りの数） */
  total: number;
  /** 今の番号（始める前は無し） */
  index: number | undefined;
  /** 手順ごとのタイトル（区切りの title 属性とバーの読み上げの値） */
  titles: string[];
  title: string;
  text: string;
  /** 今の手順を繰り返しているか */
  playing: boolean;
  /** 今の手順の 1 周の進み（0〜1） */
  fill: number;
  label: string;
};

/** 単位ごとの名前（バーの名前と矢印のボタンの名前） */
const UNIT_NAMES = {
  walkthrough: "手順",
  message: "メッセージ",
  transition: "遷移",
  task: "タスク",
  period: "期間",
  commit: "commit",
  relation: "関係",
} as const;

/** 案内の帯の左右の矢印のボタン */
const bandArrow = (dir: -1 | 1, label: string): string =>
  `<button class="map-band-step" type="button" data-band="step" data-dir="${dir}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${iconSvg(dir < 0 ? "chevron-left" : "chevron-right")}</button>`;

/** 部品『案内の帯』の HTML */
export const renderMapBand = (args: MapBandArgs): string => {
  const unit =
    UNIT_NAMES[
      args.mode === "playback" ? (args.unit ?? "message") : "walkthrough"
    ];
  const { index } = args;
  const started = index !== undefined;
  const segClass = (i: number): string =>
    [
      "map-band-seg",
      started && i < index ? "is-done" : "",
      i === index ? "is-current" : "",
      i === index && args.playing ? "is-playing" : "",
    ]
      .filter(Boolean)
      .join(" ");
  const fill = (i: number): string =>
    i === index && args.playing
      ? `<span class="map-band-fill" style="width: ${Math.round(Math.min(1, Math.max(0, args.fill)) * 100)}%"></span>`
      : "";
  const segments = Array.from(
    { length: args.total },
    (_, i) =>
      `<span class="${segClass(i)}" data-index="${i}" title="${escapeHtml(`${i + 1}. ${args.titles[i] ?? ""}`)}">${fill(i)}</span>`,
  ).join("");
  const valueText = started
    ? `${unit} ${index + 1}/${args.total} ${args.titles[index] ?? args.title}`.trimEnd()
    : "始める前";
  const bar = `<div class="map-band-steps" role="slider" tabindex="0" data-band="steps" aria-label="${escapeHtml(unit)}" aria-valuemin="0" aria-valuemax="${args.total}" aria-valuenow="${started ? index + 1 : 0}" aria-valuetext="${escapeHtml(valueText)}" aria-keyshortcuts="ArrowLeft ArrowRight Home End Escape">${segments}</div>`;
  const title = `<strong class="map-band-title"${args.title === "" ? " hidden" : ""}>${escapeHtml(args.title)}</strong>`;
  const text = `<p class="map-band-text" aria-live="polite"${args.text === "" ? " hidden" : ""}>${escapeHtml(args.text)}</p>`;
  // 英字で始まる単位（commit）は「の」との間に空白を置く
  const gap = /^[A-Za-z]/.test(unit) ? " " : "";
  return `<div class="map-band${started ? "" : " is-idle"}" role="region" aria-label="${escapeHtml(args.label)}" data-mode="${args.mode}"><div class="map-band-bar">${bandArrow(-1, `前の${gap}${unit}`)}${bar}${bandArrow(1, `次の${gap}${unit}`)}</div>${title}${text}</div>`;
};

/** 部品『mapのシーケンス図』の引数 */
export type MapSequenceArgs = {
  sequence: Sequence;
  /** 用語から意味（`data-map-terms`）。参加者の名前・メッセージの文・ノートの文の中の用語に下線を付ける */
  terms?: Record<string, string> | undefined;
  /** 補足の notes（記載の順に 1 からのメッセージの番号から説明）。説明を持つメッセージの線にツールチップを付ける */
  notes?: Record<string, string> | undefined;
  /** 補足の notes の annotations（メッセージの番号ごとの注記。番号の順）。注記を持つメッセージの線にもツールチップを付ける */
  annotations?: Record<string, DiagramAnnotation[]> | undefined;
  /** 機能 `hints` がオンか（既定 `true`）。オフなら説明と注記のツールチップを作らず、注記の持ち主の `id` だけをメッセージの線に付ける */
  hints?: boolean | undefined;
  /** 設定の map.packets（無いときは `{ fill: "tinted", palette: "accent" }`） */
  packetStyle?: PacketStyle | undefined;
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

/** シーケンス図を描くときに繰り返し引く値 */
type SeqContext = {
  args: MapSequenceArgs;
  /** データの印の塗り方と色合い（設定が無ければ既定） */
  packetStyle: PacketStyle;
  /** 矢じりの id の頭 */
  id: string;
  /** 参加者の縦線の左右の位置 */
  x: Map<string, number>;
  /** 最も右の参加者の位置 */
  lastX: number;
  /** 選んだ参加者 */
  selected: Set<string>;
  /** メッセージの番号から行の位置 */
  rowOfMessage: Map<number, number>;
  marker: TermMarker;
  /** 参加者を選ばずに再生しているか（今のメッセージのほかを薄くする） */
  dimByPlay: boolean;
  /** 再生している今のメッセージ */
  focusEnds: SequenceMessage | undefined;
};

/** 行の位置の上下の位置 */
const seqRowY = (index: number): number =>
  MAP_SEQ.firstY + index * MAP_SEQ.rowH;

/** 選んだ参加者に関わるメッセージか（選んでいなければ `undefined`） */
const seqRelated = (
  selected: Set<string>,
  message: SequenceMessage,
): boolean | undefined => {
  if (selected.size === 0) return undefined;
  return selected.size === 1
    ? selected.has(message.from) || selected.has(message.to)
    : selected.has(message.from) && selected.has(message.to);
};

/** 部品『mapのシーケンス図』の HTML。参加者・ライフライン・メッセージに、ブロックのタブの開閉と名前のボタン・区間・ノート・活性化の帯・参加者の選択を重ねる */
export const renderMapSequence = (args: MapSequenceArgs): MapPart => {
  const context = seqContextOf(args);
  const { rows, participants } = args;
  const noteTips = createTips(`${args.id ?? "map"}-seq-note`);
  const width = context.lastX + MAP_SEQ.headW / 2 + MAP_SEQ.pad * 4;
  const height =
    seqRowY(Math.max(0, rows.length - 1)) + MAP_SEQ.rowH + MAP_SEQ.pad;
  const parts = rows.map((row, at) => renderSeqRow(context, { row, at }));
  const under = parts.map((part) => part.under).join("");
  const overlay = parts.map((part) => part.overlay).join("");
  const above = renderSeqActivations(context);
  const messages = [...context.rowOfMessage].flatMap(([message, at]) => {
    const part = renderSeqMessage(context, { message, at, noteTips });
    return part === undefined ? [] : [part];
  });
  const wires = messages.map((part) => part.wire).join("");
  const labels = messages.map((part) => part.label).join("");
  const packetPaths = messages.flatMap((part) =>
    part.packet === undefined ? [] : [part.packet],
  );
  const lifelines = participants
    .map(
      (name) =>
        `<line class="mdmark-diagram-lifeline${seqParticipantDim(context, name)}" data-lifeline="${escapeHtml(name)}" x1="${context.x.get(name)}" y1="${MAP_SEQ.headTop + MAP_SEQ.headH}" x2="${context.x.get(name)}" y2="${height - 12}"></line>`,
    )
    .join("");
  // ポインターを合わせる判定の線（ライフラインと同じ座標。メッセージの線の判定より下に描く）
  const lifelineHits = participants
    .map(
      (name) =>
        `<line class="map-lifeline-hit" data-lifeline="${escapeHtml(name)}" x1="${context.x.get(name)}" y1="${MAP_SEQ.headTop + MAP_SEQ.headH}" x2="${context.x.get(name)}" y2="${height - 12}"></line>`,
    )
    .join("");
  const heads = participants
    .map((name) => renderSeqHead(context, name))
    .join("");
  const html = [
    `<svg class="mdmark-diagram-wires" width="${width}" height="${height}" aria-hidden="true"><defs>${renderSeqMarkers(context.id)}</defs><g class="map-seq-under">${under}</g>${lifelineHits}${lifelines}${wires}<g class="map-seq-above">${above}</g><g class="map-packets" data-packet-palette="${context.packetStyle.palette}" aria-hidden="true">${renderPackets(packetPaths)}</g></svg>`,
    labels,
    overlay,
    `<div class="mdmark-diagram-seq-heads" style="width:${width}px;height:${MAP_SEQ.headTop + MAP_SEQ.headH + 8}px">${heads}</div>`,
  ].join("");
  return {
    html,
    tips: `${markTipTerms(noteTips.html(), args.terms)}${context.marker.tips.html()}`,
  };
};

/** シーケンス図を描くときに繰り返し引く値を返却する */
const seqContextOf = (args: MapSequenceArgs): SeqContext => {
  const { sequence, rows, participants } = args;
  const selected = new Set(args.selected);
  const rowOfMessage = new Map<number, number>();
  rows.forEach((row, at) => {
    if (row.kind === "message") rowOfMessage.set(row.message, at);
  });
  return {
    args,
    packetStyle: args.packetStyle ?? DEFAULT_PACKET_STYLE,
    id: args.id ?? "map-seq",
    x: new Map(
      participants.map((name, index) => [
        name,
        MAP_SEQ.firstX + index * MAP_SEQ.colGap,
      ]),
    ),
    lastX:
      MAP_SEQ.firstX + Math.max(0, participants.length - 1) * MAP_SEQ.colGap,
    selected,
    rowOfMessage,
    marker: termMarker(args.terms, `${args.id ?? "map"}-seq`),
    dimByPlay: args.focus !== undefined && selected.size === 0,
    focusEnds:
      args.focus === undefined
        ? undefined
        : sequence.messages[args.focus.message],
  };
};

/** ブロックが囲む左右（関わる参加者の列） */
const seqSpanOf = (
  context: SeqContext,
  fragment: SequenceFragment,
): [number, number] => {
  const xs = context.args.sequence.messages
    .slice(fragment.start, fragment.end)
    .flatMap((message) => [
      context.x.get(message.from),
      context.x.get(message.to),
    ])
    .filter((value): value is number => value !== undefined);
  const pad = 70 - fragment.depth * 10;
  return xs.length === 0
    ? [MAP_SEQ.firstX - pad, context.lastX + pad]
    : [Math.min(...xs) - pad, Math.max(...xs) + pad];
};

/** ブロックのタブ（中へ入ったブロックは押せない名前、それ以外は開閉と名前のボタン） */
const renderFragmentTab = (
  context: SeqContext,
  tab: {
    fragment: SequenceFragment;
    index: number;
    expanded: boolean;
    left: number;
    top: number;
    extra?: string;
  },
): string => {
  const { fragment, index, expanded, left, top, extra = "" } = tab;
  const label = `${fragment.kind}「${fragment.label}」`;
  const body =
    index === context.args.entered
      ? `<span class="map-seq-fragment-title is-current">${fragmentTitle(fragment)}</span>`
      : `<button class="map-disclosure" type="button" data-fragment-toggle="${index}" aria-expanded="${expanded}" aria-label="${escapeHtml(`${label}を${expanded ? "閉じる" : "開く"}`)}">${iconSvg(expanded ? "chevron-down" : "chevron-right")}</button><button class="map-seq-fragment-title" type="button" data-fragment-enter="${index}" aria-label="${escapeHtml(`${label}の中だけを見る`)}" title="このブロックの中だけを見る">${fragmentTitle(fragment)}</button>`;
  return `<span class="map-seq-fragment-tab" data-kind="${fragment.kind}" data-fragment="${index}" style="left:${left}px;top:${top}px">${body}${extra}</span>`;
};

/** 行が線とノードの下（`under`）と、上（`overlay`）に重ねる HTML */
type SeqRowPart = { under: string; overlay: string };

/** 何も重ねない行 */
const EMPTY_ROW: SeqRowPart = { under: "", overlay: "" };

/** 行 1 つが重ねる HTML（閉じたブロック・ブロック・区間・ノート）を返却する */
const renderSeqRow = (
  context: SeqContext,
  place: { row: SequenceRow; at: number },
): SeqRowPart => {
  const { row, at } = place;
  switch (row.kind) {
    case "collapsed":
      return renderCollapsedRow(context, { row, at });
    case "fragment":
      return renderFragmentRow(context, { fragment: row.fragment, at });
    case "section":
      return renderSectionRow(context, { row, at });
    case "note":
      return renderNoteRow(context, { note: row.note, at });
    default:
      return EMPTY_ROW;
  }
};

/** 閉じたブロックの行（枠とタブとメッセージの件数） */
const renderCollapsedRow = (
  context: SeqContext,
  place: { row: { fragment: number; count: number }; at: number },
): SeqRowPart => {
  const { row, at } = place;
  const fragment = context.args.sequence.fragments[row.fragment];
  if (!fragment) return EMPTY_ROW;
  const [left, right] = seqSpanOf(context, fragment);
  const top = seqRowY(at) - 30;
  return {
    under: `<rect class="map-seq-fragment is-collapsed" x="${left}" y="${top}" width="${right - left}" height="40" rx="4"></rect>`,
    overlay: renderFragmentTab(context, {
      fragment,
      index: row.fragment,
      expanded: false,
      left,
      top,
      extra: `<span class="map-seq-fragment-count">メッセージ ${row.count} 件</span>`,
    }),
  };
};

/** 行がブロックの中にあるか（メッセージの行と、中の閉じたブロックの行） */
const inFragment = (
  sequence: Sequence,
  fragment: SequenceFragment,
  item: SequenceRow,
): boolean => {
  if (item.kind === "message") {
    return fragment.start <= item.message && item.message < fragment.end;
  }
  if (item.kind !== "collapsed") return false;
  const inner = sequence.fragments[item.fragment];
  return (
    (inner?.start ?? -1) >= fragment.start &&
    (inner?.end ?? Infinity) <= fragment.end
  );
};

/** 開いたブロックの行（中の行の最後まで囲む枠とタブ） */
const renderFragmentRow = (
  context: SeqContext,
  place: { fragment: number; at: number },
): SeqRowPart => {
  const { at } = place;
  const { sequence, rows } = context.args;
  const fragment = sequence.fragments[place.fragment];
  if (!fragment) return EMPTY_ROW;
  const [left, right] = seqSpanOf(context, fragment);
  const inside = rows.flatMap((item, index) =>
    inFragment(sequence, fragment, item) ? [index] : [],
  );
  const lastRow = Math.max(at, ...inside);
  const top = seqRowY(at) - 30;
  const bottom = seqRowY(lastRow) + 14;
  return {
    under: `<rect class="map-seq-fragment${fragment.kind === "rect" ? " is-rect" : ""}" x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="4"></rect>`,
    overlay: renderFragmentTab(context, {
      fragment,
      index: place.fragment,
      expanded: true,
      left,
      top,
    }),
  };
};

/** ブロックの区間の行（区切りの線と名前） */
const renderSectionRow = (
  context: SeqContext,
  place: { row: { fragment: number; section: number }; at: number },
): SeqRowPart => {
  const { row, at } = place;
  const fragment = context.args.sequence.fragments[row.fragment];
  const section = fragment?.sections[row.section];
  if (!fragment || !section) return EMPTY_ROW;
  const [left, right] = seqSpanOf(context, fragment);
  const y = seqRowY(at) - 14;
  return {
    under: `<line class="map-seq-section" x1="${left}" x2="${right}" y1="${y}" y2="${y}"></line>`,
    overlay: `<span class="map-seq-section-label" style="left:${left + 8}px;top:${y + 2}px">[${escapeHtml(section.label)}]</span>`,
  };
};

/** ノートの左右（参加者の左・右・上） */
const noteSpan = (note: SequenceNote, xs: number[]): [number, number] => {
  const first = xs[0] as number;
  if (note.placement === "left") return [first - 170, first - 16];
  if (note.placement === "right") return [first + 16, first + 170];
  return [Math.min(...xs) - 60, Math.max(...xs) + 60];
};

/** ノートの行 */
const renderNoteRow = (
  context: SeqContext,
  place: { note: number; at: number },
): SeqRowPart => {
  const note = context.args.sequence.notes[place.note];
  if (!note) return EMPTY_ROW;
  const xs = note.of
    .map((name) => context.x.get(name))
    .filter((value): value is number => value !== undefined);
  if (xs.length === 0) return EMPTY_ROW;
  const [left, right] = noteSpan(note, xs);
  return {
    under: "",
    overlay: `<div class="map-seq-note" style="left:${left}px;top:${seqRowY(place.at) - 32}px;width:${right - left}px">${context.marker.render(note.text)}</div>`,
  };
};

/** メッセージの行の位置（閉じたブロックの中のメッセージは、閉じたブロックの行） */
const seqRowOf = (context: SeqContext, message: number): number => {
  const { sequence, rows } = context.args;
  return (
    context.rowOfMessage.get(message) ??
    rows.findIndex(
      (row) =>
        row.kind === "collapsed" &&
        (sequence.fragments[row.fragment]?.start ?? Infinity) <= message &&
        message < (sequence.fragments[row.fragment]?.end ?? -1),
    )
  );
};

/** 活性化の帯: 参加者の縦線の上に、始まりの行から終わりの行まで（入れ子は右へずらす） */
const renderSeqActivations = (context: SeqContext): string =>
  context.args.sequence.activations
    .flatMap((activation) => {
      const center = context.x.get(activation.id);
      const start = seqRowOf(context, activation.start);
      const end = seqRowOf(context, activation.end);
      if (center === undefined || start < 0 || end < 0) return [];
      const left = center - 5 + activation.depth * 6;
      return [
        `<rect class="map-seq-activation" x="${left}" y="${seqRowY(start)}" width="10" height="${Math.max(12, seqRowY(end) - seqRowY(start))}"></rect>`,
      ];
    })
    .join("");

/** メッセージの線の端（活性化の帯の上にいる参加者は、帯の縁） */
const activeEdge = (
  sequence: Sequence,
  edge: { name: string; message: number; at: number; towards: number },
): number => {
  const { name, message, at, towards } = edge;
  const depths = sequence.activations
    .filter(
      (item) =>
        item.id === name && item.start <= message && message <= item.end,
    )
    .map((item) => item.depth);
  if (depths.length === 0) return at;
  return towards > at ? at + 5 + Math.max(...depths) * 6 : at - 5;
};

/** 参加者の名前（無ければ ID） */
const seqLabelOf = (sequence: Sequence, name: string): string =>
  sequence.participants.find((item) => item.id === name)?.label ?? name;

/** メッセージ 1 つの線・ラベル・データの印 */
type SeqMessagePart = {
  wire: string;
  label: string;
  packet: PacketPath | undefined;
};

/** 自分へのメッセージの折り返しの寸法（px）。ラベルの札（高さ 20px）は折り返しの上の辺から `labelGap` だけ上に離す */
/** 自分へのメッセージの折り返しの幅と高さ、札の下端と線の間、札の高さの半分（線のラベルの文字 11px × 行の高さ 1.5 と上下の枠線 1px の半分） */
const SEQ_SELF = { width: 40, rise: 8, labelGap: 6, labelHalf: 9.25 } as const;

/** メッセージの線の形（自分へのメッセージは右へ折り返す） */
type SeqGeometry = {
  y: number;
  self: boolean;
  start: number;
  end: number;
  d: string;
};

/** メッセージの線の形を返却する（参加者が描かれていなければ `undefined`） */
const seqMessageGeometry = (
  context: SeqContext,
  entry: { item: SequenceMessage; message: number; at: number },
): SeqGeometry | undefined => {
  const { item, message, at } = entry;
  const x1 = context.x.get(item.from);
  const x2 = context.x.get(item.to);
  if (x1 === undefined || x2 === undefined) return undefined;
  const y = seqRowY(at);
  if (item.from === item.to) {
    return {
      y,
      self: true,
      start: x1,
      end: x2,
      d: `M${x1} ${y - SEQ_SELF.rise}H${x1 + SEQ_SELF.width}V${y + SEQ_SELF.rise}H${x1 + 4}`,
    };
  }
  const { sequence } = context.args;
  const start = activeEdge(sequence, {
    name: item.from,
    message,
    at: x1,
    towards: x2,
  });
  const end = activeEdge(sequence, {
    name: item.to,
    message,
    at: x2,
    towards: x1,
  });
  return {
    y,
    self: false,
    start,
    end,
    d: `M${start} ${y}H${end + Math.sign(start - end)}`,
  };
};

/** 中央の参加者へのメッセージ（`->>()`・`()->>`）の端の小さな円 */
const seqCentral = (
  item: SequenceMessage,
  geometry: { y: number; self: boolean; start: number; end: number },
  dim: string,
): string => {
  if (item.central === undefined || geometry.self) return "";
  const at = (x: number) =>
    `<circle class="map-seq-central${dim}" cx="${x}" cy="${geometry.y}" r="4" fill="var(--mdmark-color-bg)" stroke="var(--mdmark-color-diagram-line)" stroke-width="1.5"></circle>`;
  return (
    (item.central === "to" ? "" : at(geometry.start)) +
    (item.central === "from" ? "" : at(geometry.end))
  );
};

/** メッセージの線の矢じりの属性 */
const seqArrowHeads = (id: string, style: SequenceArrowStyle): string => {
  const head =
    style.head === "none" ? "" : ` marker-end="url(#${id}-head-${style.head})"`;
  const both = style.both
    ? ` marker-start="url(#${id}-head-${style.head})"`
    : "";
  return `${head}${both}`;
};

/** 補足の notes に説明があるメッセージは、線の押せる帯を持ち主にしたツールチップを持つ。ツールチップを足し、持ち主の属性を返却する */
const seqNoteOwner = (
  context: SeqContext,
  entry: { message: number; item: SequenceMessage; noteTips: TipList },
): string => {
  const { args } = context;
  const { message, item, noteTips } = entry;
  const key = String(message + 1);
  const note = args.notes?.[key];
  const notes = args.annotations?.[key];
  const annotated = (notes?.length ?? 0) > 0;
  if ((note === undefined || note === "") && !annotated) return "";
  const ownerId = annotated
    ? ` id="${escapeHtml(noteOwnerId(noteOwnerPrefix(args.id), key))}" tabindex="0"`
    : "";
  // `hints` がオフなら、ツールチップを作らず注記の持ち主の `id` だけを残す
  if (args.hints === false) return ownerId;
  noteTips.add({
    kind: "wire",
    label: `${seqLabelOf(args.sequence, item.from)} → ${seqLabelOf(args.sequence, item.to)}`,
    tip: note,
    owner: `message:${message}`,
    annotations: notes,
  });
  return `${ownerId} data-tip-owner="${escapeHtml(`message:${message}`)}"`;
};

/** メッセージ 1 つの線・ラベル・データの印を返却する（描けなければ `undefined`） */
const renderSeqMessage = (
  context: SeqContext,
  entry: { message: number; at: number; noteTips: TipList },
): SeqMessagePart | undefined => {
  const { args, selected } = context;
  const { message, noteTips } = entry;
  const item = args.sequence.messages[message];
  if (!item) return undefined;
  const geometry = seqMessageGeometry(context, { item, message, at: entry.at });
  if (!geometry) return undefined;
  const style = SEQ_ARROW_STYLES[item.arrow];
  const hit = seqRelated(selected, item);
  const playing = message === args.focus?.message;
  const dim =
    hit === false || (context.dimByPlay && !playing) ? " map-dim" : "";
  const noteOwner = seqNoteOwner(context, { message, item, noteTips });
  const { d } = geometry;
  return {
    wire: `<path class="mdmark-diagram-wire${dim}" data-line="map" data-message="${message}" d="${d}"${style.dotted ? ' stroke-dasharray="6 4"' : ""} stroke-width="1.5" style="stroke:var(--mdmark-color-diagram-line)"${seqArrowHeads(context.id, style)}></path>${seqCentral(item, geometry, dim)}<g class="map-wire-hit" data-message="${message}">${wireHitBands(pathPoints(d), noteOwner)}</g>`,
    label: seqMessageLabel(context, { message, item, geometry, dim }),
    // 選んだ参加者のメッセージと再生している今のメッセージの線に、データの印を送り手から受け手へ流す
    packet:
      hit === true || playing
        ? seqPacket({
            message,
            geometry,
            style,
            packetStyle: context.packetStyle,
          })
        : undefined,
  };
};

/** メッセージのラベル（番号を振るときは番号を頭に付ける） */
const seqMessageLabel = (
  context: SeqContext,
  entry: {
    message: number;
    item: SequenceMessage;
    geometry: SeqGeometry;
    dim: string;
  },
): string => {
  const { message, item, geometry, dim } = entry;
  const number = context.args.sequence.autonumber ? `${message + 1} ` : "";
  // 自分へのメッセージの札は、折り返しの左右の中央の上に、折り返しの線と重ねずに置く
  const left = geometry.self
    ? geometry.start + SEQ_SELF.width / 2
    : (geometry.start + geometry.end) / 2;
  const top = geometry.self
    ? geometry.y - SEQ_SELF.rise - SEQ_SELF.labelGap - SEQ_SELF.labelHalf
    : geometry.y - 14;
  return `<span class="mdmark-diagram-label${dim}" data-message="${message}" style="left:${left}px;top:${top}px">${escapeHtml(number)}${context.marker.render(item.text)}</span>`;
};

/** メッセージの線に流すデータの印 */
const seqPacket = (entry: {
  message: number;
  geometry: SeqGeometry;
  style: SequenceArrowStyle;
  packetStyle: PacketStyle;
}): PacketPath => {
  const { message, geometry, style, packetStyle } = entry;
  return {
    owner: `data-message="${message}"`,
    d: geometry.d,
    length: geometry.self ? 64 : Math.abs(geometry.end - geometry.start),
    mark: resolvePacketMark({
      index: message,
      wire: String(message),
      style: packetStyle,
      colored: false,
    }),
    direction: style.both ? "both" : "forward",
  };
};

/** 参加者を薄くするか（選んだ参加者のほかと、再生している今のメッセージの両端のほか） */
const seqParticipantDim = (context: SeqContext, name: string): string => {
  const { selected, dimByPlay, focusEnds } = context;
  if (selected.size > 0 && !selected.has(name)) return " map-dim";
  return dimByPlay &&
    focusEnds !== undefined &&
    name !== focusEnds.from &&
    name !== focusEnds.to
    ? " map-dim"
    : "";
};

/** 矢じりの形 */
const SEQ_MARKER_SHAPES = {
  filled:
    '<path d="M0,0 L9,4.5 L0,9 z" style="fill:var(--mdmark-color-diagram-line)"></path>',
  cross:
    '<path d="M1,1 L8,8 M8,1 L1,8" fill="none" stroke-width="1.5" style="stroke:var(--mdmark-color-diagram-line)"></path>',
  async:
    '<path d="M1,1 L8,4.5 L1,8" fill="none" stroke-width="1.5" style="stroke:var(--mdmark-color-diagram-line)"></path>',
} as const;

/** 矢じりの `marker` */
const renderSeqMarkers = (id: string): string =>
  (["filled", "cross", "async"] as const)
    .map(
      (head) =>
        `<marker id="${id}-head-${head}" class="mdmark-diagram-arrowhead" data-head="${head}" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${SEQ_MARKER_SHAPES[head]}</marker>`,
    )
    .join("");

/** 参加者の種類の行（アイコンと種類の名前） */
const seqHeadKind = (kind: MapKind | undefined): string => {
  const bundled =
    kind?.icon === undefined ? undefined : bundledIconNode(kind.icon);
  // まとめたアイコンはその場で描き、まとめていないアイコンは読み込む場所を配置する
  const icon =
    kind?.icon === undefined
      ? ""
      : `<span class="mdmark-map-icon" data-icon="${escapeHtml(kind.icon)}" aria-hidden="true">${bundled ? iconNodeSvg(bundled as unknown as MdmarkIconNode) : ""}</span>`;
  const tag =
    kind?.label === undefined ? "" : `<span>${escapeHtml(kind.label)}</span>`;
  return `<span class="mdmark-diagram-node-kind${icon === "" && tag === "" ? " is-empty" : ""}">${icon}${tag}</span>`;
};

/** 参加者の形と色の属性 */
const seqHeadLook = (kind: MapKind | undefined): string =>
  ` data-shape="${kind?.shape ?? "rounded"}"${kind?.color === undefined ? "" : ` data-color="${escapeHtml(kind.color)}"`}`;

/** 参加者 1 人の頭（選べるノード）。箱の `div` はフォーカスを受けず、箱を覆う押せる要素を先頭に入れて、種類の行と名前をその兄弟にする */
const renderSeqHead = (context: SeqContext, name: string): string => {
  const { args, selected, marker } = context;
  const kind = args.kinds?.[name];
  const isSelected = selected.has(name);
  const label = seqLabelOf(args.sequence, name);
  const hit = `<span class="mdmark-diagram-node-hit" role="button" tabindex="0" aria-keyshortcuts="Enter Space Alt+ArrowLeft Alt+ArrowRight" aria-label="${escapeHtml(selectableName(label, isSelected))}"></span>`;
  return `<div class="mdmark-diagram-node map-participant map-kinded${seqParticipantDim(context, name)}${isSelected ? " is-selected" : ""}" data-kind="map"${seqHeadLook(kind)} data-node="${escapeHtml(name)}" data-participant="${escapeHtml(name)}"${isSelected ? " data-selected" : ""} style="left:${(context.x.get(name) ?? 0) - MAP_SEQ.headW / 2}px;top:${MAP_SEQ.headTop}px;width:${MAP_SEQ.headW}px">${hit}${seqHeadKind(kind)}<span class="mdmark-diagram-node-name">${marker.render(label)}</span></div>`;
};

/** 部品『mapのER図』のテーブルのノードの寸法（px）。列の行は、テーブル名の行の下から同じ高さで並ぶ */
export const MAP_ER = {
  width: 240,
  /** テーブル名の行（名前と開閉のボタンの 1 行）の高さ */
  head: 36,
  row: 28,
  foot: 6,
  /** ノードの左右に空ける幅（関連の端と多重度の置き場所） */
  aside: 32,
  /** 関連の端の、ノードの辺から外へ出す長さ（同じ辺から出る 2 本目からは step ずつ延ばす） */
  endOut: 14,
  step: MAP_LAYOUT.clearance,
  /** 同じ列の行から同じ辺へ出る 2 本目からの端の縦のずれ */
  shift: 6,
  /** 多重度の文字の 1 文字の幅と、文字の高さ（重なりの見積もり） */
  cardinalityChar: 7,
  cardinalityLine: 13,
  /** 関連のラベルの 1 文字の幅と、1 行の高さ（ラベルどうしの重なりの見積もり） */
  labelChar: 12,
  labelLine: 16,
  /** 多重度の文字の、端からの離れ */
  cardinalityGap: 4,
  /** 行が増える関連のマーカーの、線からの離れ */
  fanoutGap: 22,
  /** 行が増える関連のマーカーの一辺 */
  fanoutSize: 24,
} as const;

/** テーブルのノードの大きさ（列を閉じたテーブルはテーブル名の行だけ） */
export const mapErNodeSize = (args: {
  columns: number;
  collapsed: boolean;
}): { w: number; h: number } => ({
  w: MAP_ER.width,
  h:
    args.collapsed || args.columns === 0
      ? MAP_ER.head
      : MAP_ER.head + args.columns * MAP_ER.row + MAP_ER.foot,
});

/** 部品『mapのER図』のテーブルの引数 */
export type MapErTableArgs = {
  name: string;
  columns: Array<{ type: string; name: string; keys: string[] }>;
  /** 列の名前ごとの説明（補足の `{テーブル}.{列}` か列のコメント） */
  notes: Record<string, string>;
  collapsed: boolean;
  /** 列の名前ごとの注記（番号の順） */
  annotations?: Record<string, DiagramAnnotation[]> | undefined;
  /** 注記を持つ列の説明のボタンの `id` の頭 */
  ownerPrefix?: string | undefined;
  /** 機能 `hints` がオンか（既定 `true`）。オフなら説明のボタンとツールチップを作らず、注記の持ち主の `id` を列の行に付ける */
  hints?: boolean | undefined;
  /** ツールチップの id の頭 */
  id?: string | undefined;
};

/** 注記を持つ列の持ち主の `id` の属性（`ownerPrefix` が無ければ空） */
const erOwnerId = (args: MapErTableArgs, column: string): string =>
  args.ownerPrefix === undefined
    ? ""
    : ` id="${escapeHtml(noteOwnerId(args.ownerPrefix, `${args.name}.${column}`))}"`;

/** ER 図の列の説明のボタンと、そのツールチップ */
const erNoteButton = (
  args: MapErTableArgs,
  context: {
    column: MapErTableArgs["columns"][number];
    tips: TipList;
    ownerId: string;
  },
): string => {
  const { column, tips, ownerId } = context;
  const note = args.notes[column.name];
  const notes = args.annotations?.[column.name];
  const owner = `column:${args.name}.${column.name}`;
  const label = infoLabel({
    name: column.name,
    described: note !== undefined,
    annotated: (notes?.length ?? 0) > 0,
  }).replace(/^「(.*)」/, "$1");
  return `<button class="map-er-note" type="button"${ownerId} aria-label="${escapeHtml(label)}" aria-describedby="${tips.add({ kind: "hint", label: column.name, hint: note, owner, annotations: notes })}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
};

/** ER 図の列の行 1 つ。説明か注記を持つ列は、説明のボタンとツールチップを持つ。`hints` がオフなら説明のボタンを作らず、注記の持ち主の `id` を列の行に付ける */
const renderMapErColumn = (
  args: MapErTableArgs,
  context: { column: MapErTableArgs["columns"][number]; tips: TipList },
): string => {
  const { column, tips } = context;
  const note = args.notes[column.name];
  const notes = args.annotations?.[column.name];
  const annotated = (notes?.length ?? 0) > 0;
  const ownerId = annotated ? erOwnerId(args, column.name) : "";
  const plain = args.hints === false;
  const row = plain && ownerId !== "" ? `${ownerId} tabindex="-1"` : "";
  const mark =
    plain || (note === undefined && !annotated)
      ? ""
      : erNoteButton(args, { column, tips, ownerId });
  return `<div class="map-er-column"${row} role="listitem" data-column="${escapeHtml(column.name)}"><span class="map-er-key">${escapeHtml(column.keys.join(","))}</span><span class="map-er-name">${escapeHtml(column.name)}</span><span class="map-er-type">${escapeHtml(column.type)}</span><span class="map-er-note-cell">${mark}</span></div>`;
};

/** 部品『mapのER図』のテーブルの中身。列を開閉するボタン・列の行・列の説明のツールチップ */
export const renderMapEr = (
  args: MapErTableArgs,
): { toggle: string; columns: string; tips: string } => {
  const label = `${args.name}の列を${args.collapsed ? "開く" : "閉じる"}`;
  const toggle = `<button class="map-er-toggle" type="button" data-node-toggle="${escapeHtml(args.name)}" aria-expanded="${!args.collapsed}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${iconSvg("chevron-down")}</button>`;
  if (args.collapsed) return { toggle, columns: "", tips: "" };
  const tips = createTips(args.id ?? `map-er-${args.name}`);
  const rows = args.columns
    .map((column) => renderMapErColumn(args, { column, tips }))
    .join("");
  return {
    toggle,
    columns: `<div class="map-er-columns" role="list" style="top:${MAP_ER.head}px;grid-auto-rows:${MAP_ER.row}px">${rows}</div>`,
    tips: tips.html(),
  };
};

/** 部品『mapのER図』の関連。端をつなぐ列は、その端のテーブルの列の名前 */
export type MapErRelation = {
  id: string;
  from: string;
  to: string;
  fromCardinality: string;
  toCardinality: string;
  label: string | undefined;
  fromColumn: string | undefined;
  toColumn: string | undefined;
};

/** 2 つのテーブルの経路を 1 の側から多の側へたどる関連（`wire` は関連の ID） */
export type MapErFanout = { wire: string; from: string; to: string };

type Point = [number, number];

/** `reanchor` の引数 */
type ReanchorArgs = {
  points: Point[];
  rect: { x: number; y: number; w: number; h: number };
  y: number;
  side: "left" | "right" | undefined;
  /** 辺ごとに、その辺から出す長さを返す */
  outOf: (side: "left" | "right") => number;
  /** 辺ごとに、同じ高さから出る端をずらす量を返す */
  shiftOf: (side: "left" | "right") => number;
};

/** ノードの左右の辺 */
type ReanchorSide = "left" | "right";

/** 付け替える辺を選ぶ: 補足の指定 → 元の辺（自動配置が左右のうち相手に近い方から引いた辺）→ 次の点がある側 */
const chooseSide = (
  args: ReanchorArgs,
  ends: { p1: Point; original: ReanchorSide | undefined },
): ReanchorSide => {
  const { rect, side } = args;
  const { p1, original } = ends;
  return side ?? original ?? (p1[0] >= rect.x + rect.w / 2 ? "right" : "left");
};

/**
 * 自動配置の経路の元の端を、高さ y の左右の辺へ付け替える。経路の残りは自動配置のまま使い、ノードを横切らない。
 * 辺は、補足の指定 → 元の辺 → 次の点がある側の順に選ぶ。
 * 元の辺と反対の辺から出すとき（補足の指定が元の辺と違うとき）は、ノードの上を回って元の経路へ戻す
 */
const reanchor = (args: ReanchorArgs): Point[] => {
  const { points, rect, side } = args;
  const [p0, p1] = points;
  if (!p0 || !p1) return points;
  const original =
    p0[0] === rect.x ? "left" : p0[0] === rect.x + rect.w ? "right" : undefined;
  const chosen = chooseSide(args, { p1, original });
  const sx = chosen === "right" ? rect.x + rect.w : rect.x;
  const y = args.y + args.shiftOf(chosen);
  const out = args.outOf(chosen);
  const ox = sx + (chosen === "right" ? out : -out);
  if (original === undefined || side !== undefined)
    return [[sx, y], [ox, y], [ox, p1[1]], ...points.slice(1)];
  if (chosen === original)
    return [[sx, y], [ox, y], [ox, p0[1]], ...points.slice(1)];
  const top = rect.y - out;
  return [[sx, y], [ox, y], [ox, top], [p1[0], top], ...points.slice(1)];
};

/**
 * 関連の線の両端を、つなぐ列の行の縦の中ほどの左右の辺へ付け替えた線。
 * 列を閉じたテーブルと列の無い端は、ノードの縦の中ほどにつなぐ。`ends` は補足の layout の `{関連}.ends`
 */
export const rewireMapEr = (args: {
  layout: MapLayout;
  tables: Array<{ name: string; columns: Array<{ name: string }> }>;
  relations: MapErRelation[];
  collapsed: string[];
  ends?: Record<string, { from?: string | undefined; to?: string | undefined }>;
}): MapLayout["wires"] => {
  const relations = new Map(args.relations.map((item) => [item.id, item]));
  const columnsOf = new Map(
    args.tables.map((table) => [
      table.name,
      table.columns.map((column) => column.name),
    ]),
  );
  const sideOf = (value: string | undefined) =>
    value === "left" || value === "right" ? value : undefined;
  /** ノードの辺ごとの、つないだ端の数（同じ辺から出る端を縦の区間が重ならないようずらす） */
  const used = new Map<string, number>();
  /** 辺と高さごとの、つないだ端の数（同じ列の行から同じ辺へ出る端を MAP_ER.shift ずつずらす） */
  const rows = new Map<string, number>();
  const shiftFor = (node: string, y: number) => (side: "left" | "right") => {
    const key = `${node}:${side}:${y}`;
    const count = rows.get(key) ?? 0;
    rows.set(key, count + 1);
    return count * MAP_ER.shift;
  };
  const outFor = (node: string) => (side: "left" | "right") => {
    const key = `${node}:${side}`;
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    return MAP_ER.endOut + count * MAP_ER.step;
  };
  return args.layout.wires.map((wire) => {
    const relation = relations.get(wire.id);
    const from = args.layout.nodes.find((node) => node.id === wire.from);
    const to = args.layout.nodes.find((node) => node.id === wire.to);
    if (!relation || !from || !to || wire.points.length < 2) return wire;
    const yOf = (
      node: { id: string; y: number; h: number },
      column: string | undefined,
    ): number => {
      const index =
        column === undefined
          ? -1
          : (columnsOf.get(node.id) ?? []).indexOf(column);
      return index < 0 || args.collapsed.includes(node.id)
        ? node.y + node.h / 2
        : node.y + MAP_ER.head + index * MAP_ER.row + MAP_ER.row / 2;
    };
    const fromColumn =
      wire.from === relation.from ? relation.fromColumn : relation.toColumn;
    const toColumn =
      wire.to === relation.to ? relation.toColumn : relation.fromColumn;
    const ends = args.ends?.[wire.id];
    const fromY = yOf(from, fromColumn);
    let points = reanchor({
      points: wire.points as Point[],
      rect: from,
      y: fromY,
      side: sideOf(ends?.from),
      outOf: outFor(from.id),
      shiftOf: shiftFor(from.id, fromY),
    });
    const toY = yOf(to, toColumn);
    points = reanchor({
      points: [...points].reverse(),
      rect: to,
      y: toY,
      side: sideOf(ends?.to),
      outOf: outFor(to.id),
      shiftOf: shiftFor(to.id, toY),
    }).reverse();
    return { ...wire, points };
  });
};

/** 両端の区間を除いた最も長い区間（無ければ全体） */
const longestInner = (points: Point[]): [Point, Point] => {
  let best: [Point, Point] = [
    points[0] as Point,
    points[points.length - 1] as Point,
  ];
  let length = -1;
  for (let at = 1; at < points.length - 2; at++) {
    const a = points[at] as Point;
    const b = points[at + 1] as Point;
    const size = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (size > length) {
      length = size;
      best = [a, b];
    }
  }
  return best;
};

/** 関連のラベルの置き場所（両端を除いた最も長い区間の中ほどの、縦の区間なら右・横の区間なら上） */
const erMarkOf = (points: Point[]): { label: Point; vertical: boolean } => {
  const [a, b] = longestInner(points);
  const vertical = a[0] === b[0];
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return {
    label: vertical ? [mid[0] + 8, mid[1] + 4] : [mid[0], mid[1] - 8],
    vertical,
  };
};

/**
 * 行が増える関連のマーカーの置き場所。両端を除いた区間を長い順に、区間の中ほど → 4 分の 1 → 4 分の 3 の位置で、
 * ラベルの反対側を試し、次にラベルの側を試して、避ける矩形（ノードの左右に空ける幅を含む矩形と、多重度・ラベルの文字の矩形）のどれとも重ならない最初の置き場所にする。
 * 全て重なるときは最も長い区間の中ほどのラベルの反対側
 */
const fanoutMarkOf = (points: Point[], avoid: Rect[]): Point => {
  const inner = points.slice(1, -1);
  const segments: Array<[Point, Point]> =
    inner.length >= 2
      ? inner.slice(0, -1).map((a, at) => [a, inner[at + 1] as Point])
      : [[points[0] as Point, points[points.length - 1] as Point]];
  segments.sort(
    ([a, b], [c, d]) =>
      Math.hypot(d[0] - c[0], d[1] - c[1]) -
      Math.hypot(b[0] - a[0], b[1] - a[1]),
  );
  const half = MAP_ER.fanoutSize / 2;
  const free = ([x, y]: Point) =>
    avoid.every(
      (rect) =>
        x + half <= rect.x ||
        rect.x + rect.w <= x - half ||
        y + half <= rect.y ||
        rect.y + rect.h <= y - half,
    );
  /** 区間の位置 t の、ラベルの反対側（`away`）かラベルの側の点 */
  const at = ([a, b]: [Point, Point], t: number, away: boolean): Point => {
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const gap = away ? MAP_ER.fanoutGap : -MAP_ER.fanoutGap;
    return a[0] === b[0] ? [x - gap, y] : [x, y + gap];
  };
  const candidates = [true, false].flatMap((away) =>
    segments.flatMap((segment) =>
      [0.5, 0.25, 0.75].map((t) => at(segment, t, away)),
    ),
  );
  return candidates.find(free) ?? (candidates[0] as Point);
};

/** 配置した文字の左端・ベースライン・幅 */
type PlacedText = { x: number; y: number; w: number };

/** 多重度とラベルの `text` */
const erMarkText = (
  dim: ReadonlySet<string>,
  options: {
    wire: string;
    at: Point;
    value: string;
    className: string;
    anchor: "start" | "middle" | "end";
  },
): string =>
  `<text class="${options.className}${dim.has(options.wire) ? " map-dim" : ""}" data-wire-mark="${escapeHtml(options.wire)}" x="${options.at[0]}" y="${options.at[1]}" text-anchor="${options.anchor}">${escapeHtml(options.value)}</text>`;

/** 関連の両端（端の点・隣の点・その端の多重度） */
const erEnds = (
  wire: MapLayout["wires"][number],
  relation: MapErRelation,
): Array<[Point, Point, string]> => {
  const points = wire.points as Point[];
  return [
    [
      points[0] as Point,
      points[1] as Point,
      wire.from === relation.from
        ? relation.fromCardinality
        : relation.toCardinality,
    ],
    [
      points[points.length - 1] as Point,
      points[points.length - 2] as Point,
      wire.to === relation.to
        ? relation.toCardinality
        : relation.fromCardinality,
    ],
  ];
};

/** 多重度の位置。先に配置した多重度と重なるときは、ノードから離れる向きへずらし、配置した多重度に足す */
const placeCardinality = (
  placed: PlacedText[],
  end: { x: number; y: number; nx: number; value: string },
): { at: Point; right: boolean } => {
  const { x, y, nx, value } = end;
  const right = nx >= x;
  const width = value.length * MAP_ER.cardinalityChar;
  const baseline = y - 5;
  let at = x + (right ? MAP_ER.cardinalityGap : -MAP_ER.cardinalityGap);
  const leftOf = () => (right ? at : at - width);
  const hits = (item: PlacedText, left: number) =>
    left < item.x + item.w &&
    item.x < left + width &&
    Math.abs(item.y - baseline) < MAP_ER.cardinalityLine;
  for (
    let other = placed.find((item) => hits(item, leftOf()));
    other !== undefined;
    other = placed.find((item) => hits(item, leftOf()))
  )
    at = right
      ? other.x + other.w + MAP_ER.cardinalityGap
      : other.x - MAP_ER.cardinalityGap;
  placed.push({ x: leftOf(), y: baseline, w: width });
  return { at: [at, baseline], right };
};

/** ラベルの位置。先に配置したラベルと重なるときは、1 行分ずつ下へずらし、配置したラベルに足す */
const placeLabel = (
  placed: PlacedText[],
  label: { at: Point; vertical: boolean; width: number },
): Point => {
  const { vertical, width } = label;
  const [x, start] = label.at;
  let y = start;
  const left = vertical ? x : x - width / 2;
  while (
    placed.some(
      (other) =>
        left < other.x + other.w &&
        other.x < left + width &&
        Math.abs(other.y - y) < MAP_ER.labelLine,
    )
  )
    y += MAP_ER.labelLine;
  placed.push({ x: left, y, w: width });
  return [x, y];
};

/** 配置した多重度・ラベルの文字 */
type ErMark = {
  wire: string;
  at: Point;
  value: string;
  className: "map-er-cardinality" | "map-er-label";
  anchor: "start" | "middle" | "end";
};

/** 関連の両端の多重度と、両端を除いた最も長い区間の中ほどのラベルの置き場所 */
const placeErMarks = (
  layout: MapLayout,
  relations: MapErRelation[],
): ErMark[] => {
  const byId = new Map(relations.map((item) => [item.id, item]));
  const marks: ErMark[] = [];
  const cardinalities: PlacedText[] = [];
  const labels: PlacedText[] = [];
  for (const wire of layout.wires) {
    const relation = byId.get(wire.id);
    const points = wire.points as Point[];
    if (!relation || points.length < 2) continue;
    for (const [[x, y], [nx], value] of erEnds(wire, relation)) {
      const { at, right } = placeCardinality(cardinalities, {
        x,
        y,
        nx,
        value,
      });
      marks.push({
        wire: wire.id,
        at,
        value,
        className: "map-er-cardinality",
        anchor: right ? "start" : "end",
      });
    }
    if (relation.label === undefined) continue;
    const place = erMarkOf(points);
    const at = placeLabel(labels, {
      at: place.label,
      vertical: place.vertical,
      width: relation.label.length * MAP_ER.labelChar,
    });
    marks.push({
      wire: wire.id,
      at,
      value: relation.label,
      className: "map-er-label",
      anchor: place.vertical ? "start" : "middle",
    });
  }
  return marks;
};

/** 多重度・ラベルの文字の矩形（文字の幅と高さの見積もり） */
const erMarkRect = (mark: ErMark): Rect => {
  const label = mark.className === "map-er-label";
  const w =
    mark.value.length * (label ? MAP_ER.labelChar : MAP_ER.cardinalityChar);
  const h = label ? MAP_ER.labelLine : MAP_ER.cardinalityLine;
  const [x, y] = mark.at;
  const left =
    mark.anchor === "middle" ? x - w / 2 : mark.anchor === "end" ? x - w : x;
  return { x: left, y: y - h, w, h };
};

/** 関連の両端の多重度とラベルの SVG。文字は `data-wire-mark` に関連の ID を持ち、薄くする関連は `map-dim` */
export const renderMapErMarks = (args: {
  layout: MapLayout;
  relations: MapErRelation[];
  dim: ReadonlySet<string>;
}): string => {
  const texts = placeErMarks(args.layout, args.relations).map((mark) =>
    erMarkText(args.dim, mark),
  );
  return `<svg class="map-er-marks" width="${args.layout.width}" height="${args.layout.height}" aria-hidden="true">${texts.join("")}</svg>`;
};

/** 行が増える関連のマーカー（`button.map-er-fanout`）と、その説明のツールチップ */
export const renderMapErFanouts = (args: {
  layout: MapLayout;
  relations: MapErRelation[];
  fanouts: MapErFanout[];
  /** ツールチップの id の頭 */
  id: string;
}): MapPart => {
  const tips = createTips(`${args.id}-fanout`);
  const avoid: Rect[] = [
    ...args.layout.nodes.map((node) => ({
      x: node.x - MAP_ER.aside,
      y: node.y,
      w: node.w + MAP_ER.aside * 2,
      h: node.h,
    })),
    ...placeErMarks(args.layout, args.relations).map(erMarkRect),
  ];
  const html = args.fanouts
    .flatMap((fanout, index) => {
      const wire = args.layout.wires.find((item) => item.id === fanout.wire);
      if (!wire || wire.points.length < 2) return [];
      const mark = fanoutMarkOf(wire.points as Point[], avoid);
      const owner = `fanout:${index}`;
      const tip = tips.add({
        kind: "wire",
        label: "行が増える関連",
        tip: `${fanout.from} から ${fanout.to} へたどると、${fanout.from} の 1 行に ${fanout.to} の行が複数つながり、行が増えます`,
        owner,
      });
      return [
        `<button class="map-er-fanout" type="button" style="left:${mark[0]}px;top:${mark[1]}px" aria-label="${escapeHtml(`${fanout.from} から ${fanout.to} で行が増える`)}" aria-describedby="${escapeHtml(tip)}" data-tip-owner="${escapeHtml(owner)}">×n</button>`,
      ];
    })
    .join("");
  return { html, tips: tips.html() };
};

/** 部品『mapのER図』の引数。`layout` の関連の線は rewireMapEr で付け替えた線 */
export type MapErArgs = MapFlowArgs & {
  tables: Array<Omit<MapErTableArgs, "collapsed" | "id">>;
  relations: MapErRelation[];
  fanouts: MapErFanout[];
};

/** 部品『mapのER図』の HTML。構成図の部品のテーブルのノードに列の行と開閉のボタンを入れ、関連の多重度・ラベルと行が増える関連のマーカーを重ねる */
export const renderMapErDiagram = (args: MapErArgs): MapPart => {
  const id = args.id ?? "map";
  const shown = new Set(
    args.layout.nodes.filter((node) => !node.faded).map((node) => node.id),
  );
  const nodeParts: Record<string, MapNodePart> = {};
  for (const [index, table] of args.tables.entries()) {
    if (!shown.has(table.name)) continue;
    // 補足の `{テーブル}.{列}` の注記を、列の名前ごとの注記にする
    const columnNotes = Object.fromEntries(
      Object.entries(args.annotations ?? {}).flatMap(([key, notes]) =>
        key.startsWith(`${table.name}.`)
          ? [[key.slice(table.name.length + 1), notes]]
          : [],
      ),
    );
    const part = renderMapEr({
      ...table,
      collapsed: args.collapsed.includes(table.name),
      id: `${id}-er-${index}`,
      annotations: columnNotes,
      ownerPrefix: noteOwnerPrefix(args.id),
      hints: args.hints,
    });
    nodeParts[table.name] = {
      head: part.toggle,
      body: part.columns,
      tips: part.tips,
    };
  }
  // テーブルを 1 つ選んだときは、その関連と相手のテーブルを残す
  const only = args.selected.length === 1 ? args.selected[0] : undefined;
  const near = args.relations.filter(
    (relation) => relation.from === only || relation.to === only,
  );
  const keep =
    only === undefined
      ? args.keep
      : {
          nodes: [only, ...near.flatMap((item) => [item.from, item.to])],
          wires: near.map((item) => item.id),
        };
  // 関連の線は設定の線の種類によらず矢じりを持たず、`..` の関連は破線
  const lines = {
    ...args.lines,
    "---": { ...args.lines["---"], head: "none" as const },
    "-.->": {
      ...args.lines["-.->"],
      dash: "dashed" as const,
      head: "none" as const,
    },
  };
  const flow = renderMapFlow({ ...args, lines, nodeParts, keep });
  const kept = keptOf({ ...args, keep });
  const dim = new Set(
    kept === undefined
      ? []
      : args.layout.wires
          .filter((wire) => !kept.wires.has(wire.id))
          .map((wire) => wire.id),
  );
  const marks = renderMapErMarks({
    layout: args.layout,
    relations: args.relations,
    dim,
  });
  const fanouts = renderMapErFanouts({
    layout: args.layout,
    relations: args.relations,
    fanouts: args.fanouts,
    id,
  });
  return {
    html: `${flow.html}${marks}${fanouts.html}`,
    tips: `${flow.tips}${fanouts.tips}`,
  };
};

/** 部品『mapの状態遷移図』の同じ状態への遷移の引数 */
export type MapStateLoopArgs = {
  wire: string;
  x: number;
  y: number;
  width: number;
  label: string | undefined;
  /** 再生でその遷移の手順か */
  active: boolean;
  dim: boolean;
};

/** 同じ状態への遷移の折れ線の点（状態の右の辺から出て上を回り、上の辺へ戻る） */
export const stateLoopPoints = (
  args: Pick<MapStateLoopArgs, "x" | "y" | "width">,
): Array<[number, number]> => [
  [args.x + args.width, args.y + 14],
  [args.x + args.width + 20, args.y + 14],
  [args.x + args.width + 20, args.y - 20],
  [args.x + args.width / 2, args.y - 20],
  [args.x + args.width / 2, args.y],
];

/** 部品『mapの状態遷移図』の同じ状態への遷移の線・押せる帯・ラベル */
export const renderMapState = (args: MapStateLoopArgs): string => {
  const points = stateLoopPoints(args);
  const d = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
    .join("");
  const classes = `map-state-loop${args.active ? " is-active" : ""}${args.dim ? " map-dim" : ""}`;
  const name = `${args.label ?? ""}（同じ状態への遷移）`;
  const label =
    args.label === undefined
      ? ""
      : `<text class="map-state-loop-label${args.dim ? " map-dim" : ""}" x="${args.x + args.width / 2 + 8}" y="${args.y - 26}">${escapeHtml(args.label)}</text>`;
  return `<g data-loop="${escapeHtml(args.wire)}"><path class="${classes}" data-wire="${escapeHtml(args.wire)}" d="${d}"></path><path class="map-wire-hit" data-wire="${escapeHtml(args.wire)}" tabindex="0" role="button" aria-label="${escapeHtml(name)}" d="${d}"></path>${label}</g>`;
};

/** 部品『mapの状態遷移図』のノードの寸法（px）。`loopSpace` は同じ状態への遷移を持つ状態の上に空ける高さ */
export const MAP_STATE = {
  point: 32,
  choice: 40,
  loopSpace: 56,
  /** 並行の分岐と合流（`<<fork>>`・`<<join>>`）の細い棒の幅と高さ */
  forkWidth: 72,
  forkHeight: 10,
} as const;

/** 部品『mapの状態遷移図』の同じ状態への遷移（`node` は状態の ID） */
export type MapStateLoop = {
  wire: string;
  node: string;
  label: string | undefined;
};

/** 同じ状態への遷移の SVG。`active` は再生でその遷移の手順、`dim` は薄くする遷移の ID */
export const renderMapStateLoops = (args: {
  layout: MapLayout;
  loops: MapStateLoop[];
  active: ReadonlySet<string>;
  dim: ReadonlySet<string>;
}): string => {
  const loops = args.loops
    .flatMap((loop) => {
      const node = args.layout.nodes.find((item) => item.id === loop.node);
      return node
        ? [
            renderMapState({
              wire: loop.wire,
              x: node.x,
              y: node.y,
              width: node.w,
              label: loop.label,
              active: args.active.has(loop.wire),
              dim: args.dim.has(loop.wire),
            }),
          ]
        : [];
    })
    .join("");
  return `<svg class="map-state-loops" width="${args.layout.width}" height="${args.layout.height}">${loops}</svg>`;
};

/** 部品『mapの状態遷移図』の引数 */
export type MapStateArgs = MapFlowArgs & {
  shapes: Record<string, MapStateShape>;
  loops: MapStateLoop[];
};

/** 薄くする同じ状態への遷移（選んだ状態の遷移と、強調する遷移のほか） */
export const mapStateLoopDim = (args: {
  loops: MapStateLoop[];
  selected: ReadonlySet<string>;
  focus: ReadonlySet<string> | undefined;
}): Set<string> =>
  new Set(
    args.loops
      .filter((loop) =>
        args.selected.size > 0
          ? !args.selected.has(loop.node)
          : args.focus !== undefined && !args.focus.has(loop.wire),
      )
      .map((loop) => loop.wire),
  );

/** 部品『mapの状態遷移図』の HTML。構成図の部品に開始・終了・分岐の形状とノートの種類の行を付け、同じ状態への遷移を重ねる */
export const renderMapStateDiagram = (args: MapStateArgs): MapPart => {
  const flow = renderMapFlow(args);
  const focus =
    args.focus === undefined ? undefined : new Set(args.focus.wires);
  const loops = renderMapStateLoops({
    layout: args.layout,
    loops: args.loops,
    active: focus ?? new Set(),
    dim: mapStateLoopDim({
      loops: args.loops,
      selected: new Set(args.selected),
      focus,
    }),
  });
  return { html: `${flow.html}${loops}`, tips: flow.tips };
};

/** 部品『mapのクラス図』のクラスのノードの寸法（px）。メンバーの行は、名前の行の下から同じ高さで並ぶ */
export const MAP_CLASS = {
  width: 220,
  /** 名前の行（名前と種類と開閉のボタンの 1 行）の高さ */
  head: 36,
  row: 22,
  /** 折り返したメンバーの 2 行目からの 1 行の高さ（メンバーの文字の line-height） */
  line: 16,
  /** 属性とメソッドの区画を分ける区切り線の分の高さ */
  divider: 6,
  foot: 6,
  /** メンバーの等幅の文字の 1 文字の幅（全角・半角）の見積もり */
  charWide: 12,
  charNarrow: 7.2,
  /** メンバーの行の、文字の列の外の幅（ノードの枠線・左右の余白・可視性の列・説明のボタンの列・列の間） */
  memberInset: 66,
  /** 関係のラベルの前後に空ける幅 */
  labelGap: 8,
  /** 端の形の長さと、幅の半分 */
  endLength: 14,
  endHalf: 6,
} as const;

/** 全角の文字か */
const isWideChar = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0;
  return !(code <= 0x7e || (code >= 0xff61 && code <= 0xff9f));
};

/** メンバーの等幅の文字の幅の見積もり（全角を `charWide`、半角を `charNarrow`） */
export const mapClassTextWidth = (text: string): number =>
  [...text].reduce(
    (sum, char) =>
      sum + (isWideChar(char) ? MAP_CLASS.charWide : MAP_CLASS.charNarrow),
    0,
  );

/** メンバーの文字を、クラスの幅から文字の列の外の幅を除いた幅で折り返した行の数 */
export const mapClassMemberLines = (member: {
  text: string;
  width: number;
}): number => {
  const room = Math.max(1, member.width - MAP_CLASS.memberInset);
  let lines = 1;
  let used = 0;
  for (const char of member.text) {
    const advance = isWideChar(char)
      ? MAP_CLASS.charWide
      : MAP_CLASS.charNarrow;
    if (used > 0 && used + advance > room) {
      lines += 1;
      used = 0;
    }
    used += advance;
  }
  return lines;
};

/** メンバーの行 1 つの高さ */
const classRowHeight = (lines: number): number =>
  MAP_CLASS.row + (lines - 1) * MAP_CLASS.line;

/** クラスのノードの大きさ（メンバーを閉じたクラスと、メンバーを持たないクラスは名前の行だけ） */
export const mapClassNodeSize = (args: {
  width: number;
  lines: number[];
  collapsed: boolean;
}): { w: number; h: number } => ({
  w: args.width,
  h:
    args.collapsed || args.lines.length === 0
      ? MAP_CLASS.head
      : MAP_CLASS.head +
        args.lines.reduce((sum, lines) => sum + classRowHeight(lines), 0) +
        MAP_CLASS.divider * 2 +
        MAP_CLASS.foot,
});

/** 部品『mapのクラス図』のクラスの中身 */
export type MapClassNode = {
  id: string;
  annotation: string | undefined;
  members: Array<{
    visibility: string;
    name: string;
    text: string;
    method: boolean;
    isStatic: boolean;
    isAbstract: boolean;
    /** クラスの幅で折り返した行の数（1 以上） */
    lines: number;
  }>;
};

/** 部品『mapのクラス図』の関係の端（`wire` は関係の ID） */
export type MapClassEnd = {
  wire: string;
  at: "from" | "to";
  shape: "triangle" | "diamond-filled" | "diamond-open" | "arrow" | undefined;
  card: string | undefined;
};

/** 部品『mapのクラス図』のクラスの中身の引数 */
export type MapClassMembersArgs = {
  node: MapClassNode;
  /** メンバーの名前ごとの説明 */
  notes: Record<string, string>;
  collapsed: boolean;
  /** メンバーの名前ごとの注記（番号の順） */
  annotations?: Record<string, DiagramAnnotation[]> | undefined;
  /** 注記を持つメンバーの説明のボタンの `id` の頭 */
  ownerPrefix?: string | undefined;
  /** 機能 `hints` がオンか（既定 `true`） */
  hints?: boolean | undefined;
  /** ツールチップの id の頭 */
  id?: string | undefined;
};

/** 注記を持つメンバーの持ち主の `id` の属性（注記が無いか `ownerPrefix` が無ければ空） */
const classMemberOwnerId = (args: MapClassMembersArgs, name: string): string =>
  (args.annotations?.[name]?.length ?? 0) > 0 && args.ownerPrefix !== undefined
    ? ` id="${escapeHtml(noteOwnerId(args.ownerPrefix, `${args.node.id}.${name}`))}"`
    : "";

/** クラス図のメンバーの説明のボタンと、そのツールチップ */
const classMemberNote = (
  args: MapClassMembersArgs,
  context: {
    member: MapClassNode["members"][number];
    tips: TipList;
    ownerId: string;
  },
): string => {
  const { member, tips, ownerId } = context;
  const note = args.notes[member.name];
  const notes = args.annotations?.[member.name];
  const owner = `member:${args.node.id}.${member.name}`;
  const label = infoLabel({
    name: member.name,
    described: note !== undefined,
    annotated: (notes?.length ?? 0) > 0,
  }).replace(/^「(.*)」/, "$1");
  return `<button class="map-class-note" type="button"${ownerId} aria-label="${escapeHtml(label)}" aria-describedby="${tips.add({ kind: "hint", label: member.name, hint: note, owner, annotations: notes })}" data-tip-owner="${escapeHtml(owner)}">i</button>`;
};

/** メンバーが説明か注記を持つか */
const classMemberDescribed = (
  args: MapClassMembersArgs,
  name: string,
): boolean =>
  args.notes[name] !== undefined || (args.annotations?.[name]?.length ?? 0) > 0;

/** メンバーの行の class（静的は is-static、抽象は is-abstract） */
const classMemberClasses = (member: MapClassNode["members"][number]): string =>
  [
    "map-class-member",
    member.isStatic ? "is-static" : "",
    member.isAbstract ? "is-abstract" : "",
  ]
    .filter((name) => name !== "")
    .join(" ");

/** クラス図のメンバーの行 1 つ。説明か注記を持つメンバーは、説明のボタンとツールチップを持つ */
const renderMapClassMember = (
  args: MapClassMembersArgs,
  context: { member: MapClassNode["members"][number]; tips: TipList },
): string => {
  const { member, tips } = context;
  const ownerId = classMemberOwnerId(args, member.name);
  const plain = args.hints === false;
  const row = plain && ownerId !== "" ? `${ownerId} tabindex="-1"` : "";
  const mark =
    plain || !classMemberDescribed(args, member.name)
      ? ""
      : classMemberNote(args, { member, tips, ownerId });
  return `<div class="${classMemberClasses(member)}"${row} role="listitem" data-member="${escapeHtml(member.name)}"><span class="map-class-visibility">${escapeHtml(member.visibility)}</span><span class="map-class-text">${escapeHtml(member.text)}</span><span class="map-class-info-cell">${mark}</span></div>`;
};

/** 部品『mapのクラス図』のクラスの中身。メンバーを開閉するボタン・属性とメソッドの区画・メンバーの説明のツールチップ */
export const renderMapClassMembers = (
  args: MapClassMembersArgs,
): { toggle: string; members: string; tips: string } => {
  const { node } = args;
  const count = node.members.length;
  const label = `${node.id}のメンバーを${args.collapsed ? "開く" : "閉じる"}`;
  const toggle =
    count === 0
      ? ""
      : `<button class="map-class-toggle" type="button" data-node-toggle="${escapeHtml(node.id)}" aria-expanded="${!args.collapsed}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${iconSvg("chevron-down")}</button>`;
  if (args.collapsed || count === 0) return { toggle, members: "", tips: "" };
  const tips = createTips(args.id ?? `map-class-${node.id}`);
  const attributes = node.members.filter((member) => !member.method);
  const methods = node.members.filter((member) => member.method);
  const list = (items: MapClassNode["members"], top: number): string =>
    `<div class="map-class-members" role="list" style="top:${top}px;grid-template-rows:${items.map((member) => `${classRowHeight(member.lines)}px`).join(" ")}">${items.map((member) => renderMapClassMember(args, { member, tips })).join("")}</div>`;
  const second =
    MAP_CLASS.head +
    attributes.reduce((sum, member) => sum + classRowHeight(member.lines), 0) +
    MAP_CLASS.divider;
  return {
    toggle,
    members: `${list(attributes, MAP_CLASS.head)}${list(methods, second)}`,
    tips: tips.html(),
  };
};

/** 線の端の点と、端から線の内側へ向かう単位の向き */
const wireEndOf = (
  points: Point[],
  at: "from" | "to",
): { tip: Point; dir: Point } => {
  const tip = (at === "from" ? points[0] : points.at(-1)) as Point;
  const next = (at === "from" ? points[1] : points.at(-2)) as Point;
  const length = Math.hypot(next[0] - tip[0], next[1] - tip[1]) || 1;
  return {
    tip,
    dir: [(next[0] - tip[0]) / length, (next[1] - tip[1]) / length],
  };
};

/** 関係の端の形の `d`（三角とひし形は閉じた形、矢じりは開いた形） */
const classEndPath = (
  shape: NonNullable<MapClassEnd["shape"]>,
  end: { tip: Point; dir: Point },
): string => {
  const { tip, dir } = end;
  const along = (k: number): Point => [
    tip[0] + dir[0] * k,
    tip[1] + dir[1] * k,
  ];
  const side = (base: Point, k: number): Point => [
    base[0] - dir[1] * k,
    base[1] + dir[0] * k,
  ];
  const { endLength: length, endHalf: half } = MAP_CLASS;
  const fmt = ([x, y]: Point) =>
    `${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`;
  if (shape === "triangle") {
    const base = along(length);
    return `M${fmt(tip)}L${fmt(side(base, half))}L${fmt(side(base, -half))}Z`;
  }
  if (shape === "arrow") {
    const base = along(length * 0.8);
    return `M${fmt(side(base, half))}L${fmt(tip)}L${fmt(side(base, -half))}`;
  }
  const middle = along(length * 0.6);
  return `M${fmt(tip)}L${fmt(side(middle, half * 0.8))}L${fmt(along(length * 1.2))}L${fmt(side(middle, -half * 0.8))}Z`;
};

/** 関係の端 1 つの形と多重度の SVG の要素 */
const classEndMarks = (
  dim: ReadonlySet<string>,
  context: { end: MapClassEnd; points: Point[]; cardinalities: PlacedText[] },
): string[] => {
  const { end, points, cardinalities } = context;
  const at = wireEndOf(points, end.at);
  const dimmed = dim.has(end.wire) ? " map-dim" : "";
  const shape =
    end.shape === undefined
      ? []
      : [
          `<path class="map-class-end map-class-end-${end.shape}${dimmed}" data-wire-mark="${escapeHtml(end.wire)}" data-end-shape="${end.shape}" d="${classEndPath(end.shape, at)}"></path>`,
        ];
  if (end.card === undefined) return shape;
  const near: Point = [
    at.tip[0] + at.dir[0] * (MAP_CLASS.endLength + 4),
    at.tip[1] + at.dir[1] * (MAP_CLASS.endLength + 4),
  ];
  const placed = placeCardinality(cardinalities, {
    x: near[0],
    y: near[1],
    nx: near[0] + (at.dir[0] < 0 ? -1 : 1),
    value: end.card,
  });
  return [
    ...shape,
    erMarkText(dim, {
      wire: end.wire,
      at: placed.at,
      value: end.card,
      className: "map-class-card",
      anchor: placed.right ? "start" : "end",
    }),
  ];
};

/** 配置した文字の矩形（ベースラインから上へ 1 行の高さ） */
const textRect = (text: PlacedText): Rect => ({
  x: text.x,
  y: text.y - MAP_ER.labelLine + 4,
  w: text.w,
  h: MAP_ER.labelLine,
});

/**
 * 関係のラベルの置き場所。両端を除いた区間を長い順に、区間の中ほど → 4 分の 1 → 4 分の 3 の位置で、
 * 縦の区間なら右 → 左、横の区間なら上 → 下を試し、避ける矩形のどれとも重ならない最初の置き場所にする。全て重なるときは無し
 */
const classLabelPlace = (
  points: Point[],
  label: { width: number; avoid: Rect[] },
):
  | { at: Point; left: number; anchor: "start" | "middle" | "end" }
  | undefined => {
  const inner = points.slice(1, -1);
  const segments: Array<[Point, Point]> =
    inner.length >= 2
      ? inner.slice(0, -1).map((a, at) => [a, inner[at + 1] as Point])
      : [[points[0] as Point, points[points.length - 1] as Point]];
  segments.sort(
    ([a, b], [c, d]) =>
      Math.hypot(d[0] - c[0], d[1] - c[1]) -
      Math.hypot(b[0] - a[0], b[1] - a[1]),
  );
  const { width } = label;
  const gap = MAP_CLASS.labelGap;
  for (const [a, b] of segments) {
    const vertical = a[0] === b[0];
    for (const t of [0.5, 0.25, 0.75]) {
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const options = vertical
        ? [
            {
              at: [x + gap, y + 4] as Point,
              left: x + gap,
              anchor: "start" as const,
            },
            {
              at: [x - gap, y + 4] as Point,
              left: x - gap - width,
              anchor: "end" as const,
            },
          ]
        : [
            {
              at: [x, y - gap] as Point,
              left: x - width / 2,
              anchor: "middle" as const,
            },
            {
              at: [x, y + gap + MAP_ER.labelLine - 4] as Point,
              left: x - width / 2,
              anchor: "middle" as const,
            },
          ];
      const found = options.find((option) => {
        const rect = textRect({ x: option.left, y: option.at[1], w: width });
        return label.avoid.every(
          (other) =>
            rect.x + rect.w <= other.x ||
            other.x + other.w <= rect.x ||
            rect.y + rect.h <= other.y ||
            other.y + other.h <= rect.y,
        );
      });
      if (found) return found;
    }
  }
  return undefined;
};

/** 関係の端の形と、端の近くの多重度と、両端を除いた最も長い区間の中ほどのラベルの SVG */
export const renderMapClassEnds = (args: {
  layout: MapLayout;
  ends: MapClassEnd[];
  labels?: Record<string, string> | undefined;
  dim: ReadonlySet<string>;
}): string => {
  const pointsOf = (id: string): Point[] =>
    (args.layout.wires.find((item) => item.id === id)?.points ?? []) as Point[];
  const cardinalities: PlacedText[] = [];
  const labels: PlacedText[] = [];
  // ラベルが避ける、クラス・ノートのノードとグループのタイトルの行
  const avoid: Rect[] = [
    ...args.layout.nodes.map(({ x, y, w, h }) => ({ x, y, w, h })),
    ...args.layout.groups
      .filter((group) => !group.collapsed)
      .map(({ x, y, w }) => ({ x, y, w, h: MAP_LAYOUT.groupTitle })),
  ];
  const parts = [
    ...args.ends.flatMap((end) => {
      const points = pointsOf(end.wire);
      return points.length < 2
        ? []
        : classEndMarks(args.dim, { end, points, cardinalities });
    }),
    ...Object.entries(args.labels ?? {}).flatMap(([id, label]) => {
      const points = pointsOf(id);
      if (points.length < 2) return [];
      const width = label.length * MAP_ER.labelChar;
      const free = classLabelPlace(points, {
        width,
        avoid: [...avoid, ...[...cardinalities, ...labels].map(textRect)],
      });
      if (free) {
        labels.push({ x: free.left, y: free.at[1], w: width });
        return [
          erMarkText(args.dim, {
            wire: id,
            at: free.at,
            value: label,
            className: "map-class-label",
            anchor: free.anchor,
          }),
        ];
      }
      const place = erMarkOf(points);
      const at = placeLabel(labels, {
        at: place.label,
        vertical: place.vertical,
        width,
      });
      return [
        erMarkText(args.dim, {
          wire: id,
          at,
          value: label,
          className: "map-class-label",
          anchor: place.vertical ? "start" : "middle",
        }),
      ];
    }),
  ];
  return `<svg class="map-class-ends" width="${args.layout.width}" height="${args.layout.height}" aria-hidden="true">${parts.join("")}</svg>`;
};

/** 部品『mapのクラス図』の引数。`layout` の線は `attachMapFlow` が `spreadWireEnds` で端を並べた線 */
export type MapClassArgs = MapFlowArgs & {
  classes: MapClassNode[];
  ends: MapClassEnd[];
};

/** 部品『mapのクラス図』の HTML。クラスのノードに注釈・メンバーの区画・開閉のボタンを入れ、関係の端の形・多重度・ラベルを重ねる */
export const renderMapClassDiagram = (args: MapClassArgs): MapPart => {
  const id = args.id ?? "map";
  const shown = new Set(
    args.layout.nodes.filter((node) => !node.faded).map((node) => node.id),
  );
  const nodeParts: Record<string, MapNodePart> = {};
  for (const [index, node] of args.classes.entries()) {
    if (!shown.has(node.id)) continue;
    const memberNotes = (source: Record<string, unknown> | undefined) =>
      Object.fromEntries(
        Object.entries(source ?? {}).flatMap(([key, value]) =>
          key.startsWith(`${node.id}.`)
            ? [[key.slice(node.id.length + 1), value]]
            : [],
        ),
      );
    const part = renderMapClassMembers({
      node,
      notes: memberNotes(args.notes) as Record<string, string>,
      collapsed: args.collapsed.includes(node.id),
      annotations: memberNotes(args.annotations) as Record<
        string,
        DiagramAnnotation[]
      >,
      ownerPrefix: noteOwnerPrefix(args.id),
      hints: args.hints,
      id: `${id}-class-${index}`,
    });
    const annotation =
      node.annotation === undefined
        ? ""
        : `<span class="map-class-annotation">«${escapeHtml(node.annotation)}»</span>`;
    nodeParts[node.id] = {
      head: `${annotation}${part.toggle}`,
      body: part.members,
      tips: part.tips,
    };
  }
  const classIds = new Set(args.classes.map((node) => node.id));
  const shapes: Record<string, MapStateShape> = { ...args.shapes };
  for (const node of args.layout.nodes)
    if (!classIds.has(node.id) && node.id.startsWith("note_"))
      shapes[node.id] = "note";
  // 関係の線は矢じりを持たず、`..` の関係は破線
  const lines = {
    ...args.lines,
    "---": { ...args.lines["---"], head: "none" as const },
    "-.->": {
      ...args.lines["-.->"],
      dash: "dashed" as const,
      head: "none" as const,
    },
  };
  // メンバーの説明はクラスの中のボタンに出し、クラスのマーカーには出さない
  const notes = Object.fromEntries(
    Object.entries(args.notes ?? {}).filter(([key]) => !key.includes(".")),
  );
  // 関係のラベルは線の中ほどに描くため、構成図の部品には渡さない
  const labels: Record<string, string> = {};
  const wires = args.layout.wires.map((wire) => {
    if (wire.label === undefined || wire.merged !== undefined) return wire;
    labels[wire.id] = wire.label;
    return { ...wire, label: undefined };
  });
  const flow = renderMapFlow({
    ...args,
    layout: { ...args.layout, wires },
    notes,
    lines,
    nodeParts,
    shapes,
  });
  const kept = keptOf(args);
  const dim = new Set(
    kept === undefined
      ? []
      : args.layout.wires
          .filter((wire) => !kept.wires.has(wire.id))
          .map((wire) => wire.id),
  );
  const ends = renderMapClassEnds({
    layout: args.layout,
    ends: args.ends,
    labels,
    dim,
  });
  return { html: `${flow.html}${ends}`, tips: flow.tips };
};

/** アーキテクチャ図の線の辺の指定（部品が引く値。`fromGroup`・`toGroup` は group の枠の辺を端にする） */
export type MapArchEdge = {
  id: string;
  from: string;
  fromSide: MapSide;
  fromGroup: boolean;
  to: string;
  toSide: MapSide;
  toGroup: boolean;
};

/** ノードの辺 */
type MapSide = "top" | "right" | "bottom" | "left";

/** 部品『mapのアーキテクチャ図』の寸法（px） */
export const MAP_ARCH = {
  /** junction の点の一辺 */
  junction: 16,
  /** 線の端の、辺から外へ出す長さ */
  endOut: 16,
} as const;

/** 矩形の辺の中ほどの点と、辺から外へ出た点 */
const sideAnchor = (
  rect: { x: number; y: number; w: number; h: number },
  side: MapSide,
): { at: Point; out: Point } => {
  const { x, y, w, h } = rect;
  const at: Point = {
    top: [x + w / 2, y] as Point,
    right: [x + w, y + h / 2] as Point,
    bottom: [x + w / 2, y + h] as Point,
    left: [x, y + h / 2] as Point,
  }[side];
  const out: Point = {
    top: [at[0], at[1] - MAP_ARCH.endOut] as Point,
    right: [at[0] + MAP_ARCH.endOut, at[1]] as Point,
    bottom: [at[0], at[1] + MAP_ARCH.endOut] as Point,
    left: [at[0] - MAP_ARCH.endOut, at[1]] as Point,
  }[side];
  return { at, out };
};

/** 辺から外へ出た 2 点を直角につなぐ点（左右どうしは中ほどの縦、上下どうしは中ほどの横、組なら 1 回だけ折れる） */
const elbow = (
  a: { out: Point; side: MapSide; rect: Rect },
  b: { out: Point; side: MapSide; rect: Rect },
): Point[] => {
  const horizontal = (side: MapSide) => side === "left" || side === "right";
  const [ax, ay] = a.out;
  const [bx, by] = b.out;
  if (ax === bx || ay === by) return [];
  if (horizontal(a.side) && horizontal(b.side)) {
    const mx = (ax + bx) / 2;
    return [
      [mx, ay],
      [mx, by],
    ];
  }
  if (!horizontal(a.side) && !horizontal(b.side)) {
    const my = (ay + by) / 2;
    return [
      [ax, my],
      [bx, my],
    ];
  }
  // 左右と上下の組は、折れる点の 2 つの候補のうち、両端の矩形の中を通らない方にする
  const candidates: Point[] = horizontal(a.side)
    ? [
        [bx, ay],
        [ax, by],
      ]
    : [
        [ax, by],
        [bx, ay],
      ];
  const clear = (corner: Point) =>
    [a.rect, b.rect].every(
      (rect) =>
        !segmentInside([a.out, corner], rect) &&
        !segmentInside([corner, b.out], rect),
    );
  return [candidates.find(clear) ?? (candidates[0] as Point)];
};

/** 縦か横の区間が、矩形の内側（辺を除く）を通るか */
const segmentInside = ([p, q]: [Point, Point], rect: Rect): boolean => {
  const [left, right] = [Math.min(p[0], q[0]), Math.max(p[0], q[0])];
  const [top, bottom] = [Math.min(p[1], q[1]), Math.max(p[1], q[1])];
  return (
    left < rect.x + rect.w &&
    right > rect.x &&
    top < rect.y + rect.h &&
    bottom > rect.y
  );
};

/** 矩形 */
type Rect = { x: number; y: number; w: number; h: number };

/** 線の元と先の辺と、group の枠を端にするか（補足の `ends` を Mermaid の辺の指定より優先する）。元の線が無ければ `undefined` */
const archWireSides = (
  wire: MapLayout["wires"][number],
  args: {
    edges: MapArchEdge[];
    ends?: Record<string, { from?: MapSide; to?: MapSide }> | undefined;
  },
):
  | {
      from: { side: MapSide; group: boolean };
      to: { side: MapSide; group: boolean };
    }
  | undefined => {
  const original = wire.merged?.[0] ?? { from: wire.from, to: wire.to };
  const edge = args.edges.find(
    (item) =>
      (item.from === original.from && item.to === original.to) ||
      (item.from === original.to && item.to === original.from),
  );
  if (!edge) return undefined;
  const override = args.ends?.[edge.id];
  const head = {
    side: override?.from ?? edge.fromSide,
    group: edge.fromGroup,
  };
  const tail = { side: override?.to ?? edge.toSide, group: edge.toGroup };
  return edge.from === original.from
    ? { from: head, to: tail }
    : { from: tail, to: head };
};

/** アーキテクチャ図の線を、指定の辺の中ほどから外へ出た 2 点を直角につなぐ経路に引き直す */
export const rewireMapArchitecture = (args: {
  layout: MapLayout;
  edges: MapArchEdge[];
  collapsed: string[];
  ends?: Record<string, { from?: MapSide; to?: MapSide }> | undefined;
}): MapLayout["wires"] => {
  const { layout } = args;
  const rectOf = (id: string, group: boolean) => {
    const node = layout.nodes.find((item) => item.id === id);
    if (node) {
      const owner = group ? node.ancestors[0] : undefined;
      return (
        layout.groups.find((item) => item.id === owner) ??
        (node as { x: number; y: number; w: number; h: number })
      );
    }
    return layout.groups.find((item) => item.id === id);
  };
  return layout.wires.map((wire) => {
    const sides = archWireSides(wire, args);
    if (!sides) return wire;
    const fromRect = rectOf(wire.from, sides.from.group);
    const toRect = rectOf(wire.to, sides.to.group);
    if (!fromRect || !toRect) return wire;
    const a = sideAnchor(fromRect, sides.from.side);
    const b = sideAnchor(toRect, sides.to.side);
    return {
      ...wire,
      points: [
        a.at,
        a.out,
        ...elbow(
          { out: a.out, side: sides.from.side, rect: fromRect },
          { out: b.out, side: sides.to.side, rect: toRect },
        ),
        b.out,
        b.at,
      ],
    };
  });
};

/** アイコンの名前の svg（まとめたアイコンだけ。無ければ空） */
const archIconHtml = (name: string | undefined): string => {
  const node = name === undefined ? undefined : bundledIconNode(name);
  return node ? iconNodeSvg(node as unknown as MdmarkIconNode) : "";
};

/** 部品『mapのアーキテクチャ図』の引数。`layout` の線は rewireMapArchitecture で引き直した線 */
export type MapArchArgs = MapFlowArgs & {
  /** group の ID ごとの Lucide のアイコンの名前 */
  groupIcons: Record<string, string>;
  junctions: string[];
  /** 線の ID ごとの矢じり（線の点の並びの向きで、`end` は終点） */
  heads: Record<string, "none" | "end" | "start" | "both">;
};

/** 部品『mapのアーキテクチャ図』の HTML。group のタイトルにアイコンを、junction を点にし、線の矢じりを `heads` のとおりに描く */
export const renderMapArchitecture = (args: MapArchArgs): MapPart => {
  const shapes: Record<string, MapStateShape> = { ...args.shapes };
  for (const id of args.junctions) shapes[id] = "junction";
  const lines = {
    ...args.lines,
    "mdmark-arch-plain": { ...args.lines["---"], head: "none" as const },
    "mdmark-arch-head": {
      ...args.lines["-->"],
      head: args.lines["-->"]?.head ?? ("filled" as const),
    },
  };
  const wireLines: Record<string, string> = { ...args.wireLines };
  const wires = args.layout.wires.map((wire) => {
    const head = args.heads[wire.id] ?? "none";
    wireLines[wire.id] ??=
      head === "none" ? "mdmark-arch-plain" : "mdmark-arch-head";
    return {
      ...wire,
      both: head === "both",
      // 始点の側だけに矢じりを持つ線は、点の並びを逆にして終点の矢じりで描く
      points: head === "start" ? [...wire.points].reverse() : wire.points,
    };
  });
  const flow = renderMapFlow({
    ...args,
    layout: { ...args.layout, wires },
    lines,
    wireLines,
    shapes,
  });
  let html = flow.html;
  for (const [id, icon] of Object.entries(args.groupIcons)) {
    const svg = archIconHtml(icon);
    if (svg === "") continue;
    html = html.replace(
      new RegExp(
        `(data-group="${regExpValue(id)}"[^>]*>(?:<div class="map-group-bar"[^>]*></div>)?<div class="map-group-head"[^>]*><button class="map-disclosure"[\\s\\S]*?</button>)`,
        "g",
      ),
      `$1<span class="map-group-icon">${svg}</span>`,
    );
  }
  return { html, tips: flow.tips };
};

/** 閉じたグループのノードの大きさの見積もり（開閉のボタン・タイトル・「{数} 件」の 2 行が収まる大きさ） */
export const mapClosedGroupSize = (
  title: string,
): { w: number; h: number } => ({
  w: Math.min(360, Math.max(160, title.length * 14 + 72)),
  h: 76,
});

/** C4 図の境界のタイトル（名前の後ろに種類） */
export const mapC4BoundaryTitle = (
  title: string,
  kind: keyof typeof C4_BOUNDARY_NAMES,
): string => `${title}${C4_BOUNDARY_NAMES[kind]}`;

/** 境界の種類ごとの、タイトルの後ろの文字 */
const C4_BOUNDARY_NAMES = {
  enterprise: "［Enterprise］",
  system: "［Software System］",
  container: "［Container］",
  boundary: "",
  deployment: "",
} as const;

/** 部品『mapのC4図』の引数 */
export type MapC4Args = MapFlowArgs & {
  /** 要素の ID ごとの説明 */
  descriptions: Record<string, string>;
  /** 境界の ID ごとの種類 */
  boundaries: Record<string, keyof typeof C4_BOUNDARY_NAMES>;
  /** 外部の要素（`_Ext`）の ID。灰色の面で描く */
  externals: string[];
  /** 矢じりを線の元の側に描く線の ID（`Rel_U`・`Rel_Back`） */
  reversed: string[];
};

/** 部品『mapのC4図』の HTML。要素の名前の下に説明を入れ、境界を破線の枠にしてタイトルの後ろに種類を付ける */
export const renderMapC4Diagram = (args: MapC4Args): MapPart => {
  // 説明の中の用語は、名前と同じ下線とツールチップにする
  const marker = termMarker(args.terms, `${args.id ?? "map"}-c4`);
  const nodeParts: Record<string, MapNodePart> = {};
  for (const [id, text] of Object.entries(args.descriptions)) {
    if (text === "") continue;
    nodeParts[id] = {
      head: "",
      body: `<p class="map-c4-description">${marker.render(text)}</p>`,
      tips: "",
    };
  }
  const reversed = new Set(args.reversed);
  const layout = {
    ...args.layout,
    groups: args.layout.groups.map((group) => ({
      ...group,
      title: mapC4BoundaryTitle(
        group.title,
        args.boundaries[group.id] ?? "boundary",
      ),
    })),
    // 矢じりを元の側に描く線は、点の並びを逆にして終点の矢じりで描く
    wires: args.layout.wires.map((wire) =>
      reversed.has(wire.id)
        ? { ...wire, points: [...wire.points].reverse() }
        : wire,
    ),
  };
  const flow = renderMapFlow({ ...args, layout, nodeParts });
  let html = flow.html;
  for (const [id, kind] of Object.entries(args.boundaries))
    html = html.replace(
      new RegExp(`class="(map-group[^"]*)"( data-group="${regExpValue(id)}")`),
      `class="$1 ${kind === "deployment" ? "map-c4-deployment" : "map-c4-boundary"}"$2`,
    );
  for (const id of args.externals)
    html = addClass(html, {
      attribute: "data-node",
      id,
      name: "map-c4-external",
    });
  return { html, tips: `${flow.tips}${marker.tips.html()}` };
};

/** 部品『mapのマインドマップ』の引数。項目は `stateKey` で指す */
export type MapMindmapArgs = {
  mindmap: Mindmap;
  tree: MindmapLayout;
  /** 補足の `layout` の `color` を持つ項目（その色の面も付ける） */
  filled: ReadonlySet<string>;
  collapsed: string[];
  entered: string | undefined;
  selected: string | undefined;
  focus: { nodes: string[] } | undefined;
  notes: Record<string, string>;
  annotations: Record<string, DiagramAnnotation[]>;
  hints?: boolean | undefined;
  id: string;
  terms?: Record<string, string> | undefined;
};

/** 描くときに繰り返し引く値 */
type MindmapContext = {
  args: MapMindmapArgs;
  byKey: Map<string, MindmapItem>;
  /** 薄くせずに残す項目（選択と案内の強調が無ければ undefined） */
  kept: Set<string> | undefined;
  marker: TermMarker;
  tips: TipList;
  ownerPrefix: string;
};

/** 全体の根から項目までの項目（両端を含む） */
const mindmapPath = (mindmap: Mindmap, item: MindmapItem): MindmapItem[] => {
  const path: MindmapItem[] = [];
  let at: MindmapItem | undefined = item;
  while (at) {
    path.unshift(at);
    at = at.parent === undefined ? undefined : mindmap.items[at.parent];
  }
  return path;
};

/** 項目の子孫 */
const mindmapDescendants = (
  mindmap: Mindmap,
  item: MindmapItem,
): MindmapItem[] =>
  item.children.flatMap((order) => {
    const child = mindmap.items[order];
    return child ? [child, ...mindmapDescendants(mindmap, child)] : [];
  });

/** 選んだ項目の道筋と子孫、無ければ案内で強調する項目と道筋。どちらも無ければ undefined */
const mindmapKept = (
  args: MapMindmapArgs,
  byKey: Map<string, MindmapItem>,
): Set<string> | undefined => {
  const selected =
    args.selected === undefined ? undefined : byKey.get(args.selected);
  if (selected) {
    return new Set(
      [
        ...mindmapPath(args.mindmap, selected),
        ...mindmapDescendants(args.mindmap, selected),
      ].map((item) => item.stateKey),
    );
  }
  const focused = (args.focus?.nodes ?? []).flatMap((key) => {
    const item = byKey.get(key);
    return item ? mindmapPath(args.mindmap, item) : [];
  });
  return focused.length === 0
    ? undefined
    : new Set(focused.map((item) => item.stateKey));
};

/** 薄くする項目と線の class（残す項目の外なら付ける） */
const mindmapDim = (context: MindmapContext, key: string): string =>
  context.kept !== undefined && !context.kept.has(key) ? " map-dim" : "";

/** 説明か注記を持つ項目の説明のマーカー。`hints` がオフなら空 */
const mindmapInfo = (context: MindmapContext, item: MindmapItem): string => {
  const { args, tips, ownerPrefix } = context;
  const hint = args.notes[item.stateKey];
  const notes = args.annotations[item.stateKey];
  const described = hint !== undefined && hint !== "";
  const annotated = (notes?.length ?? 0) > 0;
  if (args.hints === false || !(described || annotated)) return "";
  const owner = `node:${item.stateKey}`;
  const id = tips.add({
    kind: "hint",
    label: item.label,
    hint,
    owner,
    annotations: notes,
  });
  const ownerId = annotated
    ? ` id="${escapeHtml(noteOwnerId(ownerPrefix, item.stateKey))}"`
    : "";
  return `<button class="mdmark-diagram-info" type="button"${ownerId} aria-label="${escapeHtml(infoLabel({ name: item.label, described, annotated }))}" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
};

/** 項目の押せる要素。`hints` がオフで注記を持てば、持ち主の `id` を付ける */
const mindmapHit = (context: MindmapContext, item: MindmapItem): string => {
  const { args, ownerPrefix } = context;
  const selected = args.selected === item.stateKey;
  const ownerId =
    args.hints === false && (args.annotations[item.stateKey]?.length ?? 0) > 0
      ? ` id="${escapeHtml(noteOwnerId(ownerPrefix, item.stateKey))}"`
      : "";
  return `<span class="mdmark-diagram-node-hit" role="button" tabindex="0" aria-roledescription="項目"${ownerId} aria-keyshortcuts="Enter Space" aria-label="${escapeHtml(selectableName(item.label, selected))}"></span>`;
};

/** 項目の色と位置の style */
const mindmapStyle = (
  context: MindmapContext,
  placed: MindmapPlacement,
): string => {
  const color = colorVar(placed.color);
  const fill = context.args.filled.has(placed.stateKey)
    ? colorVar(placed.color, "bg")
    : undefined;
  return [
    `left:${placed.x}px`,
    `top:${placed.y}px`,
    `width:${placed.width}px`,
    `min-height:${placed.height}px`,
    color === undefined ? "" : `--map-mindmap-color:${color}`,
    fill === undefined ? "" : `--map-mindmap-fill:${fill}`,
  ]
    .filter((item) => item !== "")
    .join(";");
};

/** 項目 1 つ。項目の `div` はフォーカスを受けず、全体を覆う押せる要素を先頭に入れ、名前と説明のマーカーをその兄弟にする */
const renderMindmapItem = (
  context: MindmapContext,
  placed: MindmapPlacement,
): string => {
  const item = context.byKey.get(placed.stateKey);
  if (!item) return "";
  const { args } = context;
  const selected = args.selected === item.stateKey;
  const classes = [
    "mdmark-diagram-node",
    "map-mindmap-item",
    placed.side === "root" ? "map-mindmap-root" : "",
    args.filled.has(item.stateKey) ? "map-mindmap-filled" : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
  return `<div class="${classes}${mindmapDim(context, item.stateKey)}" data-node="${escapeHtml(item.stateKey)}" data-shape="${item.shape}" data-side="${placed.side}"${selected ? " data-selected" : ""} style="${mindmapStyle(context, placed)}">${mindmapHit(context, item)}<span class="mdmark-diagram-node-name">${context.marker.render(item.label)}</span>${mindmapInfo(context, item)}</div>`;
};

/** 子を持つ項目の、子の側の辺に付ける開閉と中へ入るボタンの持ち手 */
const renderMindmapGrip = (
  context: MindmapContext,
  placed: MindmapPlacement,
): string => {
  const item = context.byKey.get(placed.stateKey);
  if (!item || !placed.hasChildren) return "";
  const closed = context.args.collapsed.includes(item.stateKey);
  const left =
    placed.side === "left"
      ? placed.x - MINDMAP_LAYOUT.gripWidth
      : placed.x + placed.width;
  const key = escapeHtml(item.stateKey);
  const toggleLabel = closed
    ? `${item.label}の子孫 ${placed.descendants} 件を開く`
    : `${item.label}の子孫を閉じる`;
  const toggle = `<button class="map-mindmap-toggle" type="button" data-mindmap-toggle="${key}" aria-expanded="${closed ? "false" : "true"}" aria-label="${escapeHtml(toggleLabel)}">${closed ? `<span class="map-mindmap-count">${placed.descendants}</span>` : iconSvg(placed.side === "left" ? "chevron-right" : "chevron-left")}</button>`;
  const enter = `<button class="map-mindmap-enter" type="button" data-mindmap-enter="${key}" aria-label="${escapeHtml(`${item.label}の中へ入る`)}">${iconSvg("maximize-2")}</button>`;
  const buttons =
    placed.side === "left" ? `${enter}${toggle}` : `${toggle}${enter}`;
  return `<div class="map-mindmap-grip${mindmapDim(context, item.stateKey)}" data-side="${placed.side}" style="left:${left}px;top:${placed.y + placed.height / 2 - 14}px">${buttons}</div>`;
};

/** 中へ入ったときの、全体の根から今の図の根までの道筋 */
const renderMindmapTrail = (args: MapMindmapArgs): string => {
  const top = args.mindmap.items.find((item) => item.stateKey === args.entered);
  if (!top || top.order === args.mindmap.root?.order) return "";
  const names = mindmapPath(args.mindmap, top).map(
    (item) => `<span>${escapeHtml(item.label)}</span>`,
  );
  return `<nav class="map-mindmap-trail" aria-label="根からの道筋">${names.join(' <span aria-hidden="true">›</span> ')}</nav>`;
};

/** 部品『mapのマインドマップ』の HTML。項目・持ち手・枝の曲線・中へ入ったときの道筋を描く */
export const renderMapMindmap = (args: MapMindmapArgs): MapPart => {
  const byKey = new Map(
    args.mindmap.items.map((item) => [item.stateKey, item]),
  );
  const context: MindmapContext = {
    args,
    byKey,
    kept: mindmapKept(args, byKey),
    marker: termMarker(args.terms, args.id),
    tips: createTips(`${args.id}-mindmap`),
    ownerPrefix: noteOwnerPrefix(args.id),
  };
  const { tree } = args;
  const branches = tree.curves
    .map(
      (curve) =>
        `<path class="map-mindmap-branch${mindmapDim(context, curve.to)}" data-branch="${escapeHtml(`${curve.from}->${curve.to}`)}" aria-hidden="true" d="${curve.d}"${curve.color === undefined ? "" : ` style="--map-mindmap-color:${colorVar(curve.color)}"`}></path>`,
    )
    .join("");
  const items = tree.items
    .map((placed) => renderMindmapItem(context, placed))
    .join("");
  const grips = tree.items
    .map((placed) => renderMindmapGrip(context, placed))
    .join("");
  const html = `<svg class="mdmark-diagram-wires map-mindmap-branches" width="${tree.width}" height="${tree.height}" aria-hidden="true">${branches}</svg>${items}${grips}${renderMindmapTrail(args)}`;
  return {
    html,
    tips: `${markTipTerms(context.tips.html(), args.terms)}${context.marker.tips.html()}`,
  };
};

/** 部品『mapの軸と格子の配置の図』の引数。項目は `stateKey` で指す */
export type MapAxisGridArgs = {
  grid: AxisGrid;
  layout: AxisGridLayout;
  /** 補足の `layout` の `color` を持つ項目（色の名前の面と縁で描く） */
  filled: ReadonlySet<string>;
  colors: Record<string, string>;
  collapsed: string[];
  entered: string | undefined;
  selected: AxisGridSelection | undefined;
  /** ブロック図で 2 つ目に選んだブロックか入れ子のブロック（2 つの選択はその 2 つと間の線を残す） */
  pair?: string | undefined;
  focus: { nodes: string[] } | undefined;
  notes: Record<string, string>;
  annotations: Record<string, DiagramAnnotation[]>;
  hints?: boolean | undefined;
  id: string;
  terms?: Record<string, string> | undefined;
};

/** 閉じた section・入れ子のブロックの中身の種類の名前 */
const AXIS_GRID_UNITS = {
  gantt: "タスク",
  timeline: "期間",
  gitGraph: "commit",
  journey: "タスク",
  block: "ブロック",
} as const satisfies Record<AxisGrid["kind"], string>;

/** 描くときに繰り返し引く値 */
type AxisGridContext = {
  args: MapAxisGridArgs;
  byKey: Map<string, AxisGridItem>;
  sections: Map<string, AxisGridSection>;
  /** 薄くせずに残す項目（選択と案内の強調が無ければ undefined） */
  kept: Set<string> | undefined;
  marker: TermMarker;
  tips: TipList;
  ownerPrefix: string;
};

/** Git グラフの commit から、親をたどった全ての祖先（自分を含む） */
const axisGridAncestors = (grid: AxisGrid, key: string): string[] => {
  const kept = new Set<string>();
  const walk = (at: string) => {
    if (kept.has(at)) return;
    kept.add(at);
    for (const link of grid.links) if (link.to === at) walk(link.from);
  };
  walk(key);
  return [...kept];
};

/** 選んだ項目と種類ごとのつながりの項目 */
const axisGridItemKept = (grid: AxisGrid, key: string): string[] => {
  const item = grid.items.find((entry) => entry.stateKey === key);
  if (!item) return [key];
  switch (grid.kind) {
    case "gitGraph":
      return axisGridAncestors(grid, key);
    case "timeline": {
      const period = grid.items.find((entry) => entry.order === item.parent);
      const events = grid.items.filter((entry) => entry.parent === item.order);
      return [
        key,
        ...(period ? [period.stateKey] : []),
        ...events.map((entry) => entry.stateKey),
      ];
    }
    case "journey":
      return [key];
    default:
      return [
        key,
        ...grid.links.flatMap((link) =>
          link.from === key ? [link.to] : link.to === key ? [link.from] : [],
        ),
      ];
  }
};

/** Git グラフのブランチの commit と、merge と cherry-pick でそのブランチへ入った commit */
const axisGridBranchKept = (grid: AxisGrid, branch: string): string[] => {
  const own = grid.items.filter(
    (item) => item.detail.kind === "gitGraph" && item.detail.branch === branch,
  );
  const keys = new Set(own.map((item) => item.stateKey));
  const brought = grid.links.flatMap((link) =>
    (link.kind === "merge" || link.kind === "cherryPick") && keys.has(link.to)
      ? [link.from]
      : [],
  );
  return [...keys, ...brought];
};

/** ジャーニーの人を持つタスク */
const axisGridActorKept = (grid: AxisGrid, actor: string): string[] =>
  grid.items
    .filter(
      (item) =>
        item.detail.kind === "journey" && item.detail.actors.includes(actor),
    )
    .map((item) => item.stateKey);

/** 選んだものの種類ごとの、残す項目 */
const axisGridSelectionKept = (
  args: MapAxisGridArgs,
  selected: AxisGridSelection,
): string[] => {
  if (selected.kind === "branch")
    return axisGridBranchKept(args.grid, selected.key);
  if (selected.kind === "actor")
    return axisGridActorKept(args.grid, selected.key);
  return args.pair === undefined
    ? axisGridItemKept(args.grid, selected.key)
    : [selected.key, args.pair];
};

/** 選んだもののつながり、無ければ案内と再生で強調する項目。どちらも無ければ undefined */
const axisGridKept = (args: MapAxisGridArgs): Set<string> | undefined => {
  if (args.selected !== undefined)
    return new Set(axisGridSelectionKept(args, args.selected));
  const nodes = args.focus?.nodes ?? [];
  return nodes.length === 0 ? undefined : new Set(nodes);
};

/** 薄くする項目と線の class（残す項目の外なら付ける） */
const axisGridDim = (context: AxisGridContext, ...keys: string[]): string =>
  context.kept !== undefined && !keys.some((key) => context.kept?.has(key))
    ? " map-dim"
    : "";

/** 説明か注記を持つ項目の説明のマーカー。`hints` がオフなら空 */
const axisGridInfo = (
  context: AxisGridContext,
  item: { stateKey: string; label: string },
): string => {
  const { args, tips, ownerPrefix } = context;
  const hint = args.notes[item.stateKey];
  const notes = args.annotations[item.stateKey];
  const described = hint !== undefined && hint !== "";
  const annotated = (notes?.length ?? 0) > 0;
  if (args.hints === false || !(described || annotated)) return "";
  const owner = `node:${item.stateKey}`;
  const id = tips.add({
    kind: "hint",
    label: item.label,
    hint,
    owner,
    annotations: notes,
  });
  const ownerId = annotated
    ? ` id="${escapeHtml(noteOwnerId(ownerPrefix, item.stateKey))}"`
    : "";
  return `<button class="mdmark-diagram-info" type="button"${ownerId} aria-label="${escapeHtml(infoLabel({ name: item.label, described, annotated }))}" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
};

/** 項目の名前（commit の名前は `id:` か `msg:`、どちらも無ければ `commit {番号}`） */
const axisGridName = (item: AxisGridItem): string => {
  if (item.label !== "") return item.label;
  if (item.id !== undefined) return item.id;
  return `commit ${item.order}`;
};

/** 項目の押せる要素。`hints` がオフで注記を持てば、持ち主の `id` を付ける */
const axisGridHit = (
  context: AxisGridContext,
  item: { stateKey: string; name: string },
): string => {
  const { args, ownerPrefix } = context;
  const selected =
    args.selected?.kind === "item" && args.selected.key === item.stateKey;
  const ownerId =
    args.hints === false && (args.annotations[item.stateKey]?.length ?? 0) > 0
      ? ` id="${escapeHtml(noteOwnerId(ownerPrefix, item.stateKey))}"`
      : "";
  return `<span class="mdmark-diagram-node-hit" role="button" tabindex="0" aria-roledescription="項目"${ownerId} aria-keyshortcuts="Enter Space" aria-label="${escapeHtml(selectableName(item.name, selected))}"></span>`;
};

/** 項目の位置と色の style */
const axisGridStyle = (
  context: AxisGridContext,
  placed: AxisGridPlacement,
): string => {
  const own = context.args.colors[placed.stateKey];
  const color = colorVar(own ?? placed.color);
  const fill = colorVar(own ?? placed.color, "bg");
  // ブロック図の Mermaid の `style`・`classDef` の色（ID を持つ項目だけ）
  const item = context.args.grid.items.find(
    (one) => one.stateKey === placed.stateKey,
  );
  const paint = mermaidPaint(
    item?.id === undefined
      ? undefined
      : context.args.grid.styles?.nodes[item.id],
    false,
  );
  return [
    `left:${placed.x}px`,
    `top:${placed.y}px`,
    `width:${placed.width}px`,
    `height:${placed.height}px`,
    color === undefined ? "" : `--map-axis-color:${color}`,
    fill === undefined ? "" : `--map-axis-fill:${fill}`,
    ...(
      [
        ["--map-node-fill", paint.fill],
        ["--map-node-stroke", paint.stroke],
        ["--map-node-text", paint.text],
      ] as const
    ).flatMap(([name, value]) => {
      const safe = safeCssColor(value);
      return safe === undefined ? [] : [`${name}: ${escapeHtml(safe)}`];
    }),
  ]
    .filter((entry) => entry !== "")
    .join(";");
};

/** 点数に合った表情の顔（1・2 は口を下げ、3 は横、4・5 は上げる） */
const axisGridFace = (score: number): string => {
  const mouth =
    score >= 4
      ? "M9 15 Q12 18 15 15"
      : score >= 3
        ? "M9 15.5 H15"
        : "M9 17 Q12 14 15 17";
  return `<svg class="map-axis-face" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="10" r="1.2"></circle><circle cx="15" cy="10" r="1.2"></circle><path d="${mouth}"></path></svg>`;
};

/** 閉じた section・入れ子のブロックの項目 */
const renderAxisGridCollapsed = (
  context: AxisGridContext,
  placed: AxisGridPlacement,
): string => {
  const section = context.sections.get(placed.stateKey);
  if (!section) return "";
  const unit = AXIS_GRID_UNITS[context.args.grid.kind];
  const count = `（${unit} ${placed.count ?? section.members.length} 件）`;
  const members = section.members.flatMap((order) => {
    const item = context.args.grid.items[order - 1];
    return item ? [item.stateKey] : [];
  });
  const face =
    context.args.grid.kind === "journey"
      ? axisGridFace(placedScore(context, members))
      : "";
  return `<div class="mdmark-diagram-node map-axis-item map-axis-collapsed${axisGridDim(context, placed.stateKey, ...members)}" data-node="${escapeHtml(placed.stateKey)}" data-shape="collapsed" data-kind="${context.args.grid.kind}" style="${axisGridStyle(context, placed)}">${axisGridHit(context, { stateKey: placed.stateKey, name: `${section.label}${count}` })}${face}<span class="mdmark-diagram-node-name">${escapeHtml(section.label)}</span><span class="map-axis-count">${escapeHtml(count)}</span>${axisGridInfo(context, { stateKey: placed.stateKey, label: section.label })}</div>`;
};

/** 閉じたジャーニーの section の点数の平均 */
const placedScore = (context: AxisGridContext, members: string[]): number => {
  const scores = members.flatMap((key) => {
    const detail = context.byKey.get(key)?.detail;
    return detail?.kind === "journey" ? [detail.score] : [];
  });
  return scores.length === 0
    ? 3
    : scores.reduce((sum, score) => sum + score, 0) / scores.length;
};

/** ガントチャートのタスクのタグの class */
const axisGridTags = (item: AxisGridItem): string =>
  item.detail.kind === "gantt"
    ? item.detail.tags.map((tag) => ` map-axis-${tag}`).join("")
    : "";

/** 項目 1 つ。項目の `div` はフォーカスを受けず、全体を覆う押せる要素を先頭に入れ、名前と説明のマーカーをその兄弟にする */
const renderAxisGridItem = (
  context: AxisGridContext,
  placed: AxisGridPlacement,
): string => {
  if (placed.shape === "collapsed")
    return renderAxisGridCollapsed(context, placed);
  const item = context.byKey.get(placed.stateKey);
  if (!item) return "";
  const { args } = context;
  const selected =
    args.selected?.kind === "item" && args.selected.key === item.stateKey;
  const name = axisGridName(item);
  const classes = [
    "mdmark-diagram-node",
    "map-axis-item",
    args.filled.has(item.stateKey) ? "map-axis-filled" : "",
  ]
    .filter((entry) => entry !== "")
    .join(" ");
  const face =
    item.detail.kind === "journey" ? axisGridFace(item.detail.score) : "";
  return `<div class="${classes}${axisGridTags(item)}${axisGridDim(context, item.stateKey)}" data-node="${escapeHtml(item.stateKey)}" data-shape="${item.shape}" data-kind="${args.grid.kind}"${selected ? " data-selected" : ""} style="${axisGridStyle(context, placed)}">${axisGridHit(context, { stateKey: item.stateKey, name })}${face}<span class="mdmark-diagram-node-name">${context.marker.render(name)}</span>${axisGridInfo(context, { stateKey: item.stateKey, label: name })}</div>`;
};

/** section・入れ子のブロックの開閉と中へ入るボタン（中へ入った section には付けない） */
const renderAxisGridControls = (
  context: AxisGridContext,
  section: AxisGridSection,
): string => {
  if (context.args.entered === section.stateKey) return "";
  const closed = context.args.collapsed.includes(section.stateKey);
  const key = escapeHtml(section.stateKey);
  const label = closed ? `${section.label}を開く` : `${section.label}を閉じる`;
  const toggle = `<button class="map-axis-toggle" type="button" data-map-section-toggle="${key}" aria-expanded="${closed ? "false" : "true"}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${iconSvg(closed ? "chevron-right" : "chevron-down")}</button>`;
  const enterLabel = `${section.label}の中へ入る`;
  const enter = `<button class="map-axis-enter" type="button" data-map-section-enter="${key}" aria-label="${escapeHtml(enterLabel)}" title="${escapeHtml(enterLabel)}">${iconSvg("maximize-2")}</button>`;
  return `${toggle}${enter}`;
};

/** section の名前。ブロック図の入れ子のブロックは、選ぶボタンにする */
const axisGridFrameTitle = (
  context: AxisGridContext,
  section: AxisGridSection,
): string => {
  const label = escapeHtml(section.label);
  if (context.args.grid.kind !== "block")
    return `<span class="map-axis-frame-title">${label}</span>`;
  const { selected, pair } = context.args;
  const pressed =
    (selected?.kind === "item" && selected.key === section.stateKey) ||
    pair === section.stateKey;
  return `<button class="map-axis-frame-title map-axis-frame-select" type="button" data-map-section-select="${escapeHtml(section.stateKey)}" aria-pressed="${pressed}">${label}</button>`;
};

/** section の見出しの行・枠と入れ子のブロックの枠 */
const renderAxisGridFrame = (
  context: AxisGridContext,
  frame: AxisGridFrame,
): string => {
  const section = context.sections.get(frame.key);
  if (!section) return "";
  const color = colorVar(frame.color);
  const fill = colorVar(frame.color, "bg");
  const style = [
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    color === undefined ? "" : `--map-axis-color:${color}`,
    fill === undefined ? "" : `--map-axis-fill:${fill}`,
  ]
    .filter((entry) => entry !== "")
    .join(";");
  return `<div class="map-axis-frame" data-frame="${frame.kind}" data-section="${escapeHtml(frame.key)}"${frame.collapsed ? " data-collapsed" : ""} style="${style}"><div class="map-axis-frame-head">${renderAxisGridControls(context, section)}${axisGridFrameTitle(context, section)}${axisGridInfo(context, { stateKey: section.stateKey, label: section.label })}</div></div>`;
};

/** 枠を持たない閉じた入れ子のブロックの、項目の上に置く開閉と中へ入るボタン */
const renderAxisGridGrips = (context: AxisGridContext): string => {
  const framed = new Set(context.args.layout.frames.map((frame) => frame.key));
  return context.args.layout.items
    .filter(
      (placed) => placed.shape === "collapsed" && !framed.has(placed.stateKey),
    )
    .map((placed) => {
      const section = context.sections.get(placed.stateKey);
      if (!section) return "";
      return `<div class="map-axis-grip" style="left:${placed.x}px;top:${placed.y - 30}px">${renderAxisGridControls(context, section)}</div>`;
    })
    .join("");
};

/** 軸の目盛り・タスク名・commit の下の文字と札・ブランチ名のボタン・ジャーニーのタスク名と人の丸 */
const renderAxisGridLabels = (context: AxisGridContext): string => {
  const { args } = context;
  const { grid, layout } = args;
  const ticks = layout.ticks
    .map((tick) =>
      grid.kind === "gantt"
        ? `<span class="map-axis-tick${tick.weekend ? " map-axis-weekend" : ""}" aria-hidden="true" style="left:${tick.x - 14}px;top:${tick.y - 8}px">${escapeHtml(String(Number(tick.value.slice(8))))}</span>`
        : `<span class="map-axis-score" aria-hidden="true" style="left:${tick.x}px;top:${tick.y - 8}px">${escapeHtml(tick.value)}</span>`,
    )
    .join("");
  const placed = layout.items.filter((item) => item.shape !== "collapsed");
  const labels = placed.map((entry) => {
    const item = context.byKey.get(entry.stateKey);
    return item ? axisGridLabel(context, item, entry) : "";
  });
  return `${ticks}${labels.join("")}${renderAxisGridBranches(context)}`;
};

/** 項目 1 つの外に出す文字（ガントチャートのタスク名・commit の文字と札・ジャーニーのタスク名と人の丸） */
const axisGridLabel = (
  context: AxisGridContext,
  item: AxisGridItem,
  placed: AxisGridPlacement,
): string => {
  const { grid, layout } = context.args;
  const dim = axisGridDim(context, item.stateKey);
  const detail = item.detail;
  if (detail.kind === "gantt")
    return `<span class="map-axis-name${dim}" aria-hidden="true" style="left:${layout.ticks.length === 0 ? 0 : 40}px;top:${placed.y + placed.height / 2 - 9}px">${escapeHtml(item.label)}</span>`;
  if (detail.kind === "gitGraph") {
    const caption =
      detail.source !== undefined
        ? `← ${detail.source}`
        : (item.id ?? item.label);
    const text =
      caption === ""
        ? ""
        : `<span class="map-axis-caption${dim}" aria-hidden="true" style="left:${placed.x + placed.width / 2 - 44}px;top:${placed.y + placed.height + 4}px">${escapeHtml(caption)}</span>`;
    const tag =
      detail.tag === undefined
        ? ""
        : `<span class="map-axis-tag${dim}" aria-hidden="true" style="left:${placed.x + placed.width / 2 - 36}px;top:${placed.y - 26}px">${escapeHtml(detail.tag)}</span>`;
    return `${text}${tag}`;
  }
  if (detail.kind === "journey") {
    const dots = detail.actors
      .map(
        (name) =>
          `<span class="map-axis-actor" data-actor="${grid.actors.indexOf(name) % 3}" title="${escapeHtml(name)}"></span>`,
      )
      .join("");
    return `<span class="map-axis-task${dim}" aria-hidden="true" style="left:${placed.x + placed.width / 2 - 52}px;top:${layout.baseline}px"><span>${escapeHtml(item.label)}</span><span class="map-axis-actors">${dots}</span></span>`;
  }
  return "";
};

/** Git グラフの左端のブランチ名のボタン */
const renderAxisGridBranches = (context: AxisGridContext): string =>
  context.args.layout.lanes
    .filter((lane) => lane.kind === "branch")
    .map((lane) => {
      const pressed =
        context.args.selected?.kind === "branch" &&
        context.args.selected.key === lane.key;
      const dim =
        context.args.selected?.kind === "branch" && !pressed ? " map-dim" : "";
      const color = colorVar(lane.color);
      return `<button class="map-axis-branch${dim}" type="button" data-map-branch="${escapeHtml(lane.key)}" aria-pressed="${pressed}" style="left:${AXIS_GRID_LAYOUT.margin}px;top:${lane.y - 12}px${color === undefined ? "" : `;--map-axis-color:${color}`}">${escapeHtml(lane.key)}</button>`;
    })
    .join("");

/** つながりの線・ブランチと人の線・今日の線・ガントチャートの土日の面（SVG） */
const renderAxisGridWires = (context: AxisGridContext): string => {
  const { layout } = context.args;
  const colored = (color: string | undefined) => {
    const value = colorVar(color);
    return value === undefined ? "" : ` style="--map-axis-color:${value}"`;
  };
  const weekends = layout.ticks
    .filter((tick) => tick.weekend)
    .map(
      (tick) =>
        `<rect class="map-axis-weekend-face" x="${tick.x - AXIS_GRID_LAYOUT.day / 2}" y="${tick.y + AXIS_GRID_LAYOUT.row / 2}" width="${AXIS_GRID_LAYOUT.day}" height="${Math.max(layout.height - tick.y - AXIS_GRID_LAYOUT.margin * 2, 0)}"></rect>`,
    )
    .join("");
  const lanes = layout.lanes
    .map(
      (lane) =>
        `<path class="map-axis-lane${axisGridDim(context, ...lane.members)}" data-lane="${lane.kind}" d="${lane.d}"${colored(lane.color)}></path>`,
    )
    .join("");
  const wires = layout.links
    .map((wire) => {
      const arrow =
        wire.kind === "arrow" || wire.kind === "after"
          ? ` marker-end="url(#${context.args.id}-axis-arrow)"`
          : "";
      const dim =
        axisGridDim(context, wire.from) !== "" ||
        axisGridDim(context, wire.to) !== ""
          ? " map-dim"
          : "";
      return `<path class="map-axis-wire${dim}" data-wire="${wire.kind}" d="${wire.d}"${arrow}${colored(wire.color)}></path>`;
    })
    .join("");
  const today =
    layout.today === undefined
      ? ""
      : `<path class="map-axis-today" aria-hidden="true" d="M${layout.today} ${layout.baseline} V${layout.height - AXIS_GRID_LAYOUT.margin - AXIS_GRID_LAYOUT.row / 2}"></path>`;
  const marker = `<defs><marker id="${context.args.id}-axis-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"></path></marker></defs>`;
  return `<svg class="mdmark-diagram-wires map-axis-wires" width="${layout.width}" height="${layout.height}" aria-hidden="true">${marker}${weekends}${lanes}${wires}${today}</svg>`;
};

/** ブロック図の線のラベル。線より長いラベルは線の横に置き、`data-beside` を付ける */
const axisWireLabel = (
  context: AxisGridContext,
  wire: AxisGridContext["args"]["layout"]["links"][number],
): string => {
  const label = wire.label;
  if (label === undefined) return "";
  const dim = axisGridDim(context, wire.from, wire.to);
  const at = besideLabelAt(pathPoints(wire.d), label.text);
  return at === undefined
    ? `<span class="map-axis-wire-label${dim}" aria-hidden="true" style="left:${label.x - 28}px;top:${label.y - 20}px">${escapeHtml(label.text)}</span>`
    : `<span class="map-axis-wire-label${dim}" data-beside aria-hidden="true" style="left:${at[0]}px;top:${at[1]}px">${escapeHtml(label.text)}</span>`;
};

/** ブロック図の線のラベルと、ガントチャートの今日の文字 */
const renderAxisGridWireLabels = (context: AxisGridContext): string => {
  const { layout } = context.args;
  const labels = layout.links
    .flatMap((wire) =>
      wire.label === undefined ? [] : [axisWireLabel(context, wire)],
    )
    .join("");
  const today =
    layout.today === undefined
      ? ""
      : `<span class="map-axis-today-label" aria-hidden="true" style="left:${layout.today - 16}px;top:${layout.height - AXIS_GRID_LAYOUT.margin - AXIS_GRID_LAYOUT.row / 2}px">今日</span>`;
  return `${labels}${today}`;
};

/** 中へ入ったときの、全体から入った section までの道筋 */
const renderAxisGridTrail = (context: AxisGridContext): string => {
  const { entered } = context.args;
  if (entered === undefined) return "";
  const names: string[] = [];
  let at = context.sections.get(entered);
  while (at) {
    names.unshift(at.label);
    at = at.parent === undefined ? undefined : context.sections.get(at.parent);
  }
  const spans = ["全体", ...names].map(
    (name) => `<span>${escapeHtml(name)}</span>`,
  );
  return `<nav class="map-axis-trail" aria-label="全体からの道筋">${spans.join(' <span aria-hidden="true">›</span> ')}</nav>`;
};

/** 部品『mapの軸と格子の配置の図』の HTML。項目・枠・軸・線・中へ入ったときの道筋を描く */
export const renderMapAxisGrid = (args: MapAxisGridArgs): MapPart => {
  const context: AxisGridContext = {
    args,
    byKey: new Map(args.grid.items.map((item) => [item.stateKey, item])),
    sections: new Map(
      args.grid.sections.map((section) => [section.stateKey, section]),
    ),
    kept: axisGridKept(args),
    marker: termMarker(args.terms, args.id),
    tips: createTips(`${args.id}-axis`),
    ownerPrefix: noteOwnerPrefix(args.id),
  };
  const frames = args.layout.frames
    .map((frame) => renderAxisGridFrame(context, frame))
    .join("");
  const items = args.layout.items
    .map((placed) => renderAxisGridItem(context, placed))
    .join("");
  const html = `${frames}${renderAxisGridWires(context)}${renderAxisGridLabels(context)}${renderAxisGridWireLabels(context)}${items}${renderAxisGridGrips(context)}${renderAxisGridTrail(context)}`;
  return {
    html,
    tips: `${markTipTerms(context.tips.html(), args.terms)}${context.marker.tips.html()}`,
  };
};

/** ジャーニーの人の凡例のボタン（図の枠の凡例の行に入れる `li`） */
export const renderMapAxisGridLegend = (args: {
  grid: AxisGrid;
  selected: AxisGridSelection | undefined;
}): string =>
  args.grid.actors
    .map((name, index) => {
      const pressed =
        args.selected?.kind === "actor" && args.selected.key === name;
      return `<li class="mdmark-diagram-legend-item"><button class="map-axis-legend" type="button" data-map-actor="${escapeHtml(name)}" aria-pressed="${pressed}"><span class="map-axis-actor" data-actor="${index % 3}" aria-hidden="true"></span>${escapeHtml(name)}</button></li>`;
    })
    .join("");
