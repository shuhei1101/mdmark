import type {
  MdmarkChartDefinition,
  MdmarkDiagramIo,
  MdmarkDiagramKind,
  MdmarkDiagramLine,
  MdmarkDiagramNode,
  MdmarkErCardinality,
  MdmarkErDefinition,
  MdmarkErTable,
  MdmarkErTableKind,
  MdmarkFlowDefinition,
  MdmarkNodeStyle,
  MdmarkSequenceDefinition,
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
import { jumpPaths, polylinePath, ZOOM } from "../diagram/geometry.ts";
import { pointSvg, renderChart, SCATTER_POINT_SIZE } from "./chart.ts";
import { isColorName } from "./colors.ts";
import { erEndSvg, plainDefinitionText, renderErTable } from "./er.ts";
import { escapeHtml } from "./escape.ts";
import { bundledIconNode, type IconName, iconSvg } from "./icons.ts";
import { iconNodeSvg, type MdmarkIconNode } from "./inline-icon.ts";

/** 線の種類ごとの破線・太さ・矢じり・凡例の名前。色は CSS の変数で適用する */
export const LINE_STYLES: Readonly<
  Record<
    MdmarkDiagramLine,
    { dash: string; width: number; head: "filled" | "open"; label: string }
  >
> = {
  flow: { dash: "", width: 1.5, head: "filled", label: "処理の流れ" },
  read: { dash: "6 4", width: 1.5, head: "open", label: "読み込む" },
  write: { dash: "", width: 2.5, head: "filled", label: "書き込む" },
  reply: { dash: "4 3", width: 1.5, head: "open", label: "返却する" },
  loop: { dash: "8 4", width: 1.5, head: "open", label: "戻る（ループ）" },
};

/** ノードの種類ごとの既定の名前（定義の `tag` が無いときに種類の行に出す）・凡例の名前・アイコン */
const KIND_STYLES: Readonly<
  Record<MdmarkDiagramKind, { tag: string; legend: string; icon: IconName }>
> = {
  llm: { tag: "LLM", legend: "LLM", icon: "bot" },
  dm: { tag: "意思決定モデル", legend: "意思決定モデル", icon: "split" },
  script: { tag: "スクリプト", legend: "スクリプト", icon: "code-xml" },
  mcp: { tag: "MCP", legend: "MCP", icon: "plug" },
  data: {
    tag: "データ",
    legend: "データ（下の角が丸いノード）",
    icon: "database",
  },
  external: { tag: "外部", legend: "外部のシステム", icon: "globe" },
  start: { tag: "開始", legend: "開始", icon: "play" },
  question: { tag: "質問", legend: "質問", icon: "circle-question-mark" },
  action: { tag: "アクション", legend: "アクション", icon: "wrench" },
  result: { tag: "結果", legend: "結果", icon: "flag" },
};

/** 開始のノードの直径に対する、名前を配置する内接の正方形の外の余白の割合（`(1 - 1/√2) / 2`） */
const CIRCLE_INSET = 0.1464;

/** 凡例のノードの種類の見本の構造（無い種類は角の丸い四角） */
const KIND_SAMPLES: Partial<Record<MdmarkDiagramKind, string>> = {
  data: '<path d="M1,1 H17 V9 Q17,13 13,13 H5 Q1,13 1,9 Z"></path>',
  start: '<circle cx="9" cy="7" r="6"></circle>',
  question: '<polygon points="9,0.5 17.5,7 9,13.5 0.5,7"></polygon>',
  action: '<rect x="1" y="1" width="16" height="12" rx="1"></rect>',
  result: '<rect x="1" y="1" width="16" height="12" rx="6"></rect>',
};

/** システムの枠を持つ図で、外部のシステムの凡例に添える配置場所 */
const OUTSIDE_FRAME = "（枠の外）";

/** 矢じりの大きさ（px） */
const HEAD_SIZE = 9;

/** シーケンス図の寸法（px）: 相手の列の間隔・左端の中心・相手のノードの幅と高さ・上の余白・メッセージの行の高さ・最初の行の位置・戻りの帯の幅 */
const SEQ = {
  colGap: 180,
  firstX: 92,
  headW: 150,
  headH: 56,
  headTop: 16,
  rowH: 52,
  firstY: 116,
  bandW: 200,
};

/** 図の表示する枠のキー操作 */
const VIEWPORT_KEYS = "+ - 0 ArrowLeft ArrowUp ArrowDown ArrowRight";

/** 数を小数 2 桁までの文字にする */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 凡例の項目 */
export type DiagramLegendItem = {
  /** 見本の種類: ノードの種類・線の種類・`series-{n}`・`frame`・`lane`・`jump`・`info`・`underline` */
  sample: string;
  /** 意味 */
  label: string;
};

/** 図の枠の引数 */
export type DiagramFrame = {
  /** 中の図の種類 */
  kind: "flow" | "sequence" | "chart" | "er" | "mermaid" | "map";
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
  /** 拡大して動かしたときにグループのタイトルを上端に留めるか（既定 `true`） */
  stickyTitles?: boolean;
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

/** `renderFlow`・`renderSequence`・`renderChart` の戻り値: 図の中身と、凡例に記載する図の特徴 */
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
  /** 線の詳細か、ノードの入力・処理・出力か、文だけか（ノードの `hint`・埋め込んだ HTML の `data-hint`） */
  kind: "wire" | "io" | "hint" | "table" | "item";
  /** 持ち主の名前。ツールチップのタイトルに出す */
  label: string;
  /** グラフの項目の値の文（`item` のとき） */
  value?: string;
  /** 線の詳細 */
  tip?: string;
  /** ノードの入力・処理・出力 */
  io?: MdmarkDiagramIo;
  /** ノードの `hint` か `data-hint` の文。`io` と一緒に持つときは入力・処理・出力の後に出す */
  hint?: string;
  /** ER 図のテーブル。タイトルを `{論理名}（{物理名}）` にし、概要と、`desc` を持つ列の名前と説明を並べる */
  table?: MdmarkErTable;
  /** 持ち主を参照する名前（線の `id`・`node:{ノードの id}`・`term:{単語}`）。省くとタイトル */
  owner?: string;
  /** 開いているか */
  open?: boolean;
};

/** 図のツールチップを描く。文だけの `hint` は、行内の要素の後ろにも配置できるよう `span` で出す */
export function renderDiagramTip(tip: DiagramTip): string {
  const hint =
    tip.hint === undefined || tip.hint === ""
      ? ""
      : `<span class="mdmark-term-tip-meaning">${escapeHtml(tip.hint)}</span>`;
  const owner = escapeHtml(tip.owner ?? tip.label);
  const hidden = tip.open ? "" : ' hidden="hidden"';
  if (tip.kind === "hint") {
    return `<span class="mdmark-diagram-tip mdmark-hint-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}><span class="mdmark-term-tip-section">${hint}</span></span>`;
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
    return `<div class="mdmark-diagram-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${escapeHtml(plainDefinitionText(table.label))}（${escapeHtml(plainDefinitionText(table.name))}）</span>${desc}${columns}</span></div>`;
  }
  const body =
    tip.kind === "io" && tip.io
      ? `<dl class="mdmark-diagram-tip-io"><dt>入力</dt><dd>${escapeHtml(tip.io.in)}</dd><dt>処理</dt><dd>${escapeHtml(tip.io.do)}</dd><dt>出力</dt><dd>${escapeHtml(tip.io.out)}</dd></dl>${hint}`
      : `<span class="mdmark-term-tip-meaning">${escapeHtml((tip.kind === "item" ? tip.value : tip.tip) ?? "")}</span>`;
  return `<div class="mdmark-diagram-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${escapeHtml(tip.label)}</span>${body}</span></div>`;
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

/** 線の種類ごとの矢じりの `marker` */
function markerDefs(id: string): string {
  return (Object.keys(LINE_STYLES) as MdmarkDiagramLine[])
    .map((line) => {
      const shape =
        LINE_STYLES[line].head === "filled"
          ? '<path d="M0,0 L9,4.5 L0,9 z"></path>'
          : '<path d="M1,1 L8,4.5 L1,8"></path>';
      return `<marker id="${id}-head-${line}" class="mdmark-diagram-arrowhead" data-line="${line}" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="${HEAD_SIZE}" markerHeight="${HEAD_SIZE}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker>`;
    })
    .join("");
}

/** 線の見える線と、`tip` を持つ線のツールチップを取得する透明の太い線 */
function renderWire(options: {
  id: string;
  wireId: string;
  line: MdmarkDiagramLine;
  d: string;
  hit: boolean;
  custom?: MdmarkWireStyle | undefined;
  index?: number;
}): string {
  const { id, wireId, line, d, hit, custom } = options;
  if (custom !== undefined) {
    return renderStyledWire({ ...options, custom, index: options.index ?? 0 });
  }
  const style = LINE_STYLES[line];
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
  const visible = `<path class="mdmark-diagram-wire" data-line="${line}" data-wire="${escapeHtml(wireId)}" d="${d}"${dash} stroke-width="${style.width}" marker-end="url(#${id}-head-${line})"></path>`;
  const target = hit
    ? `<path class="mdmark-diagram-wire-hit" data-tip-owner="${escapeHtml(wireId)}" d="${d}"></path>`
    : "";
  return visible + target;
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

/** 設定の線の種類で描く線。矢じりは線ごとに線と同じ色の marker を持つ */
function renderStyledWire(options: {
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
  line: MdmarkDiagramLine;
  label: string | undefined;
  tip: string | undefined;
  at: [number, number];
  tips: TipList;
}): string {
  const { wireId, line, label, tip, at, tips } = options;
  if (label === undefined || label === "") {
    return "";
  }
  const style = boxStyle({ x: at[0], y: at[1] });
  if (tip === undefined || tip === "") {
    return `<span class="mdmark-diagram-label" data-line="${line}" data-wire="${escapeHtml(wireId)}"${style}>${escapeHtml(label)}</span>`;
  }
  const id = tips.add({ kind: "wire", label, tip, owner: wireId });
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

/** 名前を構造に内接する四角に配置する余白の `style`。質問は菱形の中央の四角、開始は円に内接する正方形 */
function nodeInset(
  kind: MdmarkDiagramKind,
  box: { w: number; h: number },
): string {
  if (kind === "question") {
    return `;padding:${num(box.h / 4)}px ${num(box.w / 4)}px`;
  }
  if (kind === "start") {
    return `;padding:${Number((box.w * CIRCLE_INSET).toFixed(1))}px`;
  }
  return "";
}

/** 質問のノードの、ノードの幅と高さを `viewBox` にした菱形の svg */
function diamondSvg(box: { w: number; h: number }): string {
  const w = num(box.w);
  const h = num(box.h);
  const points = `${num(box.w / 2)},0 ${w},${num(box.h / 2)} ${num(box.w / 2)},${h} 0,${num(box.h / 2)}`;
  return `<svg class="mdmark-diagram-node-shape" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polygon points="${points}"></polygon></svg>`;
}

/** ノード 1 つ（種類の行・名前・補足と、`hint` か `io` を持つノードの右上のマーカー）の HTML。`hints` がオフならマーカーを配置しない */
function renderNode(options: {
  node: Pick<
    MdmarkDiagramNode,
    "id" | "kind" | "name" | "tag" | "sub" | "io" | "hint" | "href" | "style"
  >;
  box: { x: number; y: number; w: number; h: number };
  tips: TipList;
  lookup: TermLookup | undefined;
  found: { terms: boolean };
  hints: boolean;
}): string {
  const { node, box, tips, lookup, found, hints } = options;
  const kind = KIND_STYLES[node.kind];
  const tag = renderText(node.tag ?? kind.tag, tips, lookup, found);
  const name = renderText(node.name, tips, lookup, found);
  const sub =
    node.sub === undefined
      ? ""
      : `<span class="mdmark-diagram-node-sub">${renderText(node.sub, tips, lookup, found)}</span>`;
  const hasTip = hints && (node.io !== undefined || node.hint !== undefined);
  let info = "";
  if (hasTip) {
    const owner = `node:${node.id}`;
    const id = tips.add({
      kind: node.io ? "io" : "hint",
      label: node.name,
      ...(node.io ? { io: node.io } : {}),
      ...(node.hint === undefined ? {} : { hint: node.hint }),
      owner,
    });
    const what = node.io ? "入力・処理・出力" : "説明";
    info = `<button class="mdmark-diagram-info" type="button" aria-label="「${escapeHtml(node.name)}」の${what}" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
  }
  // リンク先を持つノード: ノードの全体を覆うリンクを配置し、右上のマーカーはリンクの後ろ（リンクの外）に配置する
  const link =
    node.href === undefined
      ? ""
      : `<a class="mdmark-diagram-node-link" href="${escapeHtml(node.href)}" aria-label="${escapeHtml(node.name)}"></a>`;
  const classes = `mdmark-diagram-node${hasTip ? " has-tip" : ""}${node.href === undefined ? "" : " has-link"}`;
  if (node.style !== undefined) {
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
  return `<div class="${classes}" data-kind="${node.kind}" data-node="${escapeHtml(node.id)}"${boxStyle({ ...box, inset: nodeInset(node.kind, box) })}>${node.kind === "question" ? diamondSvg(box) : ""}<span class="mdmark-diagram-node-kind">${iconSvg(kind.icon)}<span>${tag}</span></span><span class="mdmark-diagram-node-name">${name}</span>${sub}${link}${info}</div>`;
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

/** `hint` を持つシステムの枠・層のタイトルの右のマーカー（`hint` が無ければ空） */
function groupInfo(options: {
  hint: string | undefined;
  label: string;
  owner: string;
  tips: TipList;
}): string {
  const { hint, label, owner, tips } = options;
  if (hint === undefined || hint === "") {
    return "";
  }
  const id = tips.add({ kind: "hint", label, hint, owner });
  return `<button class="mdmark-diagram-info mdmark-diagram-group-info" type="button" aria-label="「${escapeHtml(label)}」の説明" aria-describedby="${id}" data-tip-owner="${escapeHtml(owner)}">${iconSvg("info")}</button>`;
}

/** フロー図を描く */
export function renderFlow(
  definition: MdmarkFlowDefinition,
  id: string,
  hints: boolean,
  lookup?: TermLookup,
): DiagramPart {
  const tips = createTips(id);
  const found = { terms: false };
  const parts: string[] = [];
  const { frame } = definition;
  if (frame) {
    parts.push(`<div class="mdmark-diagram-frame"${boxStyle(frame)}></div>`);
    for (const lane of definition.lanes ?? []) {
      parts.push(
        `<div class="mdmark-diagram-lane" data-kind="${lane.kind}"${boxStyle({ x: frame.x + 1.5, y: lane.y, w: frame.w - 3, h: lane.h })}></div>`,
        `<span class="mdmark-diagram-lane-label" data-sticky-top="${num(lane.y)}" data-sticky-bottom="${num(lane.y + lane.h)}"${boxStyle({ x: frame.x + 12, y: lane.y + 6 })}>${escapeHtml(lane.label)}${groupInfo({ hint: hints ? lane.hint : undefined, label: lane.label, owner: `lane:${lane.label}`, tips })}</span>`,
      );
    }
    parts.push(
      `<span class="mdmark-diagram-frame-title" data-sticky-top="${num(frame.y)}" data-sticky-bottom="${num(frame.y + frame.h)}"${boxStyle({ x: frame.x + 12, y: frame.y + 8 })}>${iconSvg("server")}${escapeHtml(frame.title)}${groupInfo({ hint: hints ? frame.hint : undefined, label: frame.title, owner: "frame", tips })}</span>`,
    );
  }
  const paths = jumpPaths(definition.wires);
  const wires = definition.wires
    .map((wire, index) =>
      renderWire({
        id,
        wireId: wire.id,
        line: wire.line,
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
    parts.push(renderNode({ node, box: node, tips, lookup, found, hints }));
  }
  for (const wire of definition.wires) {
    parts.push(
      renderLabel({
        wireId: wire.id,
        line: wire.line,
        label: wire.label,
        tip: hints ? wire.tip : undefined,
        at: wire.labelAt ?? labelPosition(wire.points),
        tips,
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

/** シーケンス図を描く */
export function renderSequence(
  definition: MdmarkSequenceDefinition,
  id: string,
  lookup?: TermLookup,
  hints = true,
): DiagramPart {
  const tips = createTips(id);
  const found = { terms: false };
  const column = new Map(
    definition.participants.map((participant, index) => [
      participant.id,
      SEQ.firstX + index * SEQ.colGap,
    ]),
  );
  const lastX = SEQ.firstX + (definition.participants.length - 1) * SEQ.colGap;
  const rowY = (index: number): number => SEQ.firstY + index * SEQ.rowH;
  const lastY = rowY(definition.steps.length - 1);
  const width = lastX + SEQ.headW / 2 + SEQ.bandW;
  const height = lastY + SEQ.rowH + 24;
  const bandX = lastX + SEQ.headW / 2 + 40;
  const svg: string[] = [];
  const labels: string[] = [];
  const first = definition.steps[0];
  const last = definition.steps.at(-1);
  // 繰り返しの範囲の面と、右の帯を通って最初の受け手の縦線へ戻る線
  if (definition.loop && first && last) {
    const backY = rowY(0) - 27;
    svg.push(
      `<rect class="mdmark-diagram-loop-band" x="12" y="${num(rowY(0) - 30)}" width="${num(bandX)}" height="${num(lastY - rowY(0) + 48)}" rx="8"></rect>`,
    );
    const points: Array<[number, number]> = [
      [column.get(last.to) ?? 0, lastY + 14],
      [bandX, lastY + 14],
      [bandX, backY],
      [(column.get(first.to) ?? 0) + 2, backY],
    ];
    const loopId = `${id}-loop`;
    svg.push(
      renderWire({
        id,
        wireId: loopId,
        line: "loop",
        d: polylinePath(points),
        hit: false,
      }),
    );
    labels.push(
      renderLabel({
        wireId: loopId,
        line: "loop",
        label: definition.loop.label,
        tip: undefined,
        at: [bandX, (lastY + rowY(0)) / 2],
        tips,
      }),
    );
  }
  for (const x of column.values()) {
    svg.push(
      `<line class="mdmark-diagram-lifeline" x1="${num(x)}" y1="${SEQ.headTop + SEQ.headH}" x2="${num(x)}" y2="${num(height - 12)}"></line>`,
    );
  }
  definition.steps.forEach((step, index) => {
    const x1 = column.get(step.from) ?? 0;
    const x2 = column.get(step.to) ?? 0;
    const y = rowY(index);
    const line: MdmarkDiagramLine = step.reply ? "reply" : "flow";
    const wireId = `${id}-step-${index + 1}`;
    // 自分への呼び出しでも矢じりが向きを持つよう、受け手の縦線の手前で止める
    const end = x2 + Math.sign(x1 - x2) * 2;
    const points: Array<[number, number]> = [
      [x1, y],
      [end, y],
    ];
    svg.push(
      renderWire({
        id,
        wireId,
        line,
        d: polylinePath(points),
        hit: hints && step.tip !== undefined && step.tip !== "",
      }),
    );
    labels.push(
      renderLabel({
        wireId,
        line,
        label: `${index + 1} ${step.label}`,
        tip: hints ? step.tip : undefined,
        at: [(x1 + x2) / 2, y - 14],
        tips,
      }),
    );
  });
  const heads = definition.participants
    .map((participant) =>
      renderNode({
        node: participant,
        box: {
          x: (column.get(participant.id) ?? 0) - SEQ.headW / 2,
          y: SEQ.headTop,
          w: SEQ.headW,
          h: SEQ.headH,
        },
        tips,
        lookup,
        found,
        hints,
      }),
    )
    .join("");
  const html = [
    `<svg class="mdmark-diagram-wires" width="${num(width)}" height="${num(height)}" aria-hidden="true">${svg.join("")}</svg>`,
    ...labels,
    // 相手の名前の行: 別の層にし、縦に動かしても表示する枠の上端に留める
    `<div class="mdmark-diagram-seq-heads" style="width:${num(width)}px;height:${SEQ.headTop + SEQ.headH + 8}px">${heads}</div>`,
  ].join("");
  return {
    html,
    width,
    height,
    tips: tips.html(),
    jumps: false,
    terms: found.terms,
  };
}

/** ER 図を描く: テーブルを配置し、関係の線と両端の多重度の記号を svg に描き、ラベルを縦の線の中ほどに配置する */
export function renderEr(
  definition: MdmarkErDefinition,
  id: string,
  hints: boolean,
  lookup?: TermLookup,
): DiagramPart {
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
type LegendDefinition =
  | MdmarkFlowDefinition
  | MdmarkSequenceDefinition
  | MdmarkChartDefinition
  | MdmarkErDefinition;

/** ER 図の定義か（`tables` を持つ） */
function isErDefinition(
  definition: LegendDefinition,
): definition is MdmarkErDefinition {
  return "tables" in definition;
}

/** グラフの定義か（フロー図は `wires`、シーケンス図は `participants`、ER 図は `tables` を持つ） */
function isChartDefinition(
  definition: LegendDefinition,
): definition is MdmarkChartDefinition {
  return (
    !("wires" in definition) &&
    !("participants" in definition) &&
    !("tables" in definition)
  );
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

/** 凡例の項目: フロー図とシーケンス図は、図に 2 種類以上あるノード（相手）の種類と線の種類だけを並べ、枠・層・交差・マーカー・下線は記載しない。グラフは系列（円とドーナツは項目）、ER 図はテーブルの種類・列のマーカー・多重度を並べる */
export function legendFor(definition: LegendDefinition): DiagramLegendItem[] {
  if (isErDefinition(definition)) {
    return erLegend(definition);
  }
  if (isChartDefinition(definition)) {
    return chartLegend(definition);
  }
  const isFlow = "wires" in definition;
  const nodes: Array<Pick<MdmarkDiagramNode, "kind">> = isFlow
    ? definition.nodes
    : definition.participants;
  const frame = isFlow ? definition.frame : undefined;
  const kinds = (Object.keys(KIND_STYLES) as MdmarkDiagramKind[]).filter(
    (kind) => nodes.some((node) => node.kind === kind),
  );
  const lines = new Set<MdmarkDiagramLine>(
    isFlow
      ? definition.wires.map((wire) => wire.line)
      : definition.steps.map((step) => (step.reply ? "reply" : "flow")),
  );
  if (!isFlow && definition.loop) {
    lines.add("loop");
  }
  const usedLines = (Object.keys(LINE_STYLES) as MdmarkDiagramLine[]).filter(
    (line) => lines.has(line),
  );
  const items: DiagramLegendItem[] = [];
  if (kinds.length >= 2) {
    for (const kind of kinds) {
      items.push({
        sample: kind,
        label:
          kind === "external" && frame
            ? KIND_STYLES[kind].legend + OUTSIDE_FRAME
            : KIND_STYLES[kind].legend,
      });
    }
  }
  if (usedLines.length >= 2) {
    for (const line of usedLines) {
      items.push({ sample: line, label: LINE_STYLES[line].label });
    }
  }
  return items;
}

/** 凡例の見本（ノードの種類・線・系列・枠・層・交差・マーカー）の svg */
function legendSample(id: string, sample: string): string {
  if (sample === "underline") {
    return "";
  }
  const er = erLegendSample(sample);
  if (er !== undefined) {
    return er;
  }
  if (sample in KIND_STYLES) {
    const shape =
      KIND_SAMPLES[sample as MdmarkDiagramKind] ??
      '<rect x="1" y="1" width="16" height="12" rx="3"></rect>';
    return `<svg class="mdmark-diagram-legend-sample" data-kind="${sample}" width="18" height="14" aria-hidden="true">${shape}</svg>`;
  }
  if (sample in LINE_STYLES) {
    const line = sample as MdmarkDiagramLine;
    const style = LINE_STYLES[line];
    const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
    return `<svg class="mdmark-diagram-legend-sample" width="34" height="12" aria-hidden="true"><path class="mdmark-diagram-wire" data-line="${line}" d="M1,6 H32"${dash} stroke-width="${style.width}" marker-end="url(#${id}-head-${line})"></path></svg>`;
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
  if (sample === "frame") {
    return '<svg class="mdmark-diagram-legend-sample mdmark-diagram-legend-frame" width="18" height="14" aria-hidden="true"><rect x="1" y="1" width="16" height="12" rx="4"></rect></svg>';
  }
  if (sample === "lane") {
    return '<svg class="mdmark-diagram-legend-sample mdmark-diagram-legend-lane" width="18" height="14" aria-hidden="true"><rect x="0" y="0" width="18" height="14" rx="2"></rect></svg>';
  }
  if (sample === "jump") {
    return '<svg class="mdmark-diagram-legend-sample mdmark-diagram-legend-jump" width="34" height="14" aria-hidden="true"><path d="M17,0 V14"></path><path d="M1,9 H11 A6,6 0 0 1 23,9 H33"></path></svg>';
  }
  return `<span class="mdmark-diagram-legend-info">${iconSvg("info")}</span>`;
}

/** 凡例の項目の並び（`ul` の中身）。`id` は線の見本が指す矢じりの `id` の頭 */
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
  const sticky =
    frame.stickyTitles === false ? ' data-sticky-titles="off"' : "";
  const fitMin =
    frame.fitMin === undefined ? "" : ` data-fit-min="${num(frame.fitMin)}"`;
  const meta =
    frame.scope === undefined || frame.updated === undefined
      ? ""
      : `<span class="mdmark-diagram-meta">範囲: ${escapeHtml(frame.scope)}・更新日: <time datetime="${escapeHtml(frame.updated)}">${escapeHtml(frame.updated)}</time></span>`;
  const wide = frame.wide === true ? ' data-wide="true"' : "";
  const touchActive = frame.touchActive === true ? " data-touch-active" : "";
  return `<figure class="mdmark-diagram" data-diagram="${frame.kind}"${sticky}${fitMin}${wide}><figcaption class="mdmark-diagram-head" id="${id}-title"><span class="mdmark-diagram-title">${escapeHtml(frame.title)}</span>${meta}</figcaption><div class="mdmark-diagram-box"${touchActive}>${renderTools(frame)}<div class="mdmark-diagram-viewport" tabindex="0" role="group" aria-roledescription="図" aria-labelledby="${id}-title" aria-keyshortcuts="${VIEWPORT_KEYS}"><div class="mdmark-diagram-sizer" style="${sizer}"><div class="mdmark-diagram-stage" style="${stage}">${body.html}</div></div></div>${resize}${body.tips}</div><ul class="mdmark-diagram-legend" aria-label="凡例"${frame.legend.length === 0 ? ' hidden="hidden"' : ""}>${legend}</ul><svg class="mdmark-diagram-defs" width="0" height="0" aria-hidden="true"><defs>${markerDefs(id)}</defs></svg></figure>`;
}

/** 図の種類 */
export type DiagramKind = Exclude<DiagramFrame["kind"], "mermaid" | "map">;

/** 図を描く: 種類ごとの中身を描き、凡例を決めて枠に差す。`hints` がオフ（既定はオン）なら、線の詳細・ノードの説明と入力・処理・出力のツールチップとマーカーを配置しない */
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
  let part: DiagramPart;
  if (kind === "flow") {
    part = renderFlow(definition as MdmarkFlowDefinition, id, hints, lookup);
  } else if (kind === "sequence") {
    part = renderSequence(
      definition as MdmarkSequenceDefinition,
      id,
      lookup,
      hints,
    );
  } else if (kind === "er") {
    part = renderEr(definition as MdmarkErDefinition, id, hints, lookup);
  } else {
    part = renderChart(definition as MdmarkChartDefinition, id);
  }
  return renderDiagramFrame(
    {
      kind,
      title: definition.title,
      scope: definition.scope,
      updated: definition.updated,
      legend: legendFor(definition),
      resizable,
      ...("stickyTitles" in definition && definition.stickyTitles === false
        ? { stickyTitles: false }
        : {}),
      id,
      ...(zoom === undefined ? {} : { zoom }),
      ...(fit === undefined ? {} : { fit }),
      ...(modal === undefined ? {} : { modal }),
      ...(touchActive === undefined ? {} : { touchActive }),
    },
    part,
  );
}
