import type {
  MdmarkChartDefinition,
  MdmarkDiagramNode,
  MdmarkErCardinality,
  MdmarkErDefinition,
  MdmarkErTable,
  MdmarkErTableKind,
  MdmarkFlowDefinition,
  MdmarkNodeStyle,
  MdmarkWireStyle,
} from "../diagram/definition.ts";
import {
  ER_CARDINALITIES,
  ER_COLUMN_KEYS,
  ER_METRICS,
  ER_TABLE_KINDS,
  erRelationRoute,
  erTableHeight,
} from "../diagram/er.ts";
import { jumpPaths, ZOOM } from "../diagram/geometry.ts";
import { pointSvg, renderChart, SCATTER_POINT_SIZE } from "./chart.ts";
import { isColorName } from "./colors.ts";
import { erEndSvg, plainDefinitionText, renderErTable } from "./er.ts";
import { escapeHtml } from "./escape.ts";
import { noteOwnerId } from "./footnote.ts";
import { bundledIconNode, type IconName, iconSvg } from "./icons.ts";
import { iconNodeSvg, type MdmarkIconNode } from "./inline-icon.ts";

/** 矢じりの大きさ（px） */
const HEAD_SIZE = 9;

/** 図の表示する枠のキー操作 */
const VIEWPORT_KEYS = "+ - 0 ArrowLeft ArrowUp ArrowDown ArrowRight";

/** 数を小数 2 桁までの文字にする */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 凡例の項目 */
export type DiagramLegendItem = {
  /** 見本の種類: `series-{n}`・`fill-{n}`・`point-{n}`・`bubble`・ER 図の `er-*`・`info`・`underline` */
  sample: string;
  /** 意味 */
  label: string;
};

/** 図の枠の引数 */
export type DiagramFrame = {
  /** 中の図の種類 */
  kind: "chart" | "er" | "mermaid" | "map";
  /** 題名 */
  title: string;
  /** 範囲（種類 `mermaid` では持たず、タイトルに出さない） */
  scope?: string;
  /** 更新日（種類 `mermaid` では持たず、タイトルに出さない） */
  updated?: string;
  /** 凡例の項目 */
  legend: DiagramLegendItem[];
  /** 今の倍率（定義の大きさを 1 とする） */
  zoom?: number;
  /** 全体が収まる倍率（倍率のボタンはこれを 100% として出す。省くと 1） */
  fit?: number;
  /** 全画面のモーダルの中に描くか */
  modal?: boolean;
  /** 表示する枠の右下にリサイズハンドルを配置するか（既定 `true`。モーダルの中には配置しない） */
  resizable?: boolean;
  /** 開いたときの倍率の下限（`figure` の `data-fit-min` に入れる） */
  fitMin?: number;
  /** 置き場所の幅いっぱいに広げるか（`figure` に `data-wide="true"`。map の図） */
  wide?: boolean;
  /** 指で図を動かす操作中か（表示するノードに `data-touch-active` を付ける。ストーリーの状態だけが指定する） */
  touchActive?: boolean;
  /** 右上の帯の先頭に並べるボタン（map の図）。`name` は `MAP_TOOL_ICONS` のキー */
  tools?: Array<{ name: string; label: string; disabled?: boolean }>;
  /** ツールチップと矢じりの `id` の頭 */
  id: string;
};

/** map の図の右上の帯の先頭のボタンのアイコン */
export const MAP_TOOL_ICONS: Readonly<Record<string, IconName>> = {
  back: "corner-up-left",
  expandAll: "chevrons-up-down",
  collapseAll: "chevrons-down-up",
  reset: "rotate-ccw",
};

/** 図の中身 */
export type DiagramBody = {
  /** 図の HTML */
  html: string;
  /** 図の幅（px） */
  width: number;
  /** 図の高さ（px） */
  height: number;
  /** ツールチップの HTML */
  tips: string;
};

/** `renderFlow`・`renderEr`・`renderChart` の戻り値: 図の中身と、凡例に記載する図の特徴 */
export type DiagramPart = DiagramBody & {
  /** 横の線が縦の線を飛び越える点があるか */
  jumps: boolean;
  /** 用語の下線を付けたノードの文字があるか */
  terms: boolean;
};

/** 用語から意味を参照する関数。意味が無い用語は `undefined` */
export type TermLookup = (word: string) => string | undefined;

/** ツールチップの引数 */
export type DiagramTip = {
  /** ツールチップの `id` */
  id: string;
  /** 線の詳細か、文だけか（ノード・グループの説明・埋め込んだ HTML の `data-hint`）か、ER 図のテーブルか、グラフの項目か */
  kind: "wire" | "hint" | "table" | "item";
  /** 持ち主の名前。ツールチップのタイトルに出す */
  label: string;
  /** グラフの項目の値の文（`item` のとき） */
  value?: string;
  /** 線の詳細 */
  tip?: string;
  /** ノード・グループの説明か `data-hint` の文 */
  hint?: string;
  /** ER 図のテーブル。タイトルを `{論理名}（{物理名}）` にし、概要と、`desc` を持つ列の名前と説明を並べる */
  table?: MdmarkErTable;
  /** 持ち主を参照する名前（線の `id`・`node:{ノードの id}`・`term:{単語}`）。省くとタイトル */
  owner?: string;
  /** 開いているか */
  open?: boolean;
  /** 持ち主が参照する注記（番号の順）。`html` は描いた HTML なのでエスケープしない */
  annotations?: DiagramAnnotation[] | undefined;
};

/** 図のツールチップに出す注記 1 つ */
export type DiagramAnnotation = { number: number; html: string };

/** 図の要素の ID ごとの注記と、持ち主の `id` の頭（`renderFlow` の引数） */
export type DiagramAnnotations = {
  items: Record<string, DiagramAnnotation[]>;
  ownerPrefix: string;
};

/** 注記ごとの区分（見出し `注記 {番号}` と本文） */
function annotationSections(
  annotations: DiagramAnnotation[] | undefined,
): string {
  return (annotations ?? [])
    .map(
      ({ number, html }) =>
        `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading mdmark-note-tip-heading">注記 ${number}</span><span class="mdmark-term-tip-meaning">${html}</span></span>`,
    )
    .join("");
}

/** 説明と注記の有無から、マーカーのボタンのスクリーンリーダー向けの名前を返却する */
export function infoLabel(options: {
  name: string;
  described: boolean;
  annotated: boolean;
}): string {
  const { name, described, annotated } = options;
  if (!annotated) {
    return `「${name}」の説明`;
  }
  return described ? `「${name}」の説明と注記` : `「${name}」の注記`;
}

/** 注記を持つ要素の持ち主の `id` 属性（注記を持たなければ空） */
export function ownerIdAttribute(
  annotations: DiagramAnnotations | undefined,
  elementId: string,
): string {
  if (annotations === undefined || !annotations.items[elementId]?.length) {
    return "";
  }
  return ` id="${escapeHtml(noteOwnerId(annotations.ownerPrefix, elementId))}"`;
}

/** 図のツールチップを描く。文だけの `hint` は、行内の要素の後ろにも配置できるよう `span` で出す */
export function renderDiagramTip(tip: DiagramTip): string {
  const hint =
    tip.hint === undefined || tip.hint === ""
      ? ""
      : `<span class="mdmark-term-tip-meaning">${escapeHtml(tip.hint)}</span>`;
  const owner = escapeHtml(tip.owner ?? tip.label);
  const hidden = tip.open ? "" : ' hidden="hidden"';
  const notes = annotationSections(tip.annotations);
  if (tip.kind === "hint") {
    // 説明を持たず注記だけを持つ持ち主は、説明の区分を出さない
    const described =
      hint === "" && notes !== ""
        ? ""
        : `<span class="mdmark-term-tip-section">${hint}</span>`;
    return `<span class="mdmark-diagram-tip mdmark-hint-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}>${described}${notes}</span>`;
  }
  if (tip.kind === "table" && tip.table) {
    const table = tip.table;
    const desc =
      table.desc === undefined
        ? ""
        : `<span class="mdmark-term-tip-meaning">${escapeHtml(table.desc)}</span>`;
    const rows = table.columns
      .filter((column) => column.desc)
      .map(
        (column) =>
          `<dt><code>${escapeHtml(column.name)}</code></dt><dd>${escapeHtml(column.desc ?? "")}</dd>`,
      )
      .join("");
    const columns = rows
      ? `<dl class="mdmark-diagram-tip-io mdmark-diagram-er-tip-columns">${rows}</dl>`
      : "";
    return `<div class="mdmark-diagram-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${escapeHtml(plainDefinitionText(table.label))}（${escapeHtml(plainDefinitionText(table.name))}）</span>${desc}${columns}</span>${notes}</div>`;
  }
  const text = (tip.kind === "item" ? tip.value : tip.tip) ?? "";
  // 線の詳細を持たず注記だけを持つ線は、線の詳細の区分の代わりに注記の区分だけを出す
  const section =
    text === "" && notes !== ""
      ? ""
      : `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${escapeHtml(tip.label)}</span><span class="mdmark-term-tip-meaning">${escapeHtml(text)}</span></span>`;
  return `<div class="mdmark-diagram-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}>${section}${notes}</div>`;
}

/** 図の中のツールチップを集める入れ物 */
export type TipList = {
  /** ツールチップを追加して `id` を返却する */
  add: (tip: Omit<DiagramTip, "id">) => string;
  /** 追加したツールチップの HTML */
  html: () => string;
};

/** `id` の頭から通し番号の `id` を振るツールチップの入れ物を作る */
export function createTips(prefix: string): TipList {
  const rendered: string[] = [];
  return {
    add: (tip) => {
      const id = `${prefix}-tip-${rendered.length + 1}`;
      rendered.push(renderDiagramTip({ ...tip, id }));
      return id;
    },
    html: () => rendered.join(""),
  };
}

/** 定義の文字の `{{単語}}` を、意味のある用語なら下線とツールチップの持ち主にし、それ以外は単語だけにして、文字を逃がして返却する */
export function renderText(
  text: string,
  tips: TipList,
  lookup: TermLookup | undefined,
  found: { terms: boolean },
): string {
  return text
    .split(/\{\{(.+?)\}\}/)
    .map((piece, index) => {
      // split は、区切りの括弧の中身を奇数番目に入れる
      if (index % 2 === 0) {
        return escapeHtml(piece);
      }
      const meaning = lookup?.(piece);
      if (meaning === undefined || meaning === "") {
        return escapeHtml(piece);
      }
      found.terms = true;
      const owner = `term:${piece}`;
      const id = tips.add({
        kind: "wire",
        label: "用語",
        tip: meaning,
        owner,
      });
      return `<span class="mdmark-term" tabindex="0" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${escapeHtml(piece)}</span>`;
    })
    .join("");
}

/** 位置と大きさの `style` */
function boxStyle(box: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  inset?: string;
}): string {
  const size =
    box.w === undefined || box.h === undefined
      ? ""
      : `;width:${num(box.w)}px;height:${num(box.h)}px`;
  return ` style="left:${num(box.x)}px;top:${num(box.y)}px${size}${box.inset ?? ""}"`;
}

/** map の線の模様ごとの破線の間隔 */
const MAP_DASHES: Record<NonNullable<MdmarkWireStyle["dash"]>, string> = {
  solid: "",
  dashed: "6 4",
  dotted: "2 4",
  "dash-dot": "8 3 2 3",
  "long-dash": "12 5",
};

/** map の線の太さ（px） */
const MAP_WIDTHS: Record<NonNullable<MdmarkWireStyle["width"]>, number> = {
  thin: 1,
  normal: 1.5,
  thick: 3,
};

/** map の線の色。色の名前が無ければ線の既定の色 */
const wireColor = (color: string | undefined): string =>
  color === undefined || !isColorName(color)
    ? "var(--mdmark-color-diagram-line)"
    : `var(--mdmark-color-accent-${color}-text, var(--mdmark-color-diagram-line))`;

/** 設定の線の種類で描く線と、`tip` を持つ線のツールチップを取得する透明の太い線。矢じりは線ごとに線と同じ色の marker を持つ */
function renderWire(options: {
  id: string;
  wireId: string;
  d: string;
  hit: boolean;
  custom: MdmarkWireStyle;
  index: number;
}): string {
  const { id, wireId, d, hit, custom, index } = options;
  const color = wireColor(custom.color);
  const dash = MAP_DASHES[custom.dash ?? "solid"];
  const width = MAP_WIDTHS[custom.width ?? "normal"];
  const head = custom.head ?? "filled";
  const markerId = `${id}-head-map-${index}`;
  const shape =
    head === "filled"
      ? `<path d="M0,0 L9,4.5 L0,9 z" fill="${color}"></path>`
      : `<path d="M1,1 L8,4.5 L1,8" fill="none" stroke="${color}" stroke-width="1.5"></path>`;
  const marker =
    head === "none"
      ? ""
      : `<marker id="${markerId}" class="mdmark-diagram-arrowhead" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="${HEAD_SIZE}" markerHeight="${HEAD_SIZE}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker>`;
  const ends =
    head === "none"
      ? ""
      : ` marker-end="url(#${markerId})"${custom.both ? ` marker-start="url(#${markerId})"` : ""}`;
  const visible = `${marker === "" ? "" : `<defs>${marker}</defs>`}<path class="mdmark-diagram-wire" data-line="map" data-wire="${escapeHtml(wireId)}" d="${d}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-width="${width}" style="stroke:${color}"${ends}></path>`;
  const target = hit
    ? `<path class="mdmark-diagram-wire-hit" data-tip-owner="${escapeHtml(wireId)}" d="${d}"></path>`
    : "";
  return visible + target;
}

/** 線のラベル。`tip` を持つラベルはフォーカスでき、ツールチップを指す */
function renderLabel(options: {
  wireId: string;
  label: string | undefined;
  tip: string | undefined;
  at: [number, number];
  tips: TipList;
  annotations?: DiagramAnnotation[] | undefined;
}): string {
  const { wireId, label, tip, at, tips, annotations } = options;
  const line = "map";
  if (label === undefined || label === "") {
    return "";
  }
  const style = boxStyle({ x: at[0], y: at[1] });
  if (tip === undefined || tip === "") {
    return `<span class="mdmark-diagram-label" data-line="${line}" data-wire="${escapeHtml(wireId)}"${style}>${escapeHtml(label)}</span>`;
  }
  const id = tips.add({
    kind: "wire",
    label,
    tip,
    owner: wireId,
    annotations,
  });
  return `<span class="mdmark-diagram-label has-tip" data-line="${line}" data-wire="${escapeHtml(wireId)}" tabindex="0" aria-describedby="${id}" data-tip-owner="${escapeHtml(wireId)}"${style}>${escapeHtml(label)}</span>`;
}

/** 折れ線の最も長い区間の中点（`labelAt` を省いたときのラベルの位置） */
function labelPosition(points: Array<[number, number]>): [number, number] {
  let best: [number, number] = points[0] ?? [0, 0];
  let longest = -1;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1];
    const to = points[index];
    if (!from || !to) {
      continue;
    }
    const length = Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]);
    if (length > longest) {
      longest = length;
      best = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    }
  }
  return best;
}

/** ノード 1 つ（種類の行・名前・補足と、`hint` を持つノードの右上のマーカー）の HTML。`hints` がオフならマーカーを配置しない */
function renderNode(options: {
  node: MdmarkDiagramNode;
  box: { x: number; y: number; w: number; h: number };
  tips: TipList;
  lookup: TermLookup | undefined;
  found: { terms: boolean };
  hints: boolean;
  annotations?: DiagramAnnotations | undefined;
}): string {
  const { node, box, tips, lookup, found, hints, annotations } = options;
  const name = renderText(node.name, tips, lookup, found);
  const sub =
    node.sub === undefined
      ? ""
      : `<span class="mdmark-diagram-node-sub">${renderText(node.sub, tips, lookup, found)}</span>`;
  const described = node.hint !== undefined && node.hint !== "";
  const notes = annotations?.items[node.id];
  const annotated = (notes?.length ?? 0) > 0;
  // 説明か注記を持つノードは、右上のマーカーとツールチップを持つ
  const hasTip = hints && (described || annotated);
  let info = "";
  if (hasTip) {
    const owner = `node:${node.id}`;
    const id = tips.add({
      kind: "hint",
      label: node.name,
      hint: node.hint,
      owner,
      annotations: notes,
    });
    const label = infoLabel({ name: node.name, described, annotated });
    info = `<button class="mdmark-diagram-info" type="button"${ownerIdAttribute(annotations, node.id)} aria-label="${escapeHtml(label)}" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
  }
  // リンク先を持つノード: ノードの全体を覆うリンクを配置し、右上のマーカーはリンクの後ろ（リンクの外）に配置する
  const link =
    node.href === undefined
      ? ""
      : `<a class="mdmark-diagram-node-link" href="${escapeHtml(node.href)}" aria-label="${escapeHtml(node.name)}"></a>`;
  const classes = `mdmark-diagram-node${hasTip ? " has-tip" : ""}${node.href === undefined ? "" : " has-link"}`;
  return renderStyledNode({
    node,
    style: node.style,
    box,
    classes,
    name,
    sub,
    link,
    info,
  });
}

/** map の構成図のノード: 設定の種類の名前・アイコン・構造・色で描く。種類の行は名前もアイコンも無いときも高さを取る空の行にする */
function renderStyledNode(options: {
  node: Pick<MdmarkDiagramNode, "id" | "name">;
  style: MdmarkNodeStyle;
  box: { x: number; y: number; w: number; h: number };
  classes: string;
  name: string;
  sub: string;
  link: string;
  info: string;
}): string {
  const { node, style, box, classes, name, sub, link, info } = options;
  const bundled =
    style.icon === undefined ? undefined : bundledIconNode(style.icon);
  const icon =
    style.icon === undefined
      ? ""
      : bundled
        ? iconNodeSvg(bundled as unknown as MdmarkIconNode)
        : `<span class="mdmark-map-icon" data-icon="${escapeHtml(style.icon)}" aria-hidden="true"></span>`;
  const label =
    style.label === undefined ? "" : `<span>${escapeHtml(style.label)}</span>`;
  const empty = icon === "" && label === "" ? " is-empty" : "";
  const named = style.color !== undefined && isColorName(style.color);
  const color = named ? ` data-color="${style.color}"` : "";
  // 種類の色は枠線と種類の行の色に当てる（`--map-kind`。色の名前の一覧に無い値は当てない）
  const tint = named
    ? `;--map-kind:var(--mdmark-color-accent-${style.color}-text)`
    : "";
  return `<div class="${classes} map-kinded" data-kind="map" data-shape="${style.shape ?? "rounded"}"${color} data-node="${escapeHtml(node.id)}"${boxStyle({ ...box, inset: tint })}><span class="mdmark-diagram-node-kind${empty}">${icon}${label}</span><span class="mdmark-diagram-node-name">${name}</span>${sub}${link}${info}</div>`;
}

/** 説明を持つグループのタイトルの右のマーカー（説明が無ければ空） */
export function groupInfo(options: {
  hint: string | undefined;
  label: string;
  owner: string;
  tips: TipList;
  /** グループの注記 */
  annotations?: DiagramAnnotation[] | undefined;
  /** 注記を持つときの持ち主の `id` */
  ownerId?: string | undefined;
}): string {
  const { hint, label, owner, tips, annotations, ownerId } = options;
  const described = hint !== undefined && hint !== "";
  const annotated = (annotations?.length ?? 0) > 0;
  if (!described && !annotated) {
    return "";
  }
  const id = tips.add({ kind: "hint", label, hint, owner, annotations });
  const name = infoLabel({ name: label, described, annotated });
  const idAttribute =
    annotated && ownerId !== undefined ? ` id="${escapeHtml(ownerId)}"` : "";
  return `<button class="mdmark-diagram-info mdmark-diagram-group-info" type="button"${idAttribute} aria-label="${escapeHtml(name)}" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
}

/** map の構成図のノードと線を描く */
export function renderFlow(
  definition: MdmarkFlowDefinition,
  id: string,
  options: {
    hints: boolean;
    lookup?: TermLookup;
    annotations?: DiagramAnnotations;
  },
): DiagramPart {
  const { hints, lookup, annotations } = options;
  const tips = createTips(id);
  const found = { terms: false };
  const parts: string[] = [];
  const paths = jumpPaths(definition.wires);
  const wires = definition.wires
    .map((wire, index) =>
      renderWire({
        id,
        wireId: wire.id,
        d: paths.get(wire.id) ?? "",
        hit: hints && wire.tip !== undefined && wire.tip !== "",
        custom: wire.style,
        index,
      }),
    )
    .join("");
  parts.push(
    `<svg class="mdmark-diagram-wires" width="${num(definition.width)}" height="${num(definition.height)}" aria-hidden="true">${wires}</svg>`,
  );
  for (const node of definition.nodes) {
    parts.push(
      renderNode({ node, box: node, tips, lookup, found, hints, annotations }),
    );
  }
  for (const wire of definition.wires) {
    parts.push(
      renderLabel({
        wireId: wire.id,
        label: wire.label,
        tip: hints ? wire.tip : undefined,
        at: wire.labelAt ?? labelPosition(wire.points),
        tips,
        annotations: annotations?.items[wire.id],
      }),
    );
  }
  return {
    html: parts.join(""),
    width: definition.width,
    height: definition.height,
    tips: tips.html(),
    jumps: [...paths.values()].some((path) => path.includes(" A")),
    terms: found.terms,
  };
}

/** ER 図を描く: テーブルを配置し、関係の線と両端の多重度の記号を svg に描き、ラベルを縦の線の中ほどに配置する */
export function renderEr(
  definition: MdmarkErDefinition,
  id: string,
  options: { hints: boolean; lookup?: TermLookup },
): DiagramPart {
  const { hints, lookup } = options;
  const tips = createTips(id);
  const found = { terms: false };
  const text = (value: string): string =>
    renderText(value, tips, lookup, found);
  const tables = new Map(definition.tables.map((table) => [table.id, table]));
  const folded = (tableId: string): boolean =>
    tables.get(tableId)?.folded === true;
  const svg: string[] = [];
  const labels: string[] = [];
  definition.relations.forEach((relation, index) => {
    const from = tables.get(relation.from);
    const to = tables.get(relation.to);
    if (!from || !to) {
      return;
    }
    const route = erRelationRoute({ relation, from, to, folded });
    const mid =
      relation.midX === undefined ? "" : ` data-er-mid-x="${relation.midX}"`;
    svg.push(
      `<g data-er-relation="${index}" data-er-from="${escapeHtml(relation.from)}" data-er-from-column="${escapeHtml(relation.fromColumn)}" data-er-from-card="${relation.fromCard}" data-er-to="${escapeHtml(relation.to)}" data-er-to-column="${escapeHtml(relation.toColumn)}" data-er-to-card="${relation.toCard}"${mid}><path class="mdmark-diagram-wire" data-line="er" d="${route.d}"></path><g class="mdmark-diagram-er-ends">${erEndSvg({ ...route.start, card: relation.fromCard })}${erEndSvg({ ...route.end, card: relation.toCard })}</g></g>`,
    );
    if (relation.label) {
      labels.push(
        `<span class="mdmark-diagram-label" data-line="er" data-er-relation="${index}" style="left:${route.label.x}px;top:${route.label.y}px">${text(relation.label)}</span>`,
      );
    }
  });
  const height =
    Math.max(
      0,
      ...definition.tables.map(
        (table) =>
          table.y + erTableHeight({ table, folded: table.folded === true }),
      ),
    ) + ER_METRICS.bottom;
  const parts = [
    `<svg class="mdmark-diagram-wires" width="${num(definition.width)}" height="${num(height)}" aria-hidden="true">${svg.join("")}</svg>`,
  ];
  for (const table of definition.tables) {
    const described =
      table.desc !== undefined || table.columns.some((column) => column.desc);
    const tipId =
      hints && described
        ? tips.add({
            kind: "table",
            label: plainDefinitionText(table.label),
            table,
            owner: `table:${table.id}`,
          })
        : undefined;
    parts.push(renderErTable({ table, tipId, text }));
  }
  parts.push(...labels);
  return {
    html: parts.join(""),
    width: definition.width,
    height,
    tips: tips.html(),
    jumps: false,
    terms: found.terms,
  };
}

/** 図の定義 */
type LegendDefinition = MdmarkChartDefinition | MdmarkErDefinition;

/** ER 図の定義か（`tables` を持つ） */
function isErDefinition(
  definition: LegendDefinition,
): definition is MdmarkErDefinition {
  return "tables" in definition;
}

/** ER 図の凡例の項目: 図にあるテーブルの種類の札・列のマーカー・多重度の記号だけを並べる */
function erLegend(definition: MdmarkErDefinition): DiagramLegendItem[] {
  const items: DiagramLegendItem[] = [];
  for (const kind of Object.keys(ER_TABLE_KINDS) as MdmarkErTableKind[]) {
    if (definition.tables.some((table) => table.kind === kind)) {
      items.push({
        sample: `er-kind-${kind}`,
        label: `${ER_TABLE_KINDS[kind].label}のテーブル`,
      });
    }
  }
  for (const key of Object.keys(ER_COLUMN_KEYS) as Array<
    keyof typeof ER_COLUMN_KEYS
  >) {
    if (definition.tables.some((table) => table.columns.some((c) => c[key]))) {
      items.push({ sample: `er-key-${key}`, label: ER_COLUMN_KEYS[key].title });
    }
  }
  const used = new Set(
    definition.relations.flatMap((relation) => [
      relation.fromCard,
      relation.toCard,
    ]),
  );
  for (const card of Object.keys(ER_CARDINALITIES) as MdmarkErCardinality[]) {
    if (used.has(card)) {
      items.push({ sample: `er-card-${card}`, label: ER_CARDINALITIES[card] });
    }
  }
  return items;
}

/** ER 図の凡例の見本（テーブルの種類の札・列のマーカー・多重度の記号）。ER 図の見本でなければ `undefined` */
function erLegendSample(sample: string): string | undefined {
  if (sample.startsWith("er-kind-")) {
    const kind = sample.slice("er-kind-".length) as MdmarkErTableKind;
    const style = ER_TABLE_KINDS[kind];
    return `<span class="mdmark-diagram-er-kind mdmark-diagram-er-kind-sample" data-color="${style.color}" aria-hidden="true">${style.label}</span>`;
  }
  if (sample.startsWith("er-key-")) {
    const key = sample.slice("er-key-".length) as keyof typeof ER_COLUMN_KEYS;
    return `<span class="mdmark-diagram-er-key" data-key="${key}" aria-hidden="true">${ER_COLUMN_KEYS[key].text}</span>`;
  }
  if (sample.startsWith("er-card-")) {
    const card = sample.slice("er-card-".length) as MdmarkErCardinality;
    return `<svg class="mdmark-diagram-legend-sample mdmark-diagram-er-sample" width="34" height="16" aria-hidden="true"><path class="mdmark-diagram-wire" data-line="er" d="M8,8 H34"></path>${erEndSvg({ x: 4, y: 8, dir: 1, card })}</svg>`;
  }
  return undefined;
}

/** 系列を塗りの模様の見本で示すグラフの種類 */
const FILL_LEGEND_TYPES: readonly string[] = [
  "bar",
  "stacked-bar",
  "stacked-area",
  "horizontal-bar",
  "bubble",
];

/** グラフの凡例の項目: 種類ごとの見本（折れ線・面・レーダーは線と点、棒・積み上げ・横棒・円・バブルは塗りの模様、散布図は点の形状）に、系列か項目の名前を添える */
function chartLegend(definition: MdmarkChartDefinition): DiagramLegendItem[] {
  const type = definition.type ?? "line";
  const unit = definition.unit ?? "";
  if (type === "pie") {
    return (definition.items ?? []).map((item, index) => ({
      sample: `fill-${index + 1}`,
      label: `${item.name}（${item.value}${unit}）`,
    }));
  }
  if (type === "donut") {
    return (definition.items ?? []).map((item, index) => ({
      sample: `fill-${index + 1}`,
      label: `${item.name}: ${item.value}${unit}`,
    }));
  }
  const items = (definition.series ?? []).map((series, index) => {
    const n = index + 1;
    if (type === "combo") {
      const side =
        definition.y2 === undefined
          ? ""
          : series.axis === "y2"
            ? "（右の軸）"
            : "（左の軸）";
      return {
        sample: series.as === "bar" ? `fill-${n}` : `series-${n}`,
        label: `${series.name}${side}`,
      };
    }
    const sample = FILL_LEGEND_TYPES.includes(type)
      ? "fill"
      : type === "scatter"
        ? "point"
        : "series";
    return { sample: `${sample}-${n}`, label: series.name };
  });
  if (type === "bubble") {
    items.push({
      sample: "bubble",
      label: `円の面積: ${definition.size?.label ?? ""}`,
    });
  }
  return items;
}

/** 凡例の項目: グラフは系列（円とドーナツは項目）、ER 図はテーブルの種類・列のマーカー・多重度を並べる */
export function legendFor(definition: LegendDefinition): DiagramLegendItem[] {
  return isErDefinition(definition)
    ? erLegend(definition)
    : chartLegend(definition);
}

/** 凡例の見本（系列・ER 図の札と記号・マーカー）の svg */
function legendSample(id: string, sample: string): string {
  if (sample === "underline") {
    return "";
  }
  const er = erLegendSample(sample);
  if (er !== undefined) {
    return er;
  }
  if (sample.startsWith("fill-")) {
    const n = Number(sample.slice("fill-".length));
    return `<svg class="mdmark-diagram-legend-sample" width="18" height="14" aria-hidden="true"><g data-series="${n}"><rect class="mdmark-diagram-bar" x="1" y="1" width="16" height="12" fill="url(#${id}-fill-${n})"></rect></g></svg>`;
  }
  if (sample.startsWith("point-")) {
    const n = Number(sample.slice("point-".length));
    return `<svg class="mdmark-diagram-legend-sample" width="14" height="14" aria-hidden="true"><g data-series="${n}">${pointSvg(n, 7, 7, SCATTER_POINT_SIZE)}</g></svg>`;
  }
  if (sample.startsWith("series-")) {
    const n = Number(sample.slice("series-".length));
    return `<svg class="mdmark-diagram-legend-sample" width="34" height="12" aria-hidden="true"><path class="mdmark-diagram-series" data-series="${n}" d="M1,6 H33"></path><g data-series="${n}">${pointSvg(n, 17, 6)}</g></svg>`;
  }
  if (sample === "bubble") {
    return '<svg class="mdmark-diagram-legend-sample mdmark-diagram-legend-bubble" width="30" height="16" aria-hidden="true"><circle cx="5" cy="11" r="3"></circle><circle cx="20" cy="8" r="7"></circle></svg>';
  }
  return `<span class="mdmark-diagram-legend-info">${iconSvg("info")}</span>`;
}

/** 凡例の項目の並び（`ul` の中身）。`id` はグラフの塗りの模様の見本が指す `id` の頭 */
export function renderLegendItems(
  id: string,
  items: DiagramLegendItem[],
): string {
  return items.map((item) => renderLegendItem(id, item)).join("");
}

/** 凡例の 1 項目 */
function renderLegendItem(id: string, item: DiagramLegendItem): string {
  const label =
    item.sample === "underline"
      ? `<span class="mdmark-diagram-legend-term">下線</span>${escapeHtml(item.label.slice("下線".length))}`
      : escapeHtml(item.label);
  return `<li class="mdmark-diagram-legend-item">${legendSample(id, item.sample)}<span>${label}</span></li>`;
}

/** 右上のボタンの帯（移動・拡大と縮小・全画面）。モーダルの中では全画面のボタンの代わりに閉じるボタンを配置する */
function renderTools(frame: DiagramFrame): string {
  const zoom = frame.zoom ?? 1;
  const fit = frame.fit ?? 1;
  const tool = (
    name: string,
    label: string,
    icon: IconName,
    disabled = false,
  ): string =>
    `<button class="mdmark-diagram-tool" type="button" data-tool="${name}" aria-label="${label}"${disabled ? ' disabled="disabled"' : ""}>${iconSvg(icon)}</button>`;
  const extra =
    frame.tools === undefined || frame.tools.length === 0
      ? ""
      : `<div class="mdmark-diagram-tools-group" data-group="map">${frame.tools
          .map(
            (item) =>
              `<button class="mdmark-diagram-tool" type="button" data-tool="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}"${item.disabled ? ' disabled="disabled"' : ""}>${iconSvg(MAP_TOOL_ICONS[item.name] ?? "ellipsis")}</button>`,
          )
          .join("")}</div>`;
  const pan = [
    tool("left", "左へ動かす", "chevron-left"),
    tool("up", "上へ動かす", "chevron-up"),
    tool("down", "下へ動かす", "chevron-down"),
    tool("right", "右へ動かす", "chevron-right"),
  ].join("");
  const screen = frame.modal
    ? tool("close", "全画面を閉じる", "x")
    : tool("fullscreen", "全画面で開く", "expand");
  const percent = `${Math.round((zoom / fit) * 100)}%`;
  const zoomButton = `<button class="mdmark-diagram-tool mdmark-diagram-zoom" type="button" data-tool="fit" aria-label="倍率 ${percent}。全体が収まる倍率に戻す">${percent}</button>`;
  const panGroup =
    frame.kind === "map"
      ? ""
      : `<div class="mdmark-diagram-tools-group" data-group="pan"${zoom > fit ? "" : ' hidden="hidden"'}>${pan}</div>`;
  return `<div class="mdmark-diagram-tools" role="toolbar" aria-label="「${escapeHtml(frame.title)}」の表示">${extra}${panGroup}<div class="mdmark-diagram-tools-group" data-group="zoom">${tool("out", "縮小", "minus", zoom <= fit)}${zoomButton}${tool("in", "拡大", "plus", zoom >= ZOOM.max)}</div><div class="mdmark-diagram-tools-group" data-group="screen">${screen}</div></div>`;
}

/** 図の枠を描く: タイトル・ボタンの帯・表示する枠・ツールチップの中身・凡例を並べる */
export function renderDiagramFrame(
  frame: DiagramFrame,
  body: DiagramBody,
): string {
  const id = escapeHtml(frame.id);
  const zoom = frame.zoom ?? 1;
  const sizer = `width:${num(body.width * zoom)}px;height:${num(body.height * zoom)}px`;
  const stage = `width:${num(body.width)}px;height:${num(body.height)}px${zoom === 1 ? "" : `;transform:scale(${num(zoom)})`}`;
  const legend = renderLegendItems(id, frame.legend);
  const resize =
    frame.resizable !== false && frame.modal !== true
      ? `<div class="mdmark-diagram-resize" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="「${escapeHtml(frame.title)}」の表示の高さ" aria-keyshortcuts="ArrowUp ArrowDown" title="ドラッグか ↑ ↓ で高さを変える。ダブルクリックで図の全体が収まる高さにする">${iconSvg("equal")}</div>`
      : "";
  const fitMin =
    frame.fitMin === undefined ? "" : ` data-fit-min="${num(frame.fitMin)}"`;
  const meta =
    frame.scope === undefined || frame.updated === undefined
      ? ""
      : `<span class="mdmark-diagram-meta">範囲: ${escapeHtml(frame.scope)}・更新日: <time datetime="${escapeHtml(frame.updated)}">${escapeHtml(frame.updated)}</time></span>`;
  const wide = frame.wide === true ? ' data-wide="true"' : "";
  const touchActive = frame.touchActive === true ? " data-touch-active" : "";
  return `<figure class="mdmark-diagram" data-diagram="${frame.kind}"${fitMin}${wide}><figcaption class="mdmark-diagram-head" id="${id}-title"><span class="mdmark-diagram-title">${escapeHtml(frame.title)}</span>${meta}</figcaption><div class="mdmark-diagram-box"${touchActive}>${renderTools(frame)}<div class="mdmark-diagram-viewport" tabindex="0" role="group" aria-roledescription="図" aria-labelledby="${id}-title" aria-keyshortcuts="${VIEWPORT_KEYS}"><div class="mdmark-diagram-sizer" style="${sizer}"><div class="mdmark-diagram-stage" style="${stage}">${body.html}</div></div></div>${resize}${body.tips}</div><ul class="mdmark-diagram-legend" aria-label="凡例"${frame.legend.length === 0 ? ' hidden="hidden"' : ""}>${legend}</ul></figure>`;
}

/** 図の種類 */
export type DiagramKind = Exclude<DiagramFrame["kind"], "mermaid" | "map">;

/** 図を描く: 種類ごとの中身を描き、凡例を決めて枠に差す。`hints` がオフ（既定はオン）なら、ER 図のテーブルの説明のツールチップとボタンを配置しない */
export function renderDiagram(options: {
  kind: DiagramKind;
  definition: LegendDefinition;
  /** ツールチップと矢じりの `id` の頭 */
  id: string;
  /** 用語から意味を参照する関数 */
  lookup?: TermLookup;
  /** 機能 `hints` がオンか（既定 `true`） */
  hints?: boolean;
  /** 機能 `diagram-resize` がオンか（既定 `true`） */
  resizable?: boolean;
  zoom?: number;
  fit?: number;
  modal?: boolean;
  /** 指で図を動かす操作中か（ストーリーの状態だけが指定する） */
  touchActive?: boolean;
}): string {
  const {
    kind,
    definition,
    id,
    lookup,
    zoom,
    fit,
    modal,
    touchActive,
    hints = true,
    resizable = true,
  } = options;
  const part =
    kind === "er"
      ? renderEr(definition as MdmarkErDefinition, id, { hints, lookup })
      : renderChart(definition as MdmarkChartDefinition, id);
  return renderDiagramFrame(
    {
      kind,
      title: definition.title,
      scope: definition.scope,
      updated: definition.updated,
      legend: legendFor(definition),
      resizable,
      id,
      ...(zoom === undefined ? {} : { zoom }),
      ...(fit === undefined ? {} : { fit }),
      ...(modal === undefined ? {} : { modal }),
      ...(touchActive === undefined ? {} : { touchActive }),
    },
    part,
  );
}
