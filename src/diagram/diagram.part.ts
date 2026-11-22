import { noteOwnerId } from "../footnote/footnote.part.ts";
import { isColorName } from "../shared/colors.logic.ts";
import { escapeHtml } from "../shared/escape.logic.ts";
import { iconNodeSvg, type MdmarkIconNode } from "../shared/icon-node.logic.ts";
import {
  bundledIconNode,
  type IconName,
  iconSvg,
} from "../shared/icons.part.ts";
import { pointSvg, renderChart, SCATTER_POINT_SIZE } from "./chart.part.ts";
import type {
  MdmarkChartDefinition,
  MdmarkChartSeries,
  MdmarkDiagramNode,
  MdmarkFlowDefinition,
  MdmarkNodeStyle,
  MdmarkWireStyle,
} from "./definition.ts";
import { jumpPaths, RESIZE, ZOOM } from "./geometry.ts";

/** 矢じりの大きさ（px） */
const HEAD_SIZE = 9;

/** 開閉のボタンのスクリーンリーダー向けの名前（畳んだとき） */
export const PANEL_OPEN_LABEL = "表示の操作を開く";

/** 開閉のボタンのスクリーンリーダー向けの名前（開いたとき） */
export const PANEL_CLOSE_LABEL = "表示の操作を閉じる";

// 倍率を比べるときの誤差
const ZOOM_EPSILON = 0.001;

/** 図の表示する枠のキー操作 */
const VIEWPORT_KEYS = "+ - 0 ArrowLeft ArrowUp ArrowDown ArrowRight";

/** 数を小数 2 桁までの文字にする */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 凡例の項目 */
export type DiagramLegendItem = {
  /** 見本の種類: `series-{n}`・`fill-{n}`・`point-{n}`・`bubble`・`info`・`underline` */
  sample: string;
  /** 意味 */
  label: string;
};

/** 図の枠の引数 */
export type DiagramFrame = {
  /** 中の図の種類 */
  kind: "chart" | "mermaid" | "map";
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
  /** 右上のパネルを開いた状態で描くか（パネルに `data-open` を付ける。ストーリーの状態だけが指定する） */
  panelOpen?: boolean;
  /** 右上のパネルの先頭に並べるボタン（map の図）。`name` は `MAP_TOOL_ICONS` のキー */
  tools?: Array<{ name: string; label: string; disabled?: boolean }>;
  /** 全画面のボタンの隣に書き出すボタンを配置するか（map の図） */
  exportable?: boolean;
  /** 書き出すボタンの「SVG」「PNG」の要素を開いた状態で描くか（ストーリーの状態だけが指定する） */
  exportOpen?: boolean;
  /** パネルの map のグループの先頭に一覧の表示のボタンを配置するか（map の構成図の部品の上に描く図とシーケンス図） */
  listable?: boolean;
  /** 表示する枠の中を図から一覧に替えた状態で描くか（一覧は呼び出し側が入れる） */
  listView?: boolean;
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

/** `renderFlow`・`renderChart` の戻り値: 図の中身と、凡例に記載する図の特徴 */
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
  /** 線の詳細か、文だけか（ノード・グループの説明・埋め込んだ HTML の `data-hint`）か、グラフの項目か */
  kind: "wire" | "hint" | "item";
  /** 持ち主の名前。ツールチップのタイトルに出す */
  label: string;
  /** グラフの項目の値の文（`item` のとき） */
  value?: string;
  /** 線の詳細 */
  tip?: string;
  /** ノード・グループの説明か `data-hint` の文 */
  hint?: string;
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

/** 説明・注記のツールチップ。説明を持たず注記だけを持つ持ち主は、説明の区分を出さない */
function renderHintTip(
  tip: DiagramTip,
  parts: { owner: string; hidden: string; notes: string },
): string {
  const { owner, hidden, notes } = parts;
  const hint =
    tip.hint === undefined || tip.hint === ""
      ? ""
      : `<span class="mdmark-term-tip-meaning">${escapeHtml(tip.hint)}</span>`;
  const described =
    hint === "" && notes !== ""
      ? ""
      : `<span class="mdmark-term-tip-section">${hint}</span>`;
  return `<span class="mdmark-diagram-tip mdmark-hint-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}>${described}${notes}</span>`;
}

/** 図のツールチップを描く。文だけの `hint` は、行内の要素の後ろにも配置できるよう `span` で出す */
export function renderDiagramTip(tip: DiagramTip): string {
  const owner = escapeHtml(tip.owner ?? tip.label);
  const hidden = tip.open ? "" : ' hidden="hidden"';
  const notes = annotationSections(tip.annotations);
  const parts = { owner, hidden, notes };
  if (tip.kind === "hint") {
    return renderHintTip(tip, parts);
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
  context: {
    tips: TipList;
    lookup: TermLookup | undefined;
    found: { terms: boolean };
  },
): string {
  const { tips, lookup, found } = context;
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

/** Mermaid で指定した CSS の色のうち、属性と CSS 変数に入れてよい文字（色の名前・`#`・`rgb()` など）だけを返却する */
export const safeCssColor = (value: string | undefined): string | undefined =>
  value !== undefined && /^[#\w(),.%\s-]+$/.test(value)
    ? value.trim()
    : undefined;

/** 線の端の丸・×の `marker` */
function endMarker(options: {
  markerId: string;
  end: "circle" | "cross";
  color: string;
}): string {
  const { markerId, end, color } = options;
  const shape =
    end === "circle"
      ? `<circle cx="4.5" cy="4.5" r="3.5" fill="var(--mdmark-color-bg)" stroke="${color}" stroke-width="1.5"></circle>`
      : `<path d="M1.5,1.5 L7.5,7.5 M7.5,1.5 L1.5,7.5" fill="none" stroke="${color}" stroke-width="1.5"></path>`;
  return `<marker id="${markerId}" class="mdmark-diagram-arrowhead" data-end="${end}" viewBox="0 0 9 9" refX="4.5" refY="4.5" markerWidth="${HEAD_SIZE}" markerHeight="${HEAD_SIZE}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker>`;
}

/** 線の端の丸・×の `marker` と、線に付ける端の属性 */
function wireEnds(options: {
  markerId: string;
  ends: NonNullable<MdmarkWireStyle["ends"]>;
  color: string;
}): { defs: string; ends: string } {
  const { markerId, ends, color } = options;
  const markers: string[] = [];
  let attributes = "";
  for (const side of ["from", "to"] as const) {
    const end = ends[side];
    if (end === undefined) continue;
    const id = `${markerId}-${side}-${end}`;
    markers.push(endMarker({ markerId: id, end, color }));
    attributes += ` marker-${side === "to" ? "end" : "start"}="url(#${id})"`;
  }
  return { defs: `<defs>${markers.join("")}</defs>`, ends: attributes };
}

/** 線の矢じりの `marker` と、線に付ける端の属性（矢じりが無ければ空） */
function wireHead(options: {
  markerId: string;
  head: NonNullable<MdmarkWireStyle["head"]>;
  color: string;
  both: boolean | undefined;
}): { defs: string; ends: string } {
  const { markerId, head, color, both } = options;
  if (head === "none") {
    return { defs: "", ends: "" };
  }
  const shape =
    head === "filled"
      ? `<path d="M0,0 L9,4.5 L0,9 z" fill="${color}"></path>`
      : `<path d="M1,1 L8,4.5 L1,8" fill="none" stroke="${color}" stroke-width="1.5"></path>`;
  return {
    defs: `<defs><marker id="${markerId}" class="mdmark-diagram-arrowhead" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="${HEAD_SIZE}" markerHeight="${HEAD_SIZE}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker></defs>`,
    ends: ` marker-end="url(#${markerId})"${both ? ` marker-start="url(#${markerId})"` : ""}`,
  };
}

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
  const stroke = safeCssColor(custom.stroke);
  const color = stroke ?? wireColor(custom.color);
  const dash = MAP_DASHES[custom.dash ?? "solid"];
  const width = MAP_WIDTHS[custom.width ?? "normal"];
  const markerId = `${id}-head-map-${index}`;
  const { defs, ends } =
    custom.ends !== undefined && Object.keys(custom.ends).length > 0
      ? wireEnds({ markerId, ends: custom.ends, color })
      : wireHead({
          markerId,
          head: custom.head ?? "filled",
          color,
          both: custom.both,
        });
  const strokeStyle =
    stroke === undefined ? `stroke:${color}` : `stroke: ${escapeHtml(stroke)}`;
  const visible = `${defs}<path class="mdmark-diagram-wire" data-line="map" data-wire="${escapeHtml(wireId)}" d="${d}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-width="${width}" style="${strokeStyle}"${ends}></path>`;
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
  /** Mermaid の `linkStyle` の `color` */
  text?: string | undefined;
  /** 線の横に置くラベルか */
  beside?: boolean | undefined;
}): string {
  const { wireId, label, tip, at, tips, annotations } = options;
  const line = "map";
  const beside = options.beside ? " data-beside" : "";
  if (label === undefined || label === "") {
    return "";
  }
  const text = safeCssColor(options.text);
  const style = boxStyle({
    x: at[0],
    y: at[1],
    ...(text === undefined ? {} : { inset: `;color: ${escapeHtml(text)}` }),
  });
  if (tip === undefined || tip === "") {
    return `<span class="mdmark-diagram-label" data-line="${line}"${beside} data-wire="${escapeHtml(wireId)}"${style}>${escapeHtml(label)}</span>`;
  }
  const id = tips.add({
    kind: "wire",
    label,
    tip,
    owner: wireId,
    annotations,
  });
  return `<span class="mdmark-diagram-label has-tip" data-line="${line}"${beside} data-wire="${escapeHtml(wireId)}" tabindex="0" aria-describedby="${id}" data-tip-owner="${escapeHtml(wireId)}"${style}>${escapeHtml(label)}</span>`;
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

/** 説明か注記を持つノードの、右上のマーカー（ツールチップを追加する）。持たないか `hints` がオフなら空 */
function nodeInfo(options: {
  node: MdmarkDiagramNode;
  tips: TipList;
  hints: boolean;
  annotations?: DiagramAnnotations | undefined;
}): string {
  const { node, tips, hints, annotations } = options;
  const described = node.hint !== undefined && node.hint !== "";
  const notes = annotations?.items[node.id];
  const annotated = (notes?.length ?? 0) > 0;
  if (!hints || !(described || annotated)) {
    return "";
  }
  const owner = `node:${node.id}`;
  const id = tips.add({
    kind: "hint",
    label: node.name,
    hint: node.hint,
    owner,
    annotations: notes,
  });
  const label = infoLabel({ name: node.name, described, annotated });
  return `<button class="mdmark-diagram-info" type="button"${ownerIdAttribute(annotations, node.id)} aria-label="${escapeHtml(label)}" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
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
  const { node, box, tips, lookup, found } = options;
  const context = { tips, lookup, found };
  const name = renderText(node.name, context);
  const sub =
    node.sub === undefined
      ? ""
      : `<span class="mdmark-diagram-node-sub">${renderText(node.sub, context)}</span>`;
  const info = nodeInfo(options);
  // リンク先を持つノード: ノードの全体を覆うリンクを配置し、右上のマーカーはリンクの後ろ（リンクの外）に配置する
  const link =
    node.href === undefined
      ? ""
      : `<a class="mdmark-diagram-node-link" href="${escapeHtml(node.href)}" aria-label="${escapeHtml(node.name)}"></a>`;
  const classes = `mdmark-diagram-node${info === "" ? "" : " has-tip"}${node.href === undefined ? "" : " has-link"}`;
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

/** 種類の行のアイコン。まとめたアイコンはその場で描き、まとめていないアイコンは読み込む場所を配置する */
function kindIcon(icon: string | undefined): string {
  if (icon === undefined) {
    return "";
  }
  const bundled = bundledIconNode(icon);
  return bundled
    ? iconNodeSvg(bundled as unknown as MdmarkIconNode)
    : `<span class="mdmark-map-icon" data-icon="${escapeHtml(icon)}" aria-hidden="true"></span>`;
}

/** 種類の色の `data-color` と、枠線と種類の行の色（`--map-kind`）。色の名前の一覧に無い値は当てない */
function kindColor(color: string | undefined): { data: string; tint: string } {
  if (color === undefined || !isColorName(color)) {
    return { data: "", tint: "" };
  }
  return {
    data: ` data-color="${color}"`,
    tint: `;--map-kind:var(--mdmark-color-accent-${color}-text)`,
  };
}

/** Mermaid の `style`・`classDef` の面・枠線・文字の色の CSS 変数（`--map-node-fill`・`--map-node-stroke`・`--map-node-text`） */
function mermaidColors(style: MdmarkNodeStyle): string {
  const entries: Array<[string, string | undefined]> = [
    ["--map-node-fill", safeCssColor(style.fill)],
    ["--map-node-stroke", safeCssColor(style.stroke)],
    ["--map-node-text", safeCssColor(style.text)],
  ];
  return entries
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => `;${name}: ${escapeHtml(value)}`)
    .join("");
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
  const icon = kindIcon(style.icon);
  const label =
    style.label === undefined ? "" : `<span>${escapeHtml(style.label)}</span>`;
  const empty = icon === "" && label === "" ? " is-empty" : "";
  const color = kindColor(style.color);
  const painted = mermaidColors(style);
  return `<div class="${classes} map-kinded" data-kind="map" data-shape="${style.shape ?? "rounded"}"${color.data} data-node="${escapeHtml(node.id)}"${boxStyle({ ...box, inset: color.tint + painted })}><span class="mdmark-diagram-node-kind${empty}">${icon}${label}</span><span class="mdmark-diagram-node-name">${name}</span>${sub}${link}${info}</div>`;
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
    /** 線の SVG の後、ノードの前に置く HTML（データの印の層） */
    underNodes?: string;
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
  if (options.underNodes !== undefined) parts.push(options.underNodes);
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
        text: wire.style.text,
        beside: wire.beside,
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

/** 図の定義 */
type LegendDefinition = MdmarkChartDefinition;

/** 系列を塗りの模様の見本で示すグラフの種類 */
const FILL_LEGEND_TYPES: readonly string[] = [
  "bar",
  "stacked-bar",
  "stacked-area",
  "horizontal-bar",
  "bubble",
];

/** 複合グラフの系列の凡例。`y2` があれば、どちらの軸かを添える */
function comboLegendItem(
  definition: MdmarkChartDefinition,
  series: MdmarkChartSeries,
  n: number,
): DiagramLegendItem {
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

/** 系列の凡例の見本の種類（塗り・点・線） */
function seriesSample(
  type: NonNullable<MdmarkChartDefinition["type"]>,
): string {
  if (FILL_LEGEND_TYPES.includes(type)) {
    return "fill";
  }
  return type === "scatter" ? "point" : "series";
}

/** 円グラフ・ドーナツの項目の凡例 */
function pieLegend(
  definition: MdmarkChartDefinition,
  donut: boolean,
): DiagramLegendItem[] {
  const unit = definition.unit ?? "";
  return (definition.items ?? []).map((item, index) => ({
    sample: `fill-${index + 1}`,
    label: donut
      ? `${item.name}: ${item.value}${unit}`
      : `${item.name}（${item.value}${unit}）`,
  }));
}

/** グラフの凡例の項目: 種類ごとの見本（折れ線・面・レーダーは線と点、棒・積み上げ・横棒・円・バブルは塗りの模様、散布図は点の形状）に、系列か項目の名前を添える */
function chartLegend(definition: MdmarkChartDefinition): DiagramLegendItem[] {
  const type = definition.type ?? "line";
  if (type === "pie" || type === "donut") {
    return pieLegend(definition, type === "donut");
  }
  const items = (definition.series ?? []).map((series, index) =>
    type === "combo"
      ? comboLegendItem(definition, series, index + 1)
      : { sample: `${seriesSample(type)}-${index + 1}`, label: series.name },
  );
  if (type === "bubble") {
    items.push({
      sample: "bubble",
      label: `円の面積: ${definition.size?.label ?? ""}`,
    });
  }
  return items;
}

/** 凡例の項目: グラフは系列（円とドーナツは項目）を並べる */
export function legendFor(definition: LegendDefinition): DiagramLegendItem[] {
  return chartLegend(definition);
}

/** 凡例の見本（系列・マーカー）の svg */
function legendSample(id: string, sample: string): string {
  if (sample === "underline") {
    return "";
  }
  if (sample.startsWith("fill-")) {
    const n = Number(sample.slice("fill-".length));
    return `<svg class="mdmark-diagram-legend-sample" width="18" height="14" aria-hidden="true"><g data-series="${n}"><rect class="mdmark-diagram-bar" x="1" y="1" width="16" height="12" fill="url(#${id}-fill-${n})"></rect></g></svg>`;
  }
  if (sample.startsWith("point-")) {
    const n = Number(sample.slice("point-".length));
    return `<svg class="mdmark-diagram-legend-sample" width="14" height="14" aria-hidden="true"><g data-series="${n}">${pointSvg(n, [7, 7], SCATTER_POINT_SIZE)}</g></svg>`;
  }
  if (sample.startsWith("series-")) {
    const n = Number(sample.slice("series-".length));
    return `<svg class="mdmark-diagram-legend-sample" width="34" height="12" aria-hidden="true"><path class="mdmark-diagram-series" data-series="${n}" d="M1,6 H33"></path><g data-series="${n}">${pointSvg(n, [17, 6])}</g></svg>`;
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

/** 右上に重ねるパネル（map のボタン・縮小と倍率と拡大・全画面・開閉のボタン）。モーダルの中では全画面のボタンの代わりに閉じるボタンを配置する */
function renderTools(frame: DiagramFrame): string {
  const zoom = frame.zoom ?? 1;
  const fit = frame.fit ?? 1;
  const tool = (
    name: string,
    face: { label: string; icon: IconName },
    disabled = false,
  ): string =>
    `<button class="mdmark-diagram-tool" type="button" data-tool="${name}" aria-label="${face.label}"${disabled ? ' disabled="disabled"' : ""}>${iconSvg(face.icon)}</button>`;
  const list = frame.listable
    ? `<button class="mdmark-diagram-tool" type="button" data-tool="list" aria-label="一覧で表示" title="一覧で表示" aria-pressed="${frame.listView === true}">${iconSvg("list-tree")}</button>`
    : "";
  const tools = frame.tools ?? [];
  const extra =
    tools.length === 0 && list === ""
      ? ""
      : `<div class="mdmark-diagram-tools-group" data-group="map">${list}${tools
          .map(
            (item) =>
              `<button class="mdmark-diagram-tool" type="button" data-tool="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.label)}" title="${escapeHtml(item.label)}"${item.disabled ? ' disabled="disabled"' : ""}>${iconSvg(MAP_TOOL_ICONS[item.name] ?? "ellipsis")}</button>`,
          )
          .join("")}</div>`;
  const screen = `${frame.modal ? tool("close", { label: "全画面を閉じる", icon: "x" }) : tool("fullscreen", { label: "全画面で開く", icon: "expand" })}${exportButton(frame)}`;
  const percent = `${Math.round((zoom / fit) * 100)}%`;
  const zoomButton = `<button class="mdmark-diagram-tool mdmark-diagram-zoom" type="button" data-tool="fit" aria-label="倍率 ${percent}。全体が収まる倍率に戻す">${percent}</button>`;
  const open = frame.panelOpen === true;
  const more = `<button class="mdmark-diagram-tool" type="button" data-tool="more" aria-expanded="${open}" aria-label="${open ? PANEL_CLOSE_LABEL : PANEL_OPEN_LABEL}">${iconSvg("ellipsis")}</button>`;
  const atMin = zoom <= fit * ZOOM.minRatio + ZOOM_EPSILON;
  const atMax = zoom >= fit * ZOOM.maxRatio - ZOOM_EPSILON;
  return `<div class="mdmark-diagram-tools" role="toolbar" aria-label="「${escapeHtml(frame.title)}」の表示"${open ? " data-open" : ""}>${extra}<div class="mdmark-diagram-tools-group" data-group="zoom">${tool("out", { label: "縮小", icon: "minus" }, atMin)}${zoomButton}${tool("in", { label: "拡大", icon: "plus" }, atMax)}</div><div class="mdmark-diagram-tools-group" data-group="screen">${screen}</div><div class="mdmark-diagram-tools-group" data-group="more">${more}</div></div>`;
}

/** 書き出すボタンが開く要素の `id` */
const exportPanelId = (frame: DiagramFrame): string =>
  `${escapeHtml(frame.id)}-export`;

/** 全画面のボタンの隣の書き出すボタン（書き出せない図は空） */
function exportButton(frame: DiagramFrame): string {
  if (frame.exportable !== true) return "";
  return `<button class="mdmark-diagram-tool" type="button" data-tool="export" aria-label="図を書き出す" title="図を書き出す" aria-expanded="${frame.exportOpen === true}" aria-controls="${exportPanelId(frame)}">${iconSvg("download")}</button>`;
}

/** 書き出すボタンが開く「SVG」「PNG」の要素（書き出せない図は空） */
function exportPanel(frame: DiagramFrame): string {
  if (frame.exportable !== true) return "";
  return `<div class="mdmark-diagram-export" id="${exportPanelId(frame)}"${frame.exportOpen === true ? "" : " hidden"}><button class="mdmark-diagram-export-item" type="button" data-export="svg">SVG</button><button class="mdmark-diagram-export-item" type="button" data-export="png">PNG</button><p class="mdmark-diagram-export-status" role="status"></p></div>`;
}

/** 図の枠の高さを変えるつまみ（変えられないかモーダルの中なら空）。高さの値は `mount` が測って書き換えるまでの初めの値 */
function resizeHandle(frame: DiagramFrame, fitHeight: number): string {
  if (frame.resizable === false || frame.modal === true) return "";
  const height = Math.round(Math.max(RESIZE.min, fitHeight));
  return `<div class="mdmark-diagram-resize" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="「${escapeHtml(frame.title)}」の表示の高さ" aria-keyshortcuts="ArrowUp ArrowDown" aria-valuenow="${height}" aria-valuemin="${RESIZE.min}" aria-valuemax="${height}" aria-valuetext="${height}px" title="ドラッグか ↑ ↓ で高さを変える。ダブルクリックで図の全体が収まる高さにする">${iconSvg("equal")}</div>`;
}

/** タイトルの横の範囲と更新日（どちらかが無ければ空） */
function frameMeta(frame: DiagramFrame): string {
  return frame.scope === undefined || frame.updated === undefined
    ? ""
    : `<span class="mdmark-diagram-meta">範囲: ${escapeHtml(frame.scope)}・更新日: <time datetime="${escapeHtml(frame.updated)}">${escapeHtml(frame.updated)}</time></span>`;
}

/** 図の枠の印の属性（収める最小の高さ・広げるか） */
function frameAttributes(frame: DiagramFrame): string {
  const fitMin =
    frame.fitMin === undefined ? "" : ` data-fit-min="${num(frame.fitMin)}"`;
  const wide = frame.wide === true ? ' data-wide="true"' : "";
  return `${fitMin}${wide}`;
}

/** 図の枠を描く: タイトル・表示するノード（パネルと表示する枠）・ツールチップの中身・凡例を並べる */
export function renderDiagramFrame(
  frame: DiagramFrame,
  body: DiagramBody,
): string {
  const id = escapeHtml(frame.id);
  const zoom = frame.zoom ?? 1;
  const sizer = `width:${num(body.width * zoom)}px;height:${num(body.height * zoom)}px`;
  const stage = `width:${num(body.width)}px;height:${num(body.height)}px${zoom === 1 ? "" : `;transform:scale(${num(zoom)})`}`;
  const legend = renderLegendItems(id, frame.legend);
  const atFit = zoom <= (frame.fit ?? 1) + ZOOM_EPSILON ? " data-at-fit" : "";
  return `<figure class="mdmark-diagram" data-diagram="${frame.kind}"${frameAttributes(frame)}><figcaption class="mdmark-diagram-head" id="${id}-title"><span class="mdmark-diagram-title">${escapeHtml(frame.title)}</span>${frameMeta(frame)}</figcaption><div class="mdmark-diagram-box">${renderTools(frame)}${exportPanel(frame)}<div class="mdmark-diagram-viewport"${atFit} tabindex="0" role="group" aria-roledescription="図" aria-labelledby="${id}-title" aria-keyshortcuts="${VIEWPORT_KEYS}"><div class="mdmark-diagram-sizer" style="${sizer}"${frame.listView === true ? " hidden" : ""}><div class="mdmark-diagram-stage" style="${stage}">${body.html}</div></div></div>${resizeHandle(frame, body.height * zoom)}${body.tips}</div><ul class="mdmark-diagram-legend" aria-label="凡例"${frame.legend.length === 0 ? ' hidden="hidden"' : ""}>${legend}</ul></figure>`;
}

/** 図の種類 */
export type DiagramKind = Exclude<DiagramFrame["kind"], "mermaid" | "map">;

/** 図を描く: グラフの中身を描き、凡例を決めて枠に差す */
export function renderDiagram(options: {
  kind: DiagramKind;
  definition: LegendDefinition;
  /** ツールチップと矢じりの `id` の頭 */
  id: string;
  /** 機能 `diagram-resize` がオンか（既定 `true`） */
  resizable?: boolean;
  zoom?: number;
  fit?: number;
  modal?: boolean;
  /** 右上のパネルを開いた状態で描くか（ストーリーの状態だけが指定する） */
  panelOpen?: boolean;
}): string {
  const {
    kind,
    definition,
    id,
    zoom,
    fit,
    modal,
    panelOpen,
    resizable = true,
  } = options;
  const part = renderChart(definition, id);
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
      ...(panelOpen === undefined ? {} : { panelOpen }),
    },
    part,
  );
}
