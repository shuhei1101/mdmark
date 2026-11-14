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
import { isColorName } from "./colors.ts";
import {
  createTips,
  renderFlow,
  renderText,
  type TermLookup,
  type TipList,
} from "./diagram.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 線の上を流れるデータの印。color は色の名前か line・source・target（省く・知らない値は線の色） */
export type MapPacketMark = {
  wire: string;
  direction: "forward" | "backward" | "both";
  color: string | undefined;
  shape: "circle" | "square" | "diamond";
};

/** 線の既定の色 */
const LINE_FILL = "var(--mdmark-color-diagram-line)";
/** 印が線の上を進む速さ（px/秒）と、印の間隔（px）と、1 本の線に流す印の数の上限 */
const PACKET_SPEED = 60;
const PACKET_GAP = 100;
const PACKET_MAX = 4;

/** 色の名前を CSS 変数にする。色の名前の一覧に無い値は undefined（利用側の文字を CSS の値にそのまま埋めない） */
export const colorVar = (
  name: string | undefined,
  tone: "text" | "bg" = "text",
): string | undefined =>
  name !== undefined && isColorName(name)
    ? `var(--mdmark-color-accent-${name}-${tone})`
    : undefined;

/** 印を描く 1 本の経路 */
export type PacketPath = {
  /** 印の要素に付ける属性（`data-wire="…"` か `data-message="…"`） */
  owner: string;
  d: string;
  length: number;
  fill: string;
  shape: MapPacketMark["shape"];
  direction: MapPacketMark["direction"];
};

/** 経路の上を元から先へ繰り返し流れる印の SVG。線の長さによらず同じ速さで動かし、長い線ほど印を多く流す */
export const renderPackets = (paths: PacketPath[]): string =>
  paths
    .flatMap((path) => {
      const seconds = Math.max(0.6, path.length / PACKET_SPEED);
      const count = Math.max(
        1,
        Math.min(PACKET_MAX, Math.floor(path.length / PACKET_GAP)),
      );
      const ways =
        path.direction === "both"
          ? [false, true]
          : [path.direction === "backward"];
      return ways.flatMap((backward) =>
        Array.from({ length: count }, (_item, index) => {
          const begin = -((seconds * index) / count);
          const motion = `<animateMotion dur="${seconds}s" begin="${begin}s" repeatCount="indefinite" path="${path.d}"${backward ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ""}></animateMotion>`;
          const attributes = `class="map-packet" ${path.owner} style="fill:${path.fill}"`;
          return path.shape === "square"
            ? `<rect x="-6" y="-6" width="12" height="12" rx="2" ${attributes}>${motion}</rect>`
            : path.shape === "diamond"
              ? `<polygon points="0,-8 8,0 0,8 -8,0" ${attributes}>${motion}</polygon>`
              : `<circle r="7" ${attributes}>${motion}</circle>`;
        }),
      );
    })
    .join("");

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
  /** 補足の notes（ID ごとの説明） */
  notes?: Record<string, string> | undefined;
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
  /** ノードの ID ごとの状態遷移図の形状（`start`・`end`・`choice` は名前と種類の行を出さずフォーカスを持たない。`note` は種類の行「注記」） */
  shapes?: Record<string, MapStateShape> | undefined;
  /** ノードの ID ごとに、種類の行の末尾とノードの末尾へ入れる HTML と、そのツールチップ */
  nodeParts?: Record<string, MapNodePart> | undefined;
};

/** 状態遷移図のノードの形状 */
export type MapStateShape = "start" | "end" | "choice" | "note";

/** ノードの中へ入れる HTML（`head` は種類の行の末尾、`body` はノードの末尾） */
export type MapNodePart = { head: string; body: string; tips: string };

/** 形状ごとの読み上げる名前 */
const STATE_SHAPE_NAMES = {
  start: "開始",
  end: "終了",
  choice: "分岐",
  note: "注記",
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

/** 構成図の線の上のデータの印の SVG。色の名前・line・source・target を、線とノードの種類の色の変数にする */
export const renderMapPackets = (
  args: Pick<
    MapFlowArgs,
    "layout" | "kinds" | "lines" | "wireLines" | "colors"
  >,
  marks: MapPacketMark[],
): string => {
  const { layout } = args;
  const kindOf = (classes: string[] | undefined): MapKind | undefined => {
    const name = (classes ?? []).find((item) => item in args.kinds);
    return name === undefined ? undefined : args.kinds[name];
  };
  const nodeFill = (id: string): string =>
    colorVar(
      kindOf(layout.nodes.find((node) => node.id === id)?.classes)?.color,
    ) ?? LINE_FILL;
  const packetPaths = marks.flatMap((packet): PacketPath[] => {
    const wire = layout.wires.find((item) => item.id === packet.wire);
    if (!wire) return [];
    const named = args.wireLines?.[wire.id];
    const lineColor = colorVar(
      args.colors?.[wire.id] ??
        (
          (named === undefined ? undefined : args.lines[named]) ??
          args.lines[wire.arrow ?? "-->"]
        )?.color,
    );
    const lineFill = lineColor ?? LINE_FILL;
    const fill =
      packet.color === "source"
        ? nodeFill(wire.from)
        : packet.color === "target"
          ? nodeFill(wire.to)
          : (colorVar(packet.color) ?? lineFill);
    return [
      {
        owner: `data-wire="${escapeHtml(wire.id)}"`,
        ...polyline(wire.points),
        fill,
        shape: packet.shape,
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
    render: (text) => renderText(markTerms(text, words), tips, lookup, found),
    tips,
  };
};

/** 構成図のノードで使うキー（選ぶ・動かす） */
const MAP_NODE_KEYS =
  "Enter Space Alt+ArrowLeft Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight";

/** 選べるノード・参加者のスクリーンリーダー向けの名前（選んでいれば末尾に「（選択中）」） */
export const selectableName = (name: string, selected: boolean): string =>
  selected ? `${name}（選択中）` : name;

/** 部品『mapの構成図』の HTML。フロー図の部品の定義にしたノードと線を renderFlow で描き、グループの面とタイトルの行・開閉と中へ入るボタン・閉じたグループを重ねる */
export const renderMapFlow = (args: MapFlowArgs): MapPart => {
  const { layout } = args;
  const kindOf = (classes: string[] | undefined): MapKind | undefined => {
    const name = (classes ?? []).find((item) => item in args.kinds);
    return name === undefined ? undefined : args.kinds[name];
  };
  const open = layout.groups.filter((group) => !group.collapsed);
  const closed = layout.groups.filter((group) => group.collapsed);
  const names = new Map<string, string>([
    ...layout.groups.map((group): [string, string] => [group.id, group.title]),
    ...layout.nodes.map((node): [string, string] => [
      node.id,
      node.label ?? node.lines.join(""),
    ]),
  ]);
  const nameOf = (id: string): string => names.get(id) ?? id;
  /** 線の押せる帯のスクリーンリーダー向けの名前 */
  const wireName = (wire: MapLayout["wires"][number]): string =>
    `${nameOf(wire.from)}から${nameOf(wire.to)}への線${wire.merged === undefined && wire.label !== undefined ? `「${wire.label}」` : ""}`;
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
        label:
          args.shapes?.[node.id] === "note"
            ? STATE_SHAPE_NAMES.note
            : kind?.label,
        icon: kind?.icon,
        shape: kind?.shape,
        color: args.colors?.[node.id] ?? kind?.color,
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
    // まとめた線は、補足の notes に説明を持つ元の線だけを並べる
    const tip = [
      ...(wire.merged ?? []).flatMap((item) => {
        const note = args.notes?.[`${item.from}->${item.to}`];
        return note === undefined || note === ""
          ? []
          : [`${item.fromLabel} → ${item.toLabel}：${note}`];
      }),
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
      style: {
        ...line,
        color: args.colors?.[wire.id] ?? line.color,
        both: wire.both ?? false,
      },
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
  const part = renderFlow(definition, args.id ?? "map", true);
  // ラベルを持たない線の説明とまとめた元の線は、線の押せる帯を持ち主にしたツールチップにする
  const wireTips = createTips(`${args.id ?? "map"}-wire`);
  const tipped = new Set<string>();
  for (const wire of wires) {
    if (wire.tip === undefined) continue;
    tipped.add(wire.id);
    if (wire.label !== undefined) continue;
    const shown = layout.wires.find((item) => item.id === wire.id);
    wireTips.add({
      kind: "wire",
      label: shown === undefined ? wire.id : wireName(shown),
      tip: wire.tip,
      owner: wire.id,
    });
  }
  let html = part.html;
  // ノードの名前の中の用語に下線を付ける（名前の文字は逃がしたまま、名前の要素の中に置く）
  const marker = termMarker(args.terms, args.id ?? "map");
  for (const node of layout.nodes) {
    const label = node.label ?? node.lines.join("");
    const marked = marker.render(label);
    if (marked === escapeHtml(label)) continue;
    const value = escapeHtml(node.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(
      new RegExp(
        `(data-node="${value}"[^>]*>[\\s\\S]*?<span class="mdmark-diagram-node-name">)[\\s\\S]*?(</span>)`,
      ),
      (_whole, head: string, tail: string) => `${head}${marked}${tail}`,
    );
  }
  // ノードはフォーカスして Enter・Space で選び、Alt + 矢印キーで動かせる
  const selectedIds = new Set(args.selected);
  for (const node of layout.nodes) {
    const value = escapeHtml(node.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shape = args.shapes?.[node.id];
    // 開始・終了・分岐は形状だけを描き、選ばない
    if (shape !== undefined && shape !== "note") {
      html = html.replace(
        new RegExp(
          `(<div class="[^"]*map-kinded[^"]*"[^>]*?) data-shape="[^"]*"([^>]*\\sdata-node="${value}")`,
        ),
        `$1 data-shape="${shape}"$2 role="img" aria-label="${STATE_SHAPE_NAMES[shape]}"`,
      );
      continue;
    }
    const selected = selectedIds.has(node.id);
    html = html.replace(
      new RegExp(
        `(<div class="[^"]*map-kinded[^"]*"[^>]*\\sdata-node="${value}")`,
      ),
      `$1 tabindex="0" role="button" aria-roledescription="ノード" aria-keyshortcuts="${MAP_NODE_KEYS}" aria-label="${escapeHtml(selectableName(nameOf(node.id), selected))}"${selected ? " data-selected" : ""}`,
    );
  }
  for (const node of layout.nodes) {
    if (node.faded) html = addClass(html, "data-node", node.id, "map-faded");
  }
  let partTips = "";
  for (const [id, part] of Object.entries(args.nodeParts ?? {})) {
    html = insertNodePart(html, id, part);
    partTips += part.tips;
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
  /** グループの色の名前を、面と文字の色の変数にする（知らない名前は色を持たない） */
  const groupTint = (id: string): string => {
    const name = args.colors?.[id];
    const fill = colorVar(name, "bg");
    const ink = colorVar(name);
    return fill === undefined || ink === undefined
      ? ""
      : `;--map-fill:${fill};--map-ink:${ink}`;
  };
  // グループは外側から順に、線とノードの下に重ねる
  const groups = [...open]
    .sort((a, b) => a.ancestors.length - b.ancestors.length)
    .map((group) => {
      const current = group.id === args.entered;
      // 中へ入ったグループと薄く残したグループのほかは、タイトルの行の帯をドラッグして動かせる
      const movable = !current && !group.faded;
      const classes = `map-group${group.faded ? " map-faded" : ""}${current ? " is-entered" : ""}${movable ? " map-movable" : ""}${args.dragging === group.id ? " is-dragging" : ""}`;
      const bar = movable
        ? `<div class="map-group-bar" tabindex="0" role="button" aria-label="${escapeHtml(`${group.title}を動かす`)}" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" title="ドラッグでグループを動かす"></div>`
        : "";
      return `<div class="${classes}" data-group="${escapeHtml(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px${groupTint(group.id)}">${bar}<div class="map-group-head">${disclosure(group.id, group.title, true)}${groupTitle(group.id, group.title, current)}</div></div>`;
    })
    .join("");
  const closedCount = (id: string, count: number | undefined): string => {
    const tag =
      args.collapsedTag?.(id) ??
      (count === undefined ? undefined : `ノード ${count} 件`);
    return tag === undefined
      ? ""
      : `<span class="map-closed-count">${escapeHtml(tag)}</span>`;
  };
  // 閉じたグループは、二重の枠線の 1 つのノードにする（本数とラベルは出さない）
  const closedHtml = closed
    .map(
      (group) =>
        `<div class="mdmark-diagram-node map-closed-group${group.faded ? " map-faded" : ""}" data-group="${escapeHtml(group.id)}" style="left:${group.x}px;top:${group.y}px;width:${group.w}px;height:${group.h}px"><div class="map-group-head">${disclosure(group.id, group.title, false)}${groupTitle(group.id, group.title, false)}</div>${closedCount(group.id, group.count)}</div>`,
    )
    .join("");
  const packets = `<svg class="map-packets" width="${layout.width}" height="${layout.height}" aria-hidden="true">${renderMapPackets(args, args.packets)}</svg>`;
  // 線を押す・指す場所: 見える線より太い透明の線（区間の移動にも使う）
  const hits = layout.wires
    .map(
      (wire) =>
        `<path class="map-wire-hit" data-wire="${escapeHtml(wire.id)}"${tipped.has(wire.id) ? ` data-tip-owner="${escapeHtml(wire.id)}"` : ""} tabindex="0" role="button" aria-label="${escapeHtml(wireName(wire))}" d="${wire.points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`).join("")}"></path>`,
    )
    .join("");
  const hitLayer = `<svg class="map-wire-hits" width="${layout.width}" height="${layout.height}">${hits}</svg>`;
  return {
    html: `${groups}${html}${hitLayer}${closedHtml}${packets}`,
    tips: `${markTipTerms(`${part.tips}${wireTips.html()}`, args.terms)}${marker.tips.html()}${partTips}`,
  };
};

/** 部品『案内の帯』の引数 */
export type MapBandArgs = {
  mode: "walkthrough" | "playback";
  /** 再生で進める単位（既定 message。transition は状態遷移図の遷移） */
  unit?: "message" | "transition" | undefined;
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
  transition: {
    prev: "前の遷移",
    stop: "再生をやめる",
    next: "次の遷移",
  },
} as const;

/** 部品『案内の帯』の HTML */
export const renderMapBand = (args: MapBandArgs): string => {
  const names =
    NAMES[
      args.mode === "playback" && args.unit === "transition"
        ? "transition"
        : args.mode
    ];
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
  /** 用語から意味（`data-map-terms`）。参加者の名前・メッセージの文・注記の文の中の用語に下線を付ける */
  terms?: Record<string, string> | undefined;
  /** 補足の notes（記載の順に 1 からのメッセージの番号から説明）。説明を持つメッセージの線にツールチップを付ける */
  notes?: Record<string, string> | undefined;
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
export const renderMapSequence = (args: MapSequenceArgs): MapPart => {
  const marker = termMarker(args.terms, `${args.id ?? "map"}-seq`);
  const noteTips = createTips(`${args.id ?? "map"}-seq-note`);
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
        `<div class="map-seq-note" style="left:${left}px;top:${rowY(at) - 32}px;width:${right - left}px">${marker.render(note.text)}</div>`,
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
  const labelOf = (name: string) =>
    sequence.participants.find((item) => item.id === name)?.label ?? name;
  const wires: string[] = [];
  const labels: string[] = [];
  const packetPaths: PacketPath[] = [];
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
    // 補足の notes に説明があるメッセージは、線の押せる帯を持ち主にしたツールチップを持つ
    const note = args.notes?.[String(message + 1)];
    const noteOwner =
      note === undefined || note === ""
        ? ""
        : ` data-tip-owner="${escapeHtml(`message:${message}`)}"`;
    if (noteOwner !== "")
      noteTips.add({
        kind: "wire",
        label: `${labelOf(item.from)} → ${labelOf(item.to)}`,
        tip: note,
        owner: `message:${message}`,
      });
    wires.push(
      `<path class="mdmark-diagram-wire${dim}" data-line="map" data-message="${message}" d="${d}"${style.dotted ? ' stroke-dasharray="6 4"' : ""} stroke-width="1.5" style="stroke:var(--mdmark-color-diagram-line)"${head}${both}></path><path class="map-wire-hit" data-message="${message}"${noteOwner} d="${d}"></path>`,
    );
    // 選んだ参加者のメッセージと再生している今のメッセージの線に、データの印を送り手から受け手へ流す
    if (hit === true || message === args.focus?.message) {
      packetPaths.push({
        owner: `data-message="${message}"`,
        d,
        length: self ? 64 : Math.abs(end - start),
        fill: LINE_FILL,
        shape: "circle",
        direction: style.both ? "both" : "forward",
      });
    }
    const number = sequence.autonumber ? `${message + 1} ` : "";
    labels.push(
      `<span class="mdmark-diagram-label${dim}" data-message="${message}" style="left:${(start + end) / 2}px;top:${y - 14}px">${escapeHtml(number)}${marker.render(item.text)}</span>`,
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
          ? '<path d="M0,0 L9,4.5 L0,9 z" style="fill:var(--mdmark-color-diagram-line)"></path>'
          : head === "cross"
            ? '<path d="M1,1 L8,8 M8,1 L1,8" fill="none" stroke-width="1.5" style="stroke:var(--mdmark-color-diagram-line)"></path>'
            : '<path d="M1,1 L8,4.5 L1,8" fill="none" stroke-width="1.5" style="stroke:var(--mdmark-color-diagram-line)"></path>';
      return `<marker id="${id}-head-${head}" class="mdmark-diagram-arrowhead" data-head="${head}" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker>`;
    })
    .join("");
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
      return `<div class="mdmark-diagram-node map-participant map-kinded${dim}${selected.has(name) ? " is-selected" : ""}" data-kind="map" data-shape="${kind?.shape ?? "rounded"}"${kind?.color === undefined ? "" : ` data-color="${escapeHtml(kind.color)}"`} data-node="${escapeHtml(name)}" data-participant="${escapeHtml(name)}" role="button" tabindex="0" aria-keyshortcuts="Enter Space Alt+ArrowLeft Alt+ArrowRight" aria-label="${escapeHtml(selectableName(labelOf(name), selected.has(name)))}"${selected.has(name) ? " data-selected" : ""} style="left:${(x.get(name) ?? 0) - MAP_SEQ.headW / 2}px;top:${MAP_SEQ.headTop}px;width:${MAP_SEQ.headW}px"><span class="mdmark-diagram-node-kind${icon === "" && tag === "" ? " is-empty" : ""}">${icon}${tag}</span><span class="mdmark-diagram-node-name">${marker.render(labelOf(name))}</span></div>`;
    })
    .join("");
  const html = [
    `<svg class="mdmark-diagram-wires" width="${width}" height="${height}" aria-hidden="true"><defs>${markers}</defs><g class="map-seq-under">${under.join("")}</g>${lifelines}${wires.join("")}<g class="map-seq-above">${above.join("")}</g><g class="map-packets" aria-hidden="true">${renderPackets(packetPaths)}</g></svg>`,
    labels.join(""),
    overlay.join(""),
    `<div class="mdmark-diagram-seq-heads" style="width:${width}px;height:${MAP_SEQ.headTop + MAP_SEQ.headH + 8}px">${heads}</div>`,
  ].join("");
  return {
    html,
    tips: `${markTipTerms(noteTips.html(), args.terms)}${marker.tips.html()}`,
  };
};

/** 部品『mapのER図』のテーブルのノードの寸法（px）。列の行は、テーブル名の行の下から同じ高さで並ぶ */
export const MAP_ER = {
  width: 240,
  /** テーブル名の行（種類の行と名前）の高さ */
  head: 56,
  row: 28,
  foot: 6,
  /** ノードの左右に空ける幅（関連の端と多重度の置き場所） */
  aside: 32,
  /** 関連の端の、ノードの辺から外へ出す長さ（同じ辺から出る 2 本目からは step ずつ延ばす） */
  endOut: 14,
  step: 6,
  /** 多重度の文字の、端からの離れ */
  cardinalityGap: 4,
  /** 行が増える関連のマーカーの、線からの離れ */
  fanoutGap: 22,
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
  /** ツールチップの id の頭 */
  id?: string | undefined;
};

/** 部品『mapのER図』のテーブルの中身。列を開閉するボタン・列の行・列の説明のツールチップ */
export const renderMapEr = (
  args: MapErTableArgs,
): { toggle: string; columns: string; tips: string } => {
  const label = `${args.name}の列を${args.collapsed ? "開く" : "閉じる"}`;
  const toggle = `<button class="map-er-toggle" type="button" data-node-toggle="${escapeHtml(args.name)}" aria-expanded="${!args.collapsed}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${args.collapsed ? `列 ${args.columns.length}` : iconSvg("chevron-down")}</button>`;
  if (args.collapsed) return { toggle, columns: "", tips: "" };
  const tips = createTips(args.id ?? `map-er-${args.name}`);
  const rows = args.columns
    .map((column) => {
      const note = args.notes[column.name];
      const owner = `column:${args.name}.${column.name}`;
      const mark =
        note === undefined
          ? ""
          : `<button class="map-er-note" type="button" aria-label="${escapeHtml(`${column.name}の説明`)}" aria-describedby="${tips.add({ kind: "hint", label: column.name, hint: note, owner })}" data-tip-owner="${escapeHtml(owner)}">i</button>`;
      return `<div class="map-er-column" role="listitem" data-column="${escapeHtml(column.name)}"><span class="map-er-key">${escapeHtml(column.keys.join(","))}</span><span class="map-er-name">${escapeHtml(column.name)}</span><span class="map-er-type">${escapeHtml(column.type)}</span><span class="map-er-note-cell">${mark}</span></div>`;
    })
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

/**
 * 自動配置の経路の元の端を、高さ y の左右の辺へ付け替える。経路の残りは自動配置のまま使い、ノードを横切らない。
 * 上下の辺から出ていた端は、次の点がある側の辺から出して、ノードの外で元の経路へ戻す
 */
const reanchor = (
  points: Point[],
  rect: { x: number; y: number; w: number; h: number },
  y: number,
  side: "left" | "right" | undefined,
  /** 辺ごとに、その辺から出す長さを返す */
  outOf: (side: "left" | "right") => number,
): Point[] => {
  const [p0, p1] = points;
  if (!p0 || !p1) return points;
  const onSide = p0[0] === rect.x || p0[0] === rect.x + rect.w;
  const chosen =
    side ??
    (onSide
      ? p0[0] === rect.x
        ? "left"
        : "right"
      : p1[0] >= rect.x + rect.w / 2
        ? "right"
        : "left");
  const sx = chosen === "right" ? rect.x + rect.w : rect.x;
  const out = outOf(chosen);
  const ox = sx + (chosen === "right" ? out : -out);
  const back = onSide && side === undefined ? p0[1] : p1[1];
  return [[sx, y], [ox, y], [ox, back], ...points.slice(1)];
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
    let points = reanchor(
      wire.points as Point[],
      from,
      yOf(from, fromColumn),
      sideOf(ends?.from),
      outFor(from.id),
    );
    points = reanchor(
      [...points].reverse(),
      to,
      yOf(to, toColumn),
      sideOf(ends?.to),
      outFor(to.id),
    ).reverse();
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

/** 関連のラベルと行が増える関連のマーカーの置き場所（両端を除いた最も長い区間の中ほどの、線の両側） */
const erMarkOf = (
  points: Point[],
): { label: Point; mark: Point; vertical: boolean } => {
  const [a, b] = longestInner(points);
  const vertical = a[0] === b[0];
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return {
    label: vertical ? [mid[0] + 8, mid[1] + 4] : [mid[0], mid[1] - 8],
    mark: vertical
      ? [mid[0] - MAP_ER.fanoutGap, mid[1]]
      : [mid[0], mid[1] + MAP_ER.fanoutGap],
    vertical,
  };
};

/** 関連の両端の多重度とラベルの SVG。文字は `data-wire-mark` に関連の ID を持ち、薄くする関連は `map-dim` */
export const renderMapErMarks = (args: {
  layout: MapLayout;
  relations: MapErRelation[];
  dim: ReadonlySet<string>;
}): string => {
  const relations = new Map(args.relations.map((item) => [item.id, item]));
  const texts: string[] = [];
  const text = (options: {
    wire: string;
    at: Point;
    value: string;
    className: string;
    anchor: "start" | "middle" | "end";
  }) =>
    texts.push(
      `<text class="${options.className}${args.dim.has(options.wire) ? " map-dim" : ""}" data-wire-mark="${escapeHtml(options.wire)}" x="${options.at[0]}" y="${options.at[1]}" text-anchor="${options.anchor}">${escapeHtml(options.value)}</text>`,
    );
  for (const wire of args.layout.wires) {
    const relation = relations.get(wire.id);
    const points = wire.points as Point[];
    if (!relation || points.length < 2) continue;
    const ends: Array<[Point, Point, string]> = [
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
    for (const [[x, y], [nx], value] of ends) {
      const right = nx >= x;
      text({
        wire: wire.id,
        at: [
          x + (right ? MAP_ER.cardinalityGap : -MAP_ER.cardinalityGap),
          y - 5,
        ],
        value,
        className: "map-er-cardinality",
        anchor: right ? "start" : "end",
      });
    }
    if (relation.label === undefined) continue;
    const place = erMarkOf(points);
    text({
      wire: wire.id,
      at: place.label,
      value: relation.label,
      className: "map-er-label",
      anchor: place.vertical ? "start" : "middle",
    });
  }
  return `<svg class="map-er-marks" width="${args.layout.width}" height="${args.layout.height}" aria-hidden="true">${texts.join("")}</svg>`;
};

/** 行が増える関連のマーカー（`button.map-er-fanout`）と、その説明のツールチップ */
export const renderMapErFanouts = (args: {
  layout: MapLayout;
  fanouts: MapErFanout[];
  /** ツールチップの id の頭 */
  id: string;
}): MapPart => {
  const tips = createTips(`${args.id}-fanout`);
  const html = args.fanouts
    .flatMap((fanout, index) => {
      const wire = args.layout.wires.find((item) => item.id === fanout.wire);
      if (!wire || wire.points.length < 2) return [];
      const place = erMarkOf(wire.points as Point[]);
      const owner = `fanout:${index}`;
      const tip = tips.add({
        kind: "wire",
        label: "行が増える関連",
        tip: `${fanout.from} から ${fanout.to} へたどると、${fanout.from} の 1 行に ${fanout.to} の行が複数つながり、行が増えます`,
        owner,
      });
      return [
        `<button class="map-er-fanout" type="button" style="left:${place.mark[0]}px;top:${place.mark[1]}px" aria-label="${escapeHtml(`${fanout.from} から ${fanout.to} で行が増える`)}" aria-describedby="${escapeHtml(tip)}" data-tip-owner="${escapeHtml(owner)}">×n</button>`,
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
    const part = renderMapEr({
      ...table,
      collapsed: args.collapsed.includes(table.name),
      id: `${id}-er-${index}`,
    });
    nodeParts[table.name] = {
      head: part.toggle,
      body: part.columns,
      tips: part.tips,
    };
  }
  const flow = renderMapFlow({ ...args, nodeParts });
  const kept = keptOf(args);
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
export const MAP_STATE = { point: 32, choice: 40, loopSpace: 40 } as const;

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

/** 部品『mapの状態遷移図』の HTML。構成図の部品に開始・終了・分岐の形状と注記の種類の行を付け、同じ状態への遷移を重ねる */
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
