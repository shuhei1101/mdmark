import type {
  MdmarkChartDefinition,
  MdmarkChartYAxis,
  MdmarkDiagramIo,
  MdmarkDiagramKind,
  MdmarkDiagramLine,
  MdmarkDiagramNode,
  MdmarkFlowDefinition,
  MdmarkSequenceDefinition,
} from "../diagram/definition.ts";
import {
  jumpPaths,
  niceTicks,
  polylinePath,
  ZOOM,
} from "../diagram/geometry.ts";
import { escapeHtml } from "./escape.ts";
import { type IconName, iconSvg } from "./icons.ts";

/** 線の種類ごとの破線・太さ・矢じり・凡例の名前。色は CSS の変数で当てる */
export const LINE_STYLES: Readonly<
  Record<
    MdmarkDiagramLine,
    { dash: string; width: number; head: "filled" | "open"; label: string }
  >
> = {
  flow: { dash: "", width: 1.5, head: "filled", label: "処理の流れ" },
  read: { dash: "6 4", width: 1.5, head: "open", label: "読む" },
  write: { dash: "", width: 2.5, head: "filled", label: "書く" },
  reply: { dash: "4 3", width: 1.5, head: "open", label: "返す" },
  loop: { dash: "8 4", width: 1.5, head: "open", label: "戻る（ループ）" },
};

/** 箱の種類ごとの既定の名前（定義の `tag` が無いときに種類の行に出す）・凡例の名前・アイコン */
const KIND_STYLES: Readonly<
  Record<MdmarkDiagramKind, { tag: string; legend: string; icon: IconName }>
> = {
  llm: { tag: "LLM", legend: "LLM", icon: "bot" },
  dm: { tag: "意思決定モデル", legend: "意思決定モデル", icon: "split" },
  script: { tag: "スクリプト", legend: "スクリプト", icon: "code-xml" },
  mcp: { tag: "MCP", legend: "MCP", icon: "plug" },
  data: { tag: "データ", legend: "データ（下の角が丸い箱）", icon: "database" },
  external: { tag: "外部", legend: "外部のシステム", icon: "globe" },
};

/** システムの枠を持つ図で、外部のシステムの凡例に添える置き場所 */
const OUTSIDE_FRAME = "（枠の外）";

/** 矢じりの大きさ（px） */
const HEAD_SIZE = 9;

/** シーケンス図の寸法（px）: 相手の列の間隔・左端の中心・相手の箱の幅と高さ・上の余白・メッセージの行の高さ・最初の行の位置・戻りの帯の幅 */
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

/** グラフの寸法（px）: 全体と、描く範囲の上下左右の余白 */
const CHART = {
  width: 640,
  height: 320,
  pad: { top: 36, right: 24, bottom: 56, left: 56 },
};

/** 系列の点の印の大きさ（px）。散布図は点だけで読むので大きくする */
const POINT_SIZE = 4.5;
const SCATTER_POINT_SIZE = 5.5;

/** 円の半径（px）と、扇形の外に置く割合の文字までの距離（px） */
const PIE = { radius: 118, labelGap: 16 };

/** 棒 1 本の幅の上限（px）と、項目の幅に対する棒の幅の割合 */
const BAR = { maxWidth: 28, share: 0.72 };

/** 図の表示する枠のキー操作 */
const VIEWPORT_KEYS = "+ - 0 ArrowLeft ArrowUp ArrowDown ArrowRight";

/** 数を小数 2 桁までの文字にする */
function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** 凡例の項目 */
export type DiagramLegendItem = {
  /** 見本の種類: 箱の種類・線の種類・`series-{n}`・`frame`・`lane`・`jump`・`info`・`underline` */
  sample: string;
  /** 意味 */
  label: string;
};

/** 図の枠の引数 */
export type DiagramFrame = {
  /** 中の図の種類 */
  kind: "flow" | "sequence" | "chart";
  /** 題名 */
  title: string;
  /** 範囲 */
  scope: string;
  /** 更新日 */
  updated: string;
  /** 凡例の項目 */
  legend: DiagramLegendItem[];
  /** 今の倍率 */
  zoom?: number;
  /** 全画面のモーダルの中に描くか */
  modal?: boolean;
  /** ツールチップと矢じりの `id` の頭 */
  id: string;
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

/** `renderFlow`・`renderSequence`・`renderChart` の戻り値: 図の中身と、凡例に載せる図の特徴 */
export type DiagramPart = DiagramBody & {
  /** 横の線が縦の線を飛び越える点があるか */
  jumps: boolean;
  /** 用語の下線を引いた箱の文字があるか */
  terms: boolean;
};

/** 用語から意味を引く関数。意味が無い用語は `undefined` */
export type TermLookup = (word: string) => string | undefined;

/** ツールチップの引数 */
export type DiagramTip = {
  /** ツールチップの `id` */
  id: string;
  /** 線の詳細か、箱の入力・処理・出力か、文だけか（箱の `hint`・埋め込んだ HTML の `data-hint`） */
  kind: "wire" | "io" | "hint";
  /** 持ち主の名前。ツールチップの題に出す */
  label: string;
  /** 線の詳細 */
  tip?: string;
  /** 箱の入力・処理・出力 */
  io?: MdmarkDiagramIo;
  /** 箱の `hint` か `data-hint` の文。`io` と一緒に持つときは入力・処理・出力の後に出す */
  hint?: string;
  /** 持ち主を引く名前（線の `id`・`node:{箱の id}`・`term:{語}`）。省くと題 */
  owner?: string;
  /** 開いているか */
  open?: boolean;
};

/** 図のツールチップを描く。文だけの `hint` は、行内の要素の後ろにも置けるよう `span` で出す */
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
  const body =
    tip.kind === "io" && tip.io
      ? `<dl class="mdmark-diagram-tip-io"><dt>入力</dt><dd>${escapeHtml(tip.io.in)}</dd><dt>処理</dt><dd>${escapeHtml(tip.io.do)}</dd><dt>出力</dt><dd>${escapeHtml(tip.io.out)}</dd></dl>${hint}`
      : `<span class="mdmark-term-tip-meaning">${escapeHtml(tip.tip ?? "")}</span>`;
  return `<div class="mdmark-diagram-tip" id="${escapeHtml(tip.id)}" role="tooltip" data-tip-for="${owner}"${hidden}><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${escapeHtml(tip.label)}</span>${body}</span></div>`;
}

/** 図の中のツールチップを集める入れ物 */
type TipList = {
  /** ツールチップを足して `id` を返す */
  add: (tip: Omit<DiagramTip, "id">) => string;
  /** 足したツールチップの HTML */
  html: () => string;
};

/** `id` の頭から通し番号の `id` を振るツールチップの入れ物を作る */
function createTips(prefix: string): TipList {
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

/** 定義の文字の `{{語}}` を、意味のある用語なら下線とツールチップの持ち主にし、それ以外は語だけにして、文字を逃がして返す */
function renderText(
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
}): string {
  const size =
    box.w === undefined || box.h === undefined
      ? ""
      : `;width:${num(box.w)}px;height:${num(box.h)}px`;
  return ` style="left:${num(box.x)}px;top:${num(box.y)}px${size}"`;
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

/** 線の見える線と、`tip` を持つ線のツールチップを拾う透明の太い線 */
function renderWire(options: {
  id: string;
  wireId: string;
  line: MdmarkDiagramLine;
  d: string;
  hit: boolean;
}): string {
  const { id, wireId, line, d, hit } = options;
  const style = LINE_STYLES[line];
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
  const visible = `<path class="mdmark-diagram-wire" data-line="${line}" data-wire="${escapeHtml(wireId)}" d="${d}"${dash} stroke-width="${style.width}" marker-end="url(#${id}-head-${line})"></path>`;
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
    return `<span class="mdmark-diagram-label" data-line="${line}"${style}>${escapeHtml(label)}</span>`;
  }
  const id = tips.add({ kind: "wire", label, tip, owner: wireId });
  return `<span class="mdmark-diagram-label has-tip" data-line="${line}" tabindex="0" aria-describedby="${id}" data-tip-owner="${escapeHtml(wireId)}"${style}>${escapeHtml(label)}</span>`;
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

/** 箱 1 つ（種類の行・名前・補足と、`hint` か `io` を持つ箱の右上の印）の HTML。`hints` がオフなら印を置かない */
function renderNode(options: {
  node: Pick<
    MdmarkDiagramNode,
    "id" | "kind" | "name" | "tag" | "sub" | "io" | "hint"
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
  return `<div class="mdmark-diagram-node${hasTip ? " has-tip" : ""}" data-kind="${node.kind}" data-node="${escapeHtml(node.id)}"${boxStyle(box)}><span class="mdmark-diagram-node-kind">${iconSvg(kind.icon)}<span>${tag}</span></span><span class="mdmark-diagram-node-name">${name}</span>${sub}${info}</div>`;
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
        `<span class="mdmark-diagram-lane-label"${boxStyle({ x: frame.x + 12, y: lane.y + 6 })}>${escapeHtml(lane.label)}</span>`,
      );
    }
    parts.push(
      `<span class="mdmark-diagram-frame-title"${boxStyle({ x: frame.x + 12, y: frame.y + 8 })}>${iconSvg("server")}${escapeHtml(frame.title)}</span>`,
    );
  }
  const paths = jumpPaths(definition.wires);
  const wires = definition.wires
    .map((wire) =>
      renderWire({
        id,
        wireId: wire.id,
        line: wire.line,
        d: paths.get(wire.id) ?? "",
        hit: hints && wire.tip !== undefined && wire.tip !== "",
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

/** 系列の点の印（1 丸・2 四角・3 三角・4 菱形） */
function pointSvg(
  series: number,
  x: number,
  y: number,
  size: number = POINT_SIZE,
): string {
  if (series === 1) {
    return `<circle class="mdmark-diagram-point" cx="${num(x)}" cy="${num(y)}" r="${size}"></circle>`;
  }
  if (series === 2) {
    return `<rect class="mdmark-diagram-point" x="${num(x - size)}" y="${num(y - size)}" width="${size * 2}" height="${size * 2}"></rect>`;
  }
  if (series === 3) {
    return `<path class="mdmark-diagram-point" d="M${num(x)},${num(y - size - 1)} L${num(x + size + 1)},${num(y + size)} L${num(x - size - 1)},${num(y + size)} z"></path>`;
  }
  return `<path class="mdmark-diagram-point" d="M${num(x)},${num(y - size - 1)} L${num(x + size + 1)},${num(y)} L${num(x)},${num(y + size + 1)} L${num(x - size - 1)},${num(y)} z"></path>`;
}

/** 系列の塗りの模様（1 塗りつぶし・2 斜線・3 点・4 格子）の `pattern`。折れ線の模様と同じ順に、線から面へ移した形。色は CSS が系列の番号で当てる */
function fillPatterns(id: string): string {
  const base =
    '<rect class="mdmark-diagram-pattern-tint" width="8" height="8"></rect>';
  const bodies = [
    '<rect class="mdmark-diagram-pattern-solid" width="8" height="8"></rect>',
    `${base}<path class="mdmark-diagram-pattern-ink" d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6"></path>`,
    `${base}<circle class="mdmark-diagram-pattern-dot" cx="4" cy="4" r="1.8"></circle>`,
    `${base}<path class="mdmark-diagram-pattern-ink-thin" d="M0,0 L8,8 M8,0 L0,8"></path>`,
  ];
  return bodies
    .map(
      (body, index) =>
        `<pattern id="${id}-fill-${index + 1}" data-series="${index + 1}" patternunits="userSpaceOnUse" width="8" height="8">${body}</pattern>`,
    )
    .join("");
}

/** 描く範囲 */
type ChartBox = { left: number; right: number; top: number; bottom: number };

/** 縦の軸の範囲。定義が `min`・`max`・`step` を持つならそのまま、省いていればデータから切る */
function axisOf(
  axis: MdmarkChartYAxis | undefined,
  values: number[],
): { min: number; max: number; step: number } {
  if (
    axis?.min !== undefined &&
    axis.max !== undefined &&
    axis.step !== undefined
  ) {
    return { min: axis.min, max: axis.max, step: axis.step };
  }
  return niceTicks(values);
}

/** 目盛りの値を並べる（刻みの誤差で桁が崩れないよう丸める） */
function ticksOf(axis: { min: number; max: number; step: number }): number[] {
  const values: number[] = [];
  const rows = Math.round((axis.max - axis.min) / axis.step);
  for (let index = 0; index <= rows; index++) {
    values.push(Number((axis.min + index * axis.step).toPrecision(12)));
  }
  return values;
}

/** 縦の軸の補助線・目盛りの値・軸の名前 */
function yAxisSvg(options: {
  axis: { min: number; max: number; step: number };
  label: string;
  yAt: (value: number) => number;
  box: ChartBox;
}): string[] {
  const { axis, label, yAt, box } = options;
  const svg: string[] = [];
  for (const value of ticksOf(axis)) {
    svg.push(
      `<line class="mdmark-diagram-grid" x1="${box.left}" y1="${num(yAt(value))}" x2="${box.right}" y2="${num(yAt(value))}"></line>`,
      `<text class="mdmark-diagram-axis-text" x="${box.left - 8}" y="${num(yAt(value) + 4)}" text-anchor="end">${num(value)}</text>`,
    );
  }
  svg.push(
    `<text class="mdmark-diagram-axis-text" x="${box.left - 8}" y="${box.top - 18}" text-anchor="start">${escapeHtml(label)}</text>`,
  );
  return svg;
}

/** 軸の線と、横の軸の名前（目盛りの下） */
function axisLinesSvg(label: string, box: ChartBox): string[] {
  return [
    `<line class="mdmark-diagram-axis" x1="${box.left}" y1="${box.bottom}" x2="${box.right}" y2="${box.bottom}"></line>`,
    `<line class="mdmark-diagram-axis" x1="${box.left}" y1="${box.top - 8}" x2="${box.left}" y2="${box.bottom}"></line>`,
    `<text class="mdmark-diagram-axis-text" x="${num((box.left + box.right) / 2)}" y="${box.bottom + 44}" text-anchor="middle">${escapeHtml(label)}</text>`,
  ];
}

/** 横の目盛りが項目の名前の軸（折れ線・棒）の目盛りの値 */
function xTicksSvg(
  ticks: string[],
  xAt: (index: number) => number,
  box: ChartBox,
): string[] {
  return ticks.map(
    (tick, index) =>
      `<text class="mdmark-diagram-axis-text" x="${num(xAt(index))}" y="${box.bottom + 20}" text-anchor="middle">${escapeHtml(tick)}</text>`,
  );
}

/** 描いたグラフの中身 */
type ChartBody = { svg: string[]; label: string };

/** 折れ線・棒の入力: 横の目盛りと、系列ごとの点 */
type TickedChart = {
  ticks: string[];
  series: Array<{ name: string; points: number[] }>;
  yAxis: MdmarkChartYAxis | undefined;
  xLabel: string;
};

/** 折れ線: 系列を色と線の模様・点の印の組で引く */
function lineChart(input: TickedChart, box: ChartBox): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const axis = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points),
  );
  const xAt = (index: number): number =>
    box.left + (index * (box.right - box.left)) / Math.max(1, ticks.length - 1);
  const yAt = (value: number): number =>
    box.bottom -
    ((value - axis.min) * (box.bottom - box.top)) / (axis.max - axis.min);
  const svg = [
    ...yAxisSvg({ axis, label: yAxis?.label ?? "", yAt, box }),
    ...xTicksSvg(ticks, xAt, box),
    ...axisLinesSvg(xLabel, box),
  ];
  series.forEach((entry, index) => {
    const n = index + 1;
    const points = entry.points.map((value, position): [number, number] => [
      xAt(position),
      yAt(value),
    ]);
    const path = points.map(([x, y]) => `${num(x)},${num(y)}`).join(" L");
    svg.push(
      `<path class="mdmark-diagram-series" data-series="${n}" d="M${path}"></path>`,
      `<g data-series="${n}">${points.map(([x, y]) => pointSvg(n, x, y)).join("")}</g>`,
    );
  });
  return {
    svg,
    label: series
      .map((entry) => `${entry.name}: ${entry.points.join("・")}`)
      .join("。"),
  };
}

/** 棒: 項目ごとに系列の棒を横に並べ、系列を色と塗りの模様の組で分ける */
function barChart(input: TickedChart, box: ChartBox, id: string): ChartBody {
  const { ticks, series, yAxis, xLabel } = input;
  const axis = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points),
  );
  const band = (box.right - box.left) / ticks.length;
  const xAt = (index: number): number => box.left + band * (index + 0.5);
  const yAt = (value: number): number =>
    box.bottom -
    ((value - axis.min) * (box.bottom - box.top)) / (axis.max - axis.min);
  const barWidth = Math.min(BAR.maxWidth, (band * BAR.share) / series.length);
  const svg = [
    `<defs>${fillPatterns(id)}</defs>`,
    ...yAxisSvg({ axis, label: yAxis?.label ?? "", yAt, box }),
    ...xTicksSvg(ticks, xAt, box),
  ];
  series.forEach((entry, index) => {
    const n = index + 1;
    const bars = entry.points.map((value, position) => {
      const x =
        xAt(position) - (barWidth * series.length) / 2 + barWidth * index;
      const top = Math.min(yAt(value), yAt(0));
      return `<rect class="mdmark-diagram-bar" x="${num(x + 1)}" y="${num(top)}" width="${num(barWidth - 2)}" height="${num(Math.abs(yAt(value) - yAt(0)))}" fill="url(#${id}-fill-${n})"></rect>`;
    });
    svg.push(`<g data-series="${n}">${bars.join("")}</g>`);
  });
  svg.push(...axisLinesSvg(xLabel, box));
  return {
    svg,
    label: series
      .map(
        (entry) =>
          `${entry.name}: ${entry.points.map((value, position) => `${ticks[position]} ${value}`).join("・")}`,
      )
      .join("。"),
  };
}

/** 割合（整数の %）。合計が 100 になるよう最大剰余法で丸める */
function percentsOf(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const exact = values.map((value) => (value / total) * 100);
  const floors = exact.map(Math.floor);
  let rest = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of byRemainder) {
    if (rest <= 0) {
      break;
    }
    floors[index] = (floors[index] ?? 0) + 1;
    rest -= 1;
  }
  return floors;
}

/** 円: 12 時から時計回りに項目の値の割合の角度で扇形を描き、扇形の外に割合を出す。項目の名前と値は凡例が持つ */
function pieChart(
  items: Array<{ name: string; value: number }>,
  unit: string,
  id: string,
): ChartBody {
  const cx = CHART.width / 2;
  const cy = CHART.height / 2;
  const { radius, labelGap } = PIE;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const percents = percentsOf(items.map((item) => item.value));
  const svg: string[] = [`<defs>${fillPatterns(id)}</defs>`];
  const at = (angle: number, distance: number): [number, number] => [
    cx + distance * Math.cos(angle),
    cy + distance * Math.sin(angle),
  ];
  let angle = -Math.PI / 2;
  items.forEach((item, index) => {
    const n = index + 1;
    // 1 項目だけのときの全周は、始点と終点が重なって弧が消えるので、わずかに足りない角にする
    const sweep = Math.min(
      (item.value / total) * Math.PI * 2,
      Math.PI * 2 - 1e-4,
    );
    const [x1, y1] = at(angle, radius);
    const [x2, y2] = at(angle + sweep, radius);
    svg.push(
      `<g data-series="${n}"><path class="mdmark-diagram-slice" d="M${cx},${cy} L${num(x1)},${num(y1)} A${radius},${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${num(x2)},${num(y2)} Z" fill="url(#${id}-fill-${n})"></path></g>`,
    );
    const middle = angle + sweep / 2;
    const [lx, ly] = at(middle, radius + labelGap);
    const anchor =
      Math.abs(Math.cos(middle)) < 0.2
        ? "middle"
        : Math.cos(middle) > 0
          ? "start"
          : "end";
    svg.push(
      `<text class="mdmark-diagram-value-text" x="${num(lx)}" y="${num(ly + 5)}" text-anchor="${anchor}">${percents[index]}%</text>`,
    );
    angle += sweep;
  });
  return {
    svg,
    label: items
      .map(
        (item, index) =>
          `${item.name}: ${item.value}${unit}（${percents[index]}%）`,
      )
      .join("。"),
  };
}

/** 散布図: 横と縦の両方を数値の軸にし、系列の点の印だけを置く（線で結ばない） */
function scatterChart(
  input: {
    series: Array<{ name: string; points: Array<[number, number]> }>;
    xLabel: string;
    yAxis: MdmarkChartYAxis | undefined;
  },
  box: ChartBox,
): ChartBody {
  const { series, xLabel, yAxis } = input;
  const xAxis = niceTicks(
    series.flatMap((entry) => entry.points.map((p) => p[0])),
  );
  const yScale = axisOf(
    yAxis,
    series.flatMap((entry) => entry.points.map((p) => p[1])),
  );
  const xAt = (value: number): number =>
    box.left +
    ((value - xAxis.min) * (box.right - box.left)) / (xAxis.max - xAxis.min);
  const yAt = (value: number): number =>
    box.bottom -
    ((value - yScale.min) * (box.bottom - box.top)) / (yScale.max - yScale.min);
  const svg = yAxisSvg({ axis: yScale, label: yAxis?.label ?? "", yAt, box });
  for (const value of ticksOf(xAxis)) {
    svg.push(
      `<line class="mdmark-diagram-grid" x1="${num(xAt(value))}" y1="${box.top}" x2="${num(xAt(value))}" y2="${box.bottom}"></line>`,
      `<text class="mdmark-diagram-axis-text" x="${num(xAt(value))}" y="${box.bottom + 20}" text-anchor="middle">${num(value)}</text>`,
    );
  }
  svg.push(...axisLinesSvg(xLabel, box));
  series.forEach((entry, index) => {
    const n = index + 1;
    svg.push(
      `<g data-series="${n}">${entry.points.map(([x, y]) => pointSvg(n, xAt(x), yAt(y), SCATTER_POINT_SIZE)).join("")}</g>`,
    );
  });
  return {
    svg,
    label: series
      .map(
        (entry) =>
          `${entry.name}: ${entry.points.map(([x, y]) => `(${x}, ${y})`).join("・")}`,
      )
      .join("。"),
  };
}

/** グラフを種類（折れ線・棒・円・散布図）ごとに描く。定義は `readDefinition` が形を確かめたもの。`id` は塗りの模様の `pattern` の `id` の頭 */
export function renderChart(
  definition: MdmarkChartDefinition,
  id: string,
): DiagramPart {
  const { pad } = CHART;
  const box: ChartBox = {
    left: pad.left,
    right: CHART.width - pad.right,
    top: pad.top,
    bottom: CHART.height - pad.bottom,
  };
  const type = definition.type ?? "line";
  const series = definition.series ?? [];
  const xLabel = definition.x?.label ?? "";
  let body: ChartBody;
  if (type === "pie") {
    body = pieChart(definition.items ?? [], definition.unit ?? "", id);
  } else if (type === "scatter") {
    body = scatterChart(
      {
        series: series as Array<{
          name: string;
          points: Array<[number, number]>;
        }>,
        xLabel,
        yAxis: definition.y,
      },
      box,
    );
  } else {
    const input: TickedChart = {
      ticks: definition.x?.ticks ?? [],
      series: series as Array<{ name: string; points: number[] }>,
      yAxis: definition.y,
      xLabel,
    };
    body = type === "bar" ? barChart(input, box, id) : lineChart(input, box);
  }
  const label = `${definition.title}。${body.label}`;
  return {
    html: `<svg class="mdmark-diagram-wires" width="${CHART.width}" height="${CHART.height}" role="img" aria-label="${escapeHtml(label)}">${body.svg.join("")}</svg>`,
    width: CHART.width,
    height: CHART.height,
    tips: "",
    jumps: false,
    terms: false,
  };
}

/** 図の定義 */
type LegendDefinition =
  | MdmarkFlowDefinition
  | MdmarkSequenceDefinition
  | MdmarkChartDefinition;

/** グラフの定義か（フロー図は `wires`、シーケンス図は `participants` を持つ） */
function isChartDefinition(
  definition: LegendDefinition,
): definition is MdmarkChartDefinition {
  return !("wires" in definition) && !("participants" in definition);
}

/** グラフの凡例の項目: 種類ごとの見本（折れ線は線と点、棒と円は塗りの模様、散布図は点の形）に、系列か項目の名前を添える */
function chartLegend(definition: MdmarkChartDefinition): DiagramLegendItem[] {
  const type = definition.type ?? "line";
  if (type === "pie") {
    const unit = definition.unit ?? "";
    return (definition.items ?? []).map((item, index) => ({
      sample: `fill-${index + 1}`,
      label: `${item.name}（${item.value}${unit}）`,
    }));
  }
  const sample =
    type === "bar" ? "fill" : type === "scatter" ? "point" : "series";
  return (definition.series ?? []).map((series, index) => ({
    sample: `${sample}-${index + 1}`,
    label: series.name,
  }));
}

/** 凡例の項目: 定義に出る箱の種類・線の種類・系列だけを並べ、図にあるときだけ枠・層・交差・印・下線を加える。`hints` がオフ（既定はオン）なら、ヒントの印と線の詳細の下線は図にない */
export function legendFor(
  definition: LegendDefinition,
  drawn: { jumps: boolean; terms: boolean; hints?: boolean },
): DiagramLegendItem[] {
  if (isChartDefinition(definition)) {
    return chartLegend(definition);
  }
  const hints = drawn.hints !== false;
  const isFlow = "wires" in definition;
  const nodes: Array<Pick<MdmarkDiagramNode, "kind" | "io" | "hint">> = isFlow
    ? definition.nodes
    : definition.participants;
  const frame = isFlow ? definition.frame : undefined;
  const items: DiagramLegendItem[] = [];
  for (const kind of Object.keys(KIND_STYLES) as MdmarkDiagramKind[]) {
    if (nodes.some((node) => node.kind === kind)) {
      items.push({
        sample: kind,
        label:
          kind === "external" && frame
            ? KIND_STYLES[kind].legend + OUTSIDE_FRAME
            : KIND_STYLES[kind].legend,
      });
    }
  }
  if (frame) {
    items.push(
      { sample: "frame", label: "システムの枠" },
      { sample: "lane", label: "層の背景（層の箱の色）" },
    );
  }
  const lines = new Set<MdmarkDiagramLine>(
    isFlow
      ? definition.wires.map((wire) => wire.line)
      : definition.steps.map((step) => (step.reply ? "reply" : "flow")),
  );
  if (!isFlow && definition.loop) {
    lines.add("loop");
  }
  for (const line of Object.keys(LINE_STYLES) as MdmarkDiagramLine[]) {
    if (lines.has(line)) {
      items.push({ sample: line, label: LINE_STYLES[line].label });
    }
  }
  if (drawn.jumps) {
    items.push({ sample: "jump", label: "線の交差（横の線が飛び越える）" });
  }
  if (hints && nodes.some((node) => node.io || node.hint)) {
    const io = nodes.some((node) => node.io);
    const hint = nodes.some((node) => node.hint && !node.io);
    items.push({
      sample: "info",
      label:
        io && hint
          ? "説明や入力・処理・出力が出る箱"
          : io
            ? "入力・処理・出力が出る箱"
            : "説明が出る箱",
    });
  }
  // 下線: 箱の中の用語（意味が出る）と、線のラベル（送るものの詳細が出る）を 1 項目にまとめる
  const hasTip =
    hints &&
    (isFlow
      ? definition.wires.some((wire) => wire.tip)
      : definition.steps.some((step) => step.tip));
  if (drawn.terms || hasTip) {
    const what =
      drawn.terms && hasTip
        ? "用語の意味・送るものの詳細が出る"
        : drawn.terms
          ? "用語の意味が出る"
          : "送るものの詳細が出る";
    items.push({ sample: "underline", label: `下線（${what}）` });
  }
  return items;
}

/** 凡例の見本（箱の種類・線・系列・枠・層・交差・印）の svg */
function legendSample(id: string, sample: string): string {
  if (sample === "underline") {
    return "";
  }
  if (sample in KIND_STYLES) {
    const shape =
      sample === "data"
        ? '<path d="M1,1 H17 V9 Q17,13 13,13 H5 Q1,13 1,9 Z"></path>'
        : '<rect x="1" y="1" width="16" height="12" rx="3"></rect>';
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

/** 右上のボタンの帯（移動・拡大と縮小・全画面）。モーダルの中では全画面のボタンの代わりに閉じるボタンを置く */
function renderTools(frame: DiagramFrame): string {
  const zoom = frame.zoom ?? 1;
  const tool = (
    name: string,
    label: string,
    icon: IconName,
    disabled = false,
  ): string =>
    `<button class="mdmark-diagram-tool" type="button" data-tool="${name}" aria-label="${label}"${disabled ? ' disabled="disabled"' : ""}>${iconSvg(icon)}</button>`;
  const pan = [
    tool("left", "左へ動かす", "chevron-left"),
    tool("up", "上へ動かす", "chevron-up"),
    tool("down", "下へ動かす", "chevron-down"),
    tool("right", "右へ動かす", "chevron-right"),
  ].join("");
  const screen = frame.modal
    ? tool("close", "全画面を閉じる", "x")
    : tool("fullscreen", "全画面で開く", "expand");
  const percent = `${Math.round(zoom * 100)}%`;
  const zoomButton = `<button class="mdmark-diagram-tool mdmark-diagram-zoom" type="button" data-tool="fit" aria-label="倍率 ${percent}。全体が収まる倍率に戻す">${percent}</button>`;
  return `<div class="mdmark-diagram-tools" role="toolbar" aria-label="「${escapeHtml(frame.title)}」の表示"><div class="mdmark-diagram-tools-group" data-group="pan"${zoom > 1 ? "" : ' hidden="hidden"'}>${pan}</div><div class="mdmark-diagram-tools-group" data-group="zoom">${tool("out", "縮小", "minus", zoom <= 1)}${zoomButton}${tool("in", "拡大", "plus", zoom >= ZOOM.max)}</div><div class="mdmark-diagram-tools-group" data-group="screen">${screen}</div></div>`;
}

/** 図の枠を描く: 題・ボタンの帯・表示する枠・ツールチップの中身・凡例を並べる */
export function renderDiagramFrame(
  frame: DiagramFrame,
  body: DiagramBody,
): string {
  const id = escapeHtml(frame.id);
  const zoom = frame.zoom ?? 1;
  const sizer = `width:${num(body.width * zoom)}px;height:${num(body.height * zoom)}px`;
  const stage = `width:${num(body.width)}px;height:${num(body.height)}px${zoom === 1 ? "" : `;transform:scale(${num(zoom)})`}`;
  const legend = renderLegendItems(id, frame.legend);
  return `<figure class="mdmark-diagram" data-diagram="${frame.kind}"><figcaption class="mdmark-diagram-head" id="${id}-title"><span class="mdmark-diagram-title">${escapeHtml(frame.title)}</span><span class="mdmark-diagram-meta">範囲: ${escapeHtml(frame.scope)}・更新日: <time datetime="${escapeHtml(frame.updated)}">${escapeHtml(frame.updated)}</time></span></figcaption><div class="mdmark-diagram-box">${renderTools(frame)}<div class="mdmark-diagram-viewport" tabindex="0" role="group" aria-roledescription="図" aria-labelledby="${id}-title" aria-keyshortcuts="${VIEWPORT_KEYS}"><div class="mdmark-diagram-sizer" style="${sizer}"><div class="mdmark-diagram-stage" style="${stage}">${body.html}</div></div></div>${body.tips}</div><ul class="mdmark-diagram-legend" aria-label="凡例">${legend}</ul><svg class="mdmark-diagram-defs" width="0" height="0" aria-hidden="true"><defs>${markerDefs(id)}</defs></svg></figure>`;
}

/** 図の種類 */
export type DiagramKind = DiagramFrame["kind"];

/** 図を描く: 種類ごとの中身を描き、凡例を決めて枠に差す。`hints` がオフ（既定はオン）なら、線の詳細・箱の説明と入力・処理・出力のツールチップと印を置かない */
export function renderDiagram(options: {
  kind: DiagramKind;
  definition: LegendDefinition;
  /** ツールチップと矢じりの `id` の頭 */
  id: string;
  /** 用語から意味を引く関数 */
  lookup?: TermLookup;
  /** 機能 `hints` がオンか（既定 `true`） */
  hints?: boolean;
  zoom?: number;
  modal?: boolean;
}): string {
  const { kind, definition, id, lookup, zoom, modal, hints = true } = options;
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
  } else {
    part = renderChart(definition as MdmarkChartDefinition, id);
  }
  return renderDiagramFrame(
    {
      kind,
      title: definition.title,
      scope: definition.scope,
      updated: definition.updated,
      legend: legendFor(definition, { ...part, hints }),
      id,
      ...(zoom === undefined ? {} : { zoom }),
      ...(modal === undefined ? {} : { modal }),
    },
    part,
  );
}
