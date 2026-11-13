// map の図のモック: Mermaid と補足を PoC の自動配置で配置し、今のフロー図・シーケンス図の部品（配布物の mount）で描く。
// 入れ子のグループ・中へ入る・開閉・案内・再生は、描いた図の上に足す。実装の mount が描く構造の案

import { mount } from "../../../../../dist/index.js";
import { layoutMap, parseFlowchart, parseSequence } from "./map-layout.js";

/** 自動で進める間隔の既定（秒）。文書ではマーカーの引数 `interval` で指定し、画面からは変えない */
const DEFAULT_AUTOPLAY_SECONDS = 2;
/** データの印の速さ（px/秒）・印どうしの間隔（px）・1 本の線に同時に流す印の数の上限 */
const PACKET_SPEED = 60;
const PACKET_GAP = 100;
const PACKET_MAX = 4;
/** データの印の既定。補足の layout の packet（図全体）と、線の ID ごとの packet で上書きする */
const DEFAULT_PACKET = { color: "line", shape: "dot" };
/** 図を縮める下限（確認ログ: 等倍より縮めない）。24px のボタンを 24px 未満に縮めない */
const MIN_SCALE = 1;
/** 開いたときの表示する枠の高さの上限（px）。読む人はリサイズハンドルで上限なく高くでき、ダブルクリックで図の高さに合わせる */
const MAX_INITIAL_HEIGHT = 560;
/** リサイズハンドルで縮められる表示する枠の高さの下限（px） */
const MIN_FRAME_HEIGHT = 120;
/** 中へ入る・開閉・手順の切り替えで、ノードとグループを前の位置から動かす時間（ms） */
const MOVE_MS = 350;
/** ノードの幅の上限（px）。長い名前は、既定（height）では見積もりの幅のまま折り返して高さを増やし、width ではこの幅まで広げてから折り返す */
const NODE_MAX_WIDTH = { height: 220, width: 360 };
/**
 * 中へ入ったグループ・中だけを見ているブロックを、URL のクエリ文字列にも保つ（sessionStorage に加えて、URL を開き直す・共有しても同じ所から見られる）。
 * キーは `map-{図の番号}`（文書の中の map の図の順。1 から）、値はグループの ID か、シーケンス図のブロックの番号（Mermaid に出てくる順。0 から）。
 * 書き換えは history.replaceState で行い、ページの履歴は増やさない。設定の map.url_state が false のときは読みも書きもしない（使う側のルーターがクエリ文字列を使うページ向け）。
 * まとめた HTML で文書を切り替えたときは、前の文書の map-* のキーを消す（書き出したHTMLの起動が行う）
 */
let urlState = true;
const readQuery = (key) => (urlState ? (new URLSearchParams(location.search).get(key) ?? undefined) : undefined);
const writeQuery = (key, value) => {
  if (!urlState) return;
  const url = new URL(location.href);
  if (value === undefined || value === null || value === "") url.searchParams.delete(key);
  else url.searchParams.set(key, String(value));
  if (url.href !== location.href) history.replaceState(history.state, "", url);
};
/** 開閉と中へ入った状態をタブの中で保つ sessionStorage のキーの頭 */
const STORAGE_PREFIX = "mdmark-map:";

/**
 * ノードの種類と線の種類は mdmark では決めず、使う側が設定（mdmark.config.yaml の map）で作る。
 * kinds: Mermaid のクラス名ごとの { label（ノードの種類の行の名前）, icon（Lucide の名前）, shape, color（色の名前） }
 * lines: Mermaid の矢印（-->・-.->・==>）か名前ごとの { dash, width, head, color }。名前の線は補足の layout の line で指す
 * 種類を書かないノードは種類の行を出さず、設定に無い矢印は既定の実線で描く。凡例は出さない
 */
const SHAPES = ["rounded", "rect", "pill", "double", "start", "end", "choice"];
const DASHES = { solid: "", dashed: "6 4", dotted: "2 4", "dash-dot": "8 3 2 3", "long-dash": "12 5" };
const WIDTHS = { thin: 1, normal: 1.5, thick: 3 };
const ARROWS = { solid: "-->", dotted: "-.->", thick: "==>" };
/** 矢じりの元にする今の部品の marker（塗りは flow、線は read） */
const HEAD_MARKERS = { filled: "flow", open: "read" };

/** 今の図のボタンと同じ Lucide のアイコン */
const ICONS = {
  back: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  expandAll: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  collapseAll: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
  collapse: '<path d="m6 9 6 6 6-6"/>',
  cog: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  expand: '<path d="m9 18 6-6-6-6"/>',
  resize: '<line x1="5" x2="19" y1="9" y2="9"/><line x1="5" x2="19" y1="15" y2="15"/>',
};

/** リサイズハンドルのアイコンを、上下だけに動かせると分かる横の 2 本線にする（今の部品の点の並びを置き換える。実装では図の枠の部品で変える） */
const replaceResizeIcon = (figure) => {
  const handle = figure.querySelector(".mdmark-diagram-resize");
  if (handle) handle.innerHTML = icon("resize");
};

const icon = (name) =>
  `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/** 今の図のツールの見た目のアイコンのボタン。名前はツールチップと読み上げに出す */
const toolButton = (name, label, onClick, attrs = {}) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mdmark-diagram-tool";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon(name);
  for (const [key, value] of Object.entries(attrs)) button.setAttribute(key, value);
  button.addEventListener("click", onClick);
  return button;
};

/** 補足の layout の色（mdmark の色の名前）を、面と文字の CSS 変数にする */
const colorStyle = (color) =>
  color ? `--map-fill: var(--mdmark-color-accent-${color}-bg); --map-ink: var(--mdmark-color-accent-${color}-text);` : "";

/**
 * ノードの種類の行（アイコンと名前）と形・色を、使う側の設定の種類で置き換える。
 * 種類の行は選択と移動の押す場所を兼ねるため、アイコンも名前も無いノードでも高さ 24px の空の行を残す
 */
const applyKind = (element, kind) => {
  const row = element.querySelector(".mdmark-diagram-node-kind");
  const glyph = kind?.icon && ICONS[kind.icon] ? icon(kind.icon) : "";
  if (row) row.innerHTML = `${glyph}${kind?.label ? `<span>${kind.label}</span>` : ""}`;
  row?.classList.toggle("is-empty", !glyph && !kind?.label);
  if (!kind) {
    element.dataset.shape = "rounded";
    return;
  }
  element.dataset.shape = SHAPES.includes(kind.shape) ? kind.shape : "rounded";
  if (kind.color) element.style.setProperty("--map-kind", `var(--mdmark-color-accent-${kind.color}-text)`);
  element.classList.add("map-kinded");
};

/** 線の見た目（破線の模様・太さ・矢じり・色）を、使う側の設定の線の種類で置き換える */
const applyLine = (figure, path, line = {}) => {
  path.dataset.line = "flow";
  path.setAttribute("stroke-dasharray", DASHES[line.dash ?? "solid"] ?? "");
  path.setAttribute("stroke-width", String(WIDTHS[line.width ?? "normal"] ?? 1.5));
  const head = line.head ?? "filled";
  const base = path.getAttribute("marker-end")?.replace(/head-[a-z]+\)/, `head-${HEAD_MARKERS[head] ?? "flow"})`);
  if (head === "none") path.removeAttribute("marker-end");
  else if (base) path.setAttribute("marker-end", base);
  if (line.color) path.style.stroke = `var(--mdmark-color-accent-${line.color}-text)`;
  // 今の部品の線の矢じり（read）は線と別の色を持つため、色を指定しない線でも矢じりを線の色にする
  tintArrowhead(figure, path);
};

/**
 * 強調: 強調する要素の表示は変えず、ほかのノード・線・ラベル・ライフラインを薄くする（線のホバー・案内・再生・参加者の選択で共通）。
 * keep の要素は、案内・再生で薄くした要素でも元の濃さに戻す
 */
const focusOn = (stage, keep) => {
  stage.classList.add("map-focus");
  for (const element of keep) element.classList.add("map-keep");
};
const clearFocus = (stage) => {
  stage.classList.remove("map-focus");
  for (const element of stage.querySelectorAll(".map-keep")) element.classList.remove("map-keep");
};

/**
 * 線の上にデータの印を流す。印は線の長さに応じた数を間をあけて元から先へ繰り返し動かし、両向きの線は先から元へも流す。
 * packet: { color: line（線の色）| source（元のノードの色）| target（先のノードの色）| 色の名前, shape: dot | square | diamond }
 */
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 手順の帯: 番号・説明の文と、前へ・停止・自動で進める（一時停止）・次への 4 つのボタンを常に同じ並びで出す。
 * 前へ・次へは常に押せ、端では反対の端へ回る（始める前の前へは最後へ）。停止は始める前だけ押せない。説明の文の改行はそのまま出す
 */
const stepBand = ({ label, total, index, heading = "", text, auto, names, go, stop, toggleAuto }) => {
  const band = document.createElement("div");
  band.className = "map-band";
  band.setAttribute("role", "region");
  band.setAttribute("aria-label", label);
  const prev = () => go(index === undefined || index === 0 ? total - 1 : index - 1);
  const next = () => go(index === undefined ? 0 : (index + 1) % total);
  // 1 行目は番号（左）・タイトル・操作のボタン（右）、2 行目からが説明の文。文の長さや行数によらずボタンの位置を変えない。文が無いときは 1 行目だけ
  const head = document.createElement("div");
  head.className = "map-band-head";
  const count = document.createElement("span");
  count.className = "map-band-count";
  count.textContent = `${index === undefined ? "–" : index + 1}/${total}`;
  // 手順のタイトル: 番号とボタンの間に出す。狭い幅では 1 行目に入らないため、番号とボタンの下の行に回す
  const title = document.createElement("strong");
  title.className = "map-band-title";
  title.textContent = heading;
  title.hidden = heading === "";
  const body = document.createElement("p");
  body.className = "map-band-text";
  body.textContent = text;
  body.hidden = text === "";
  body.setAttribute("aria-live", "polite");
  const actions = document.createElement("div");
  actions.className = "map-band-actions";
  actions.append(
    toolButton("prev", names.prev, prev),
    toolButton("stop", names.stop, stop, index === undefined ? { disabled: "" } : {}),
    toolButton(auto ? "pause" : "play", auto ? "一時停止" : "自動で進める", toggleAuto, { "aria-pressed": String(auto) }),
    toolButton("next", names.next, next),
  );
  head.append(count, title, actions);
  band.append(head, body);
  band.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") next();
    if (event.key === "ArrowLeft") prev();
  });
  return band;
};

/** 色を変えた線の矢じりを線と同じ色にする: 線が指す矢じりの marker を複製して色を付け、線から指し直す */
let arrowheadCount = 0;
const tintArrowhead = (figure, path) => {
  for (const end of ["marker-start", "marker-end"]) tintMarker(figure, path, end);
};
const tintMarker = (figure, path, end) => {
  const ref = /url\(#([^)]+)\)/.exec(path.getAttribute(end) ?? "")?.[1];
  const marker = ref ? figure.querySelector(`marker[id="${CSS.escape(ref)}"]`) : null;
  if (!marker) return;
  const color = getComputedStyle(path).stroke;
  const copy = marker.cloneNode(true);
  arrowheadCount += 1;
  copy.id = `${ref}-map-${arrowheadCount}`;
  const shape = copy.firstElementChild;
  const filled = shape.getAttribute("d").includes("z");
  shape.style.fill = filled ? color : "none";
  shape.style.stroke = filled ? "none" : color;
  marker.after(copy);
  path.setAttribute(end, `url(#${copy.id})`);
};
const addPackets = (svg, path, { reverse = false, both = false, packet = DEFAULT_PACKET, nodeColor = {} } = {}) => {
  const color =
    packet.color === "line"
      ? getComputedStyle(path).stroke
      : packet.color === "source"
        ? (nodeColor.source ?? getComputedStyle(path).stroke)
        : packet.color === "target"
          ? (nodeColor.target ?? getComputedStyle(path).stroke)
          : `var(--mdmark-color-accent-${packet.color}-text)`;
  const shapeOf = () => {
    if (packet.shape === "square") {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", "-6");
      rect.setAttribute("y", "-6");
      rect.setAttribute("width", "12");
      rect.setAttribute("height", "12");
      rect.setAttribute("rx", "2");
      return rect;
    }
    if (packet.shape === "diamond") {
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", "0,-8 8,0 0,8 -8,0");
      return polygon;
    }
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", "7");
    return circle;
  };
  // 線の長さによらず同じ速さで動かし、長い線ほど印を多く流す
  const length = path.getTotalLength();
  const seconds = Math.max(0.6, length / PACKET_SPEED);
  const count = Math.max(1, Math.min(PACKET_MAX, Math.floor(length / PACKET_GAP)));
  const directions = both ? [reverse, !reverse] : [reverse];
  const added = [];
  for (const backward of directions) {
    for (let index = 0; index < count; index += 1) {
      const shape = shapeOf();
      shape.setAttribute("class", "map-packet");
      shape.style.fill = color;
      const motion = document.createElementNS(SVG_NS, "animateMotion");
      motion.setAttribute("dur", `${seconds}s`);
      motion.setAttribute("begin", `${-(seconds / count) * index}s`);
      motion.setAttribute("repeatCount", "indefinite");
      motion.setAttribute("keyPoints", backward ? "1;0" : "0;1");
      motion.setAttribute("keyTimes", "0;1");
      motion.setAttribute("calcMode", "linear");
      const mpath = document.createElementNS(SVG_NS, "mpath");
      mpath.setAttribute("href", `#${path.id}`);
      motion.append(mpath);
      shape.append(motion);
      svg.append(shape);
      added.push(shape);
    }
  }
  return added;
};

/**
 * map の構成図を 1 つ作る。host の中に描き、操作のたびに描き直す。
 * 描き直しても、文書と図の中のスクロール・表示する枠の高さを保ち、ノードとグループは前の位置から動かす。
 * spec: { id, title, interval, flow, data: { notes, walkthroughs, layout, colors }, sequence?: { title, source } }
 * initial: { enter, collapsed, step, play, auto }
 */
export const createMap = (host, spec, initial = {}) => {
  const chart = parseFlowchart(spec.flow);
  const sequence = spec.sequence ? parseSequence(spec.sequence.source) : undefined;
  const steps = spec.data.walkthroughs ?? [];
  const config = spec.config ?? {};
  const kindOf = (id) => {
    const node = nodeById.get(id);
    const name = node?.classes.find((cls) => config.kinds?.[cls]);
    return name ? config.kinds[name] : undefined;
  };
  /** 線の種類: 補足の layout の line の名前か、Mermaid の矢印の設定 */
  const lineOf = (edgeId, lineKind) => config.lines?.[spec.data.layout?.[edgeId]?.line] ?? config.lines?.[ARROWS[lineKind ?? "solid"]];
  const notes = spec.data.notes ?? {};
  const nodeById = new Map(chart.nodes.map((node) => [node.id, node]));
  const boxById = new Map(chart.boxes.map((box) => [box.id, box]));
  const labelOf = (id) => nodeById.get(id)?.label ?? boxById.get(id)?.title ?? id;
  const storageKey = `${STORAGE_PREFIX}${spec.id}`;
  const queryKey = spec.queryKey ?? `map-${spec.id}`;
  urlState = (spec.config ?? {}).url_state !== false;
  const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
  const state = {
    // 中へ入ったグループは、URL のクエリ文字列 → sessionStorage の順に読む
    enter: initial.enter ?? (boxById.has(readQuery(queryKey) ?? "") ? readQuery(queryKey) : undefined) ?? saved.enter,
    // 補足の layout でグループごとに最初に閉じるかを指定できる（既定は開く）
    collapsed: new Set(
      initial.collapsed ??
        saved.collapsed ??
        Object.entries(spec.data.layout ?? {})
          .filter(([, value]) => value.collapsed)
          .map(([id]) => id),
    ),
    step: initial.step,
    play: initial.play,
    auto: initial.auto ?? false,
    /** シーケンス図の帯で自動で進めているか（構成図の上の再生） */
    playAuto: false,
    /** 自動で進める間に、強調するノードへ図の枠の中をスクロールするか。読者が図の枠を触ると false にする */
    follow: true,
    seconds: spec.interval ?? DEFAULT_AUTOPLAY_SECONDS,
    height: undefined,
    /** 描いて測ったノードの大きさ（配置し直すときの layout の size） */
    sizes: {},
    /** 押して選んだノード。選んだノードとつながる線・相手のノードを残し、ほかを薄くする */
    selected: new Set(),
    /** 読者がドラッグで動かしたノードの位置（親のグループの中身の左上からの座標）と、動かした線の区間（線の ID ごとの点の数と、区間の番号ごとのずらし） */
    positions: saved.positions ?? {},
    wireShifts: saved.wireShifts ?? {},
    dragging: false,
  };
  /** 長い名前のノードの広げ方（設定の map.node_fit）: height（既定。幅は見積もりのまま高さを増やす）・width（上限まで幅を広げてから高さを増やす） */
  const fit = config.node_fit ?? "height";
  const start = { enter: state.enter };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer;

  const save = () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ enter: state.enter, collapsed: [...state.collapsed], positions: state.positions, wireShifts: state.wireShifts }));
    writeQuery(queryKey, state.enter);
  };

  const isUnder = (id, ancestor) => {
    let parent = nodeById.get(id)?.parent ?? boxById.get(id)?.parent;
    while (parent) {
      if (parent === ancestor) return true;
      parent = boxById.get(parent)?.parent;
    }
    return id === ancestor;
  };
  const visibleOf = (id) => [...state.collapsed].find((closed) => isUnder(id, closed)) ?? id;
  /** 表示している 1 本の線にまとまった元の線 */
  const sourcesOf = (edge) => chart.edges.filter((item) => visibleOf(item.from) === edge.from && visibleOf(item.to) === edge.to);

  /**
   * 線のラベルの置き場所: 線の区間の中点を長い順に試し、ほかのラベルとノードに重ならない最初の点に置く。
   * 全て重なるときはラベルを出さず、線にポインターを当てたときのツールチップに出す（モックの置き方。実装は部品設計で決める）
   */
  const placeLabels = (layout) => {
    hiddenLabels.clear();
    const placed = [];
    const blocks = layout.leaves.map((leaf) => ({ x: leaf.x, y: leaf.y, w: leaf.w, h: leaf.h }));
    const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const at = new Map();
    for (const edge of layout.edges) {
      const sources = sourcesOf(edge);
      const label = sources.length === 1 ? sources[0].label : undefined;
      if (!label) continue;
      const width = [...label].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x7e ? 12 : 7), 12);
      const segments = edge.points
        .slice(1)
        .map((point, index) => [edge.points[index], point])
        .sort((a, b) => Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1]) - Math.hypot(a[1][0] - a[0][0], a[1][1] - a[0][1]));
      const candidates = segments.flatMap(([a, b]) => [0.5, 0.3, 0.7].map((t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]));
      const box = ([x, y]) => ({ x: x - width / 2, y: y - 10, w: width, h: 20 });
      const choice = candidates.find((point) => ![...placed, ...blocks].some((other) => hits(box(point), other)));
      if (!choice) {
        hiddenLabels.add(edge.id);
        continue;
      }
      placed.push(box(choice));
      at.set(edge.id, { label, labelAt: choice });
    }
    return at;
  };

  /** PoC の配置を、今のフロー図の部品の定義にする */
  const toFlowDefinition = (layout, labels = placeLabels(layout)) => ({
    title: spec.title,
    scope: state.enter ? `${labelOf(state.enter)}の中` : "全体",
    updated: "2026-11-09",
    width: layout.width,
    height: layout.height,
    nodes: layout.leaves.map((leaf) => {
      const node = nodeById.get(leaf.id);
      const box = boxById.get(leaf.id);
      const kind = "script";
      const note = notes[leaf.id];
      return {
        id: leaf.id,
        kind,
        ...(box ? { tag: "グループ" } : {}),
        x: leaf.x,
        y: leaf.y,
        w: leaf.w,
        h: leaf.h,
        name: box ? box.title : leaf.lines.join(""),
        ...(note ? { hint: note } : {}),
      };
    }),
    wires: layout.edges.map((edge) => {
      // まとめた線は本数もラベルも出さず、元の線はポインターを当てたときのツールチップに出す
      const label = labels.get(edge.id);
      const source = chart.edges.find((item) => item.id === edge.id);
      return {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        line: "flow",
        points: edge.points,
        ...(label ?? {}),
      };
    }),
  });

  /** 置き場所が無くて出さなかった線のラベル */
  const hiddenLabels = new Set();
  /** 線のツールチップの文: 補足の notes に説明を持つ元の線だけを「元 → 先：説明」で並べる。ラベルを出さなかった線は先頭にラベル。説明が無ければ空 */
  const wireTip = (edge) => {
    const label = hiddenLabels.has(edge.id) ? sourcesOf(edge)[0]?.label : undefined;
    const body = wireNotes(edge);
    return [label, body].filter(Boolean).join("\n");
  };
  const wireNotes = (edge) => {
    const lines = sourcesOf(edge).filter((item) => notes[item.id]);
    if (lines.length === 1 && sourcesOf(edge).length === 1) return notes[lines[0].id];
    return lines.map((item) => `${labelOf(item.from)} → ${labelOf(item.to)}：${notes[item.id]}`).join("\n");
  };

  /** ノードの選択: 選んだノードだけを残し、1 つならそのノードの線、2 つ以上なら選んだノードどうしの線を残す（線の相手のノードは薄くする。シーケンス図の参加者と同じ） */
  const selection = (layout) => {
    if (state.selected.size === 0) return undefined;
    // 種類に固有の選び方（ER 図の経路）。無ければ構成図の選び方
    const custom = spec.selectionOf?.(state.selected, layout);
    if (custom) return custom;
    const edges = layout.edges.filter((edge) =>
      state.selected.size === 1 ? state.selected.has(edge.from) || state.selected.has(edge.to) : state.selected.has(edge.from) && state.selected.has(edge.to),
    );
    return { nodes: new Set(state.selected), edges: new Set(edges.map((edge) => edge.id)) };
  };

  const highlighted = () => {
    if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      return new Set([visibleOf(message.from), visibleOf(message.to)]);
    }
    if (state.step !== undefined) return new Set((steps[state.step].highlight ?? []).map(visibleOf));
    return undefined;
  };

  /** 描き直す前のノードとグループの位置（中身の座標） */
  const positionsOf = () => {
    const positions = new Map();
    for (const element of host.querySelectorAll(".mdmark-diagram-stage [data-node], .mdmark-diagram-stage [data-group]")) {
      const key = element.dataset.node ?? element.dataset.group;
      positions.set(key, { x: element.offsetLeft, y: element.offsetTop, w: element.offsetWidth, h: element.offsetHeight });
    }
    return positions;
  };

  const render = () => {
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const before = positionsOf();
    const overrides = { ...(spec.data.layout ?? {}) };
    for (const [id, size] of Object.entries(state.sizes)) overrides[id] = { ...overrides[id], size };
    for (const [id, pos] of Object.entries(state.positions)) overrides[id] = { ...overrides[id], pos };
    const layout = layoutMap(chart, { enter: state.enter, collapsed: [...state.collapsed] }, overrides);
    applyWireShifts(layout);
    host.replaceChildren();
    mount(host, { markdown: `<!-- flow -->\n\n\`\`\`json\n${JSON.stringify(toFlowDefinition(layout))}\n\`\`\`\n\n<!-- /flow -->\n` });
    const figure = host.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    decorateGroups(stage, layout);
    decorateNodes(stage, layout);
    decorateWires(figure, layout);
    spec.afterRender?.(figure, layout, { selected: state.selected, enter: state.enter, collapsed: state.collapsed });
    decorateTools(figure);
    renderBand(figure);
    renderPackets(stage, layout);
    replaceResizeIcon(figure);
    watchTouch(figure);
    keepScaleAndHeight(figure, layout);
    animateFrom(stage, before);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
    // 描いたノードの中身が見積もりの大きさに収まらなければ、測った大きさで配置し直す（大きさが変わらなくなるまで）
    if (measureLeaves(stage, layout)) {
      render();
      return;
    }
    revealHot(viewport, stage, layout);
  };

  /**
   * 動かした線の区間を、線の点に当てる。点の数が変わった線（配置し直して経路が変わった線）のずらしは捨てる。
   * 両端の区間はノードにつながる端をノードの辺に沿って動かす。辺の範囲（辺の端から 8px の内側）を越えて動かしたときは、
   * 越えた側の辺（上・下・左・右）につなぎ替え、線をノードの中央まで延ばしてから直角に曲げてその辺へ入れる（矢じりもその辺に付く）
   */
  const applyWireShifts = (layout) => {
    const rectOf = (id) => layout.leaves.find((leaf) => leaf.id === id);
    for (const edge of layout.edges) {
      // ずらしは、自動配置の点の数と区間の番号に対して記録する
      edge.rawCount = edge.points.length;
      const shift = state.wireShifts[edge.id];
      if (!shift) continue;
      if (shift.count !== edge.points.length) {
        delete state.wireShifts[edge.id];
        continue;
      }
      const last = edge.points.length - 2;
      let before = [];
      let after = [];
      for (const [key, delta] of Object.entries(shift.segments)) {
        const index = Number(key);
        const a = edge.points[index];
        const b = edge.points[index + 1];
        const axis = a[1] === b[1] ? 1 : 0;
        const other = 1 - axis;
        a[axis] += delta;
        b[axis] += delta;
        // 端の点がノードの辺の範囲を越えたら、越えた側の辺につなぎ替える
        const reattach = (point, id, add) => {
          const rect = rectOf(id);
          if (!rect) return;
          const [start, size] = axis === 1 ? [rect.y, rect.h] : [rect.x, rect.w];
          if (point[axis] >= start + 8 && point[axis] <= start + size - 8) return;
          const center = other === 0 ? rect.x + rect.w / 2 : rect.y + rect.h / 2;
          const edgeAt = point[axis] < start + 8 ? start : start + size;
          point[other] = center;
          const enter = [0, 0];
          enter[other] = center;
          enter[axis] = edgeAt;
          add(enter);
        };
        if (index === 0) reattach(a, edge.from, (point) => (before = [point]));
        if (index === last) reattach(b, edge.to, (point) => (after = [point]));
      }
      edge.points.splice(0, 0, ...before);
      edge.points.push(...after);
      normalizeEnds(edge, rectOf);
    }
  };

  /**
   * 線の端のつなぐ辺を、ノードの外にある一番近い折れ点の位置から決め直す（ノードの中に入った折れ点は捨てる）。
   * その折れ点がノードの下（左右の範囲の中）なら下の辺、上なら上の辺、右（上下の範囲の中）なら右の辺、左なら左の辺へ、
   * その折れ点からまっすぐ入れる。真ん中の区間を動かしたときも、線の来る向きに合わせてつなぐ辺が変わる
   */
  const normalizeEnds = (edge, rectOf) => {
    const inside = (rect, [x, y]) => x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h;
    const enter = (rect, [x, y]) => {
      const insideX = x >= rect.x + 8 && x <= rect.x + rect.w - 8;
      const insideY = y >= rect.y + 8 && y <= rect.y + rect.h - 8;
      if (insideX && y >= rect.y + rect.h) return [x, rect.y + rect.h];
      if (insideX && y <= rect.y) return [x, rect.y];
      if (insideY && x >= rect.x + rect.w) return [rect.x + rect.w, y];
      if (insideY && x <= rect.x) return [rect.x, y];
      return undefined;
    };
    const fixEnd = (points, id) => {
      const rect = rectOf(id);
      if (!rect || points.length < 3) return points;
      // 端を除き、ノードの中に入った折れ点を後ろから捨てる
      let body = points.slice(0, -1);
      while (body.length > 1 && inside(rect, body.at(-1))) body = body.slice(0, -1);
      const end = enter(rect, body.at(-1));
      return end ? [...body, end] : points;
    };
    let points = fixEnd(edge.points, edge.to);
    points = fixEnd([...points].reverse(), edge.from).reverse();
    edge.points.splice(0, edge.points.length, ...points);
  };

  /** 今の倍率（図の中身の座標とポインターの座標の比） */
  const scaleOf = (stage) => Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);

  /**
   * ノードとグループのドラッグ: 押したまま動かすと、ノード（グループなら中身ごと）だけをポインターの動いた分だけ動かし、それを含むグループは中身に合わせて右と下へ広がる。
   * 動かし始めに全てのノードとグループの今の位置を固定し、ほかのノードとグループは動かさない。
   * ノードは親のグループの左端・上端より外へは動かさず、ノードや広がったグループとほかの要素の間が 16px より狭くなる位置へも動かさない。4px 動くまでは押した扱い（選択）にする
   */
  // ancestors は内側のグループから外側の順
  const parentOf = (layout, item) => (item.ancestors ?? []).map((id) => layout.boxes.find((box) => box.id === id)).find(Boolean);
  const originOf = (parent) => (parent ? { x: parent.x + 24, y: parent.y + 24 + 36 } : { x: 24, y: 24 });
  const freezeLayout = (layout) => {
    for (const item of [...layout.leaves, ...layout.boxes]) {
      if (state.positions[item.id]) continue;
      const origin = originOf(parentOf(layout, item));
      state.positions[item.id] = { x: item.x - origin.x, y: item.y - origin.y };
    }
  };
  const startNodeDrag = (event, stage, layout, leaf, element) => {
    const startX = event.clientX;
    const startY = event.clientY;
    const scale = scaleOf(stage);
    const parent = parentOf(layout, leaf);
    const origin = originOf(parent);
    const gap = 16;
    const items = [...layout.leaves, ...layout.boxes];
    const overlaps = (rect, others) => others.some((item) => rect.x < item.x + item.w + gap && item.x < rect.x + rect.w + gap && rect.y < item.y + item.h + gap && item.y < rect.y + rect.h + gap);
    const siblingsOf = (container, self) => items.filter((item) => item.id !== self && parentOf(layout, item)?.id === container?.id && !(item.ancestors ?? []).includes(self));
    // ノードの位置で、ノードを含むグループが広がった大きさを内側から順に求め、どの段でもほかの要素と近づきすぎないか確かめる
    const fits = (rect) => {
      if (overlaps(rect, siblingsOf(parent, leaf.id))) return false;
      let inner = rect;
      let box = parent;
      while (box) {
        const grown = { x: box.x, y: box.y, w: Math.max(box.w, inner.x + inner.w + 24 - box.x), h: Math.max(box.h, inner.y + inner.h + 24 - box.y) };
        const outer = parentOf(layout, box);
        if (overlaps(grown, siblingsOf(outer, box.id))) return false;
        inner = grown;
        box = outer;
      }
      return true;
    };
    let moved = false;
    let frame;
    const move = (next) => {
      const dx = (next.clientX - startX) / scale;
      const dy = (next.clientY - startY) / scale;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) freezeLayout(layout);
      moved = true;
      state.dragging = true;
      const x = Math.max(origin.x, leaf.x + dx);
      const y = Math.max(origin.y, leaf.y + dy);
      if (!fits({ x, y, w: leaf.w, h: leaf.h })) return;
      state.positions[leaf.id] = { x: x - origin.x, y: y - origin.y };
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      if (moved) {
        state.dragging = false;
        // ドラッグの後のクリックで選択を切り替えない
        suppressClick = true;
        save();
        render();
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  };
  let suppressClick = false;

  /**
   * 線の区間のドラッグ: どの区間も押したまま、区間と直角の向きへ動かす（横の区間は上下、縦の区間は左右）。
   * 両端の区間は、ノードにつながる端をノードの辺に沿って動かす（applyWireShifts）
   */
  const innerSegment = (edge, point) => {
    let best;
    for (let index = 0; index < edge.points.length - 1; index += 1) {
      const [a, b] = [edge.points[index], edge.points[index + 1]];
      const horizontal = a[1] === b[1];
      const inRange = horizontal ? point[0] >= Math.min(a[0], b[0]) - 4 && point[0] <= Math.max(a[0], b[0]) + 4 : point[1] >= Math.min(a[1], b[1]) - 4 && point[1] <= Math.max(a[1], b[1]) + 4;
      const distance = horizontal ? Math.abs(point[1] - a[1]) : Math.abs(point[0] - a[0]);
      if (inRange && distance <= 10 && (!best || distance < best.distance)) best = { index, horizontal, distance };
    }
    return best;
  };
  const stagePoint = (stage, event) => {
    const rect = stage.getBoundingClientRect();
    const scale = scaleOf(stage);
    return [(event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale];
  };
  const startWireDrag = (event, stage, edge, segment) => {
    event.preventDefault();
    const scale = scaleOf(stage);
    const start = segment.horizontal ? event.clientY : event.clientX;
    const startX = event.clientX;
    const startY = event.clientY;
    const shift = state.wireShifts[edge.id] ?? { count: edge.rawCount ?? edge.points.length, segments: {} };
    const base = shift.segments[segment.index] ?? 0;
    let frame;
    let moved = false;
    const move = (next) => {
      // 4px 動くまでは押した扱い（線を押して両端のノードを選ぶ）
      if (!moved && Math.hypot(next.clientX - startX, next.clientY - startY) < 4) return;
      moved = true;
      state.dragging = true;
      const delta = ((segment.horizontal ? next.clientY : next.clientX) - start) / scale;
      shift.segments[segment.index] = Math.round(base + delta);
      state.wireShifts[edge.id] = shift;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(render);
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      state.dragging = false;
      if (!moved) selectEnds([edge.from, edge.to]);
      save();
      render();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
  };

  /** 線を押したとき: 両端のノードがどちらも選ばれていれば両方を解き、そうでなければ両方を選ぶ（シーケンス図のメッセージの線も同じ） */
  const selectEnds = (ids) => {
    if (ids.every((id) => state.selected.has(id))) for (const id of ids) state.selected.delete(id);
    else for (const id of ids) state.selected.add(id);
  };

  /**
   * ノードの中身（種類の行と名前）が収まる大きさを、同じ CSS の見えない複製で測る。
   * 種類の行は常に左上に置き、名前はその下から折り返す。測った大きさが配置と違えば state.sizes に入れて true を返す
   */
  const measureLeaves = (stage, layout) => {
    let changed = false;
    for (const leaf of layout.leaves) {
      const element = stage.querySelector(`[data-node="${CSS.escape(leaf.id)}"]`);
      if (!element) continue;
      const probe = element.cloneNode(true);
      probe.removeAttribute("data-node");
      probe.style.left = "0px";
      probe.style.top = "0px";
      probe.style.visibility = "hidden";
      probe.style.height = "auto";
      stage.append(probe);
      let width = leaf.w;
      if (fit === "width") {
        probe.style.width = "max-content";
        probe.querySelector(".mdmark-diagram-node-name")?.style.setProperty("white-space", "nowrap");
        width = Math.min(NODE_MAX_WIDTH.width, Math.max(leaf.w, Math.ceil(probe.offsetWidth) + 2));
        probe.querySelector(".mdmark-diagram-node-name")?.style.removeProperty("white-space");
      }
      probe.style.width = `${width}px`;
      const height = Math.ceil(probe.offsetHeight);
      probe.remove();
      if (Math.abs(width - leaf.w) > 1 || Math.abs(height - leaf.h) > 1) {
        state.sizes[leaf.id] = { w: width, h: height };
        changed = true;
      }
    }
    return changed;
  };

  /** 読者が図の枠を触ったか: 枠の中のスクロール・ホイール・押す・キーと、拡大・縮小のボタン */
  const watchTouch = (figure) => {
    const stop = () => {
      state.follow = false;
    };
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    for (const type of ["wheel", "pointerdown", "keydown", "touchstart"]) viewport.addEventListener(type, stop, { passive: true });
    figure.querySelector('.mdmark-diagram-tools [data-group="zoom"]')?.addEventListener("click", stop);
  };

  /**
   * 自動で進めている間だけ、強調するノードの中心へ図の枠の中をスクロールする（文書のスクロールと倍率は変えない）。
   * 読者が図の枠をスクロール・拡大・縮小・押したら、自動で進め直すまでスクロールしない。前へ・次へで進めたときは読者のスクロールの位置のまま
   */
  const revealHot = (viewport, stage, layout) => {
    const hot = highlighted();
    if (!hot) return;
    const auto = state.step !== undefined ? state.auto : state.playAuto;
    if (!auto || !state.follow) return;
    const rects = layout.leaves.filter((leaf) => hot.has(leaf.id));
    if (rects.length === 0) return;
    const left = Math.min(...rects.map((r) => r.x));
    const right = Math.max(...rects.map((r) => r.x + r.w));
    const top = Math.min(...rects.map((r) => r.y));
    const bottom = Math.max(...rects.map((r) => r.y + r.h));
    viewport.scrollTo({
      left: Math.max(0, (left + right) / 2 - viewport.clientWidth / 2),
      top: Math.max(0, (top + bottom) / 2 - viewport.clientHeight / 2),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  /**
   * 倍率は等倍より縮めず（実装では zoom の fitMin に 1 を渡す）、表示する枠の高さは開いたときの高さか、
   * 読む人がリサイズハンドルで変えた高さのまま保つ。操作で図の大きさが変わっても、枠の高さは変えない
   */
  const keepScaleAndHeight = (figure, layout) => {
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const sizer = figure.querySelector(".mdmark-diagram-sizer");
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    state.height ??= Math.min(layout.height * MIN_SCALE + 16, MAX_INITIAL_HEIGHT);
    const enforce = () => {
      const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
      if (scale < MIN_SCALE) {
        stage.style.transform = `scale(${MIN_SCALE})`;
        sizer.style.width = `${layout.width * MIN_SCALE}px`;
        sizer.style.height = `${layout.height * MIN_SCALE}px`;
      }
      // 今の部品は倍率に合わせて高さと高さの上限を書き換えるため、両方を見て戻す
      const height = `${state.height}px`;
      if (viewport.style.height !== height || viewport.style.maxHeight !== height) {
        viewport.style.height = height;
        viewport.style.maxHeight = height;
      }
      syncZoomText(figure, stage);
    };
    const observer = new MutationObserver(enforce);
    observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
    observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
    // リサイズハンドル: 今の部品のハンドルを、上限を持たないハンドルに置き換える。ダブルクリックで図の高さに合わせ、倍率は変えない
    const old = figure.querySelector(".mdmark-diagram-resize");
    if (old) {
      const handle = old.cloneNode(true);
      old.replaceWith(handle);
      const setHeight = (height) => {
        state.height = Math.max(MIN_FRAME_HEIGHT, Math.round(height));
        enforce();
      };
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        const startY = event.clientY;
        const startHeight = state.height;
        const move = (next) => setHeight(startHeight + next.clientY - startY);
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", () => handle.removeEventListener("pointermove", move), { once: true });
      });
      handle.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          setHeight(state.height + (event.key === "ArrowDown" ? 16 : -16));
        }
      });
      handle.addEventListener("dblclick", () => {
        const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
        setHeight(layout.height * scale + 16);
      });
    }
    enforce();
  };

  /** ノードとグループを前の位置から今の位置へ動かし、線は動き終えてから出す */
  const animateFrom = (stage, before) => {
    if (reduced || before.size === 0 || state.dragging) return;
    const wires = stage.querySelector(".mdmark-diagram-wires");
    let moved = false;
    for (const element of stage.querySelectorAll("[data-node], [data-group]")) {
      const old = before.get(element.dataset.node ?? element.dataset.group);
      if (!old) {
        element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOVE_MS, easing: "ease-out" });
        moved = true;
        continue;
      }
      const dx = old.x - element.offsetLeft;
      const dy = old.y - element.offsetTop;
      const sx = old.w / element.offsetWidth;
      const sy = old.h / element.offsetHeight;
      if (dx === 0 && dy === 0 && sx === 1 && sy === 1) continue;
      moved = true;
      element.style.transformOrigin = "0 0";
      element.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }],
        { duration: MOVE_MS, easing: "ease-in-out" },
      );
    }
    // 線は、ノードとグループが動いたときだけ動き終えてから出す（案内・再生の手順を進めるだけのときは線を消さず、強調が途切れない）
    if (moved) wires.animate([{ opacity: 0 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: MOVE_MS * 1.6 });
  };

  /** 入れ子のグループ: 図の線とノードの下に、色の面と、開閉の山形と、タイトルを置く */
  const decorateGroups = (stage, layout) => {
    const wires = stage.querySelector(".mdmark-diagram-wires");
    for (const box of layout.boxes) {
      const title = boxById.get(box.id)?.title ?? box.id;
      const group = document.createElement("div");
      group.className = "map-group";
      group.dataset.group = box.id;
      group.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px;${colorStyle(spec.data.colors?.[box.id])}`;
      const head = document.createElement("div");
      head.className = "map-group-head";
      head.append(
        disclosure(true, title, (event) => {
          // Shift を押しながらだと、このグループと中のグループを全て閉じる
          for (const id of event.shiftKey ? groupsUnder(box.id) : [box.id]) state.collapsed.add(id);
          save();
          render();
        }),
        // 今入っているグループのタイトルは押せない文字にする（それ以上は入れない）
        box.id === state.enter ? plainTitle(title) : groupTitle(title, box.id),
      );
      group.append(head);
      // グループは、タイトルの行（開閉とタイトルのボタンの外）を押したままドラッグして動かす。中のノードとグループは同じ並びのまま一緒に動く。
      // グループの面は今の図と同じく図を動かす（大きなグループが図のほとんどを覆っても、図を動かせる）。今入っているグループと、外の薄いグループは動かさない
      if (box.id !== state.enter && !box.faded) {
        const bar = document.createElement("div");
        bar.className = "map-group-bar";
        bar.title = "ドラッグでグループを動かす";
        group.prepend(bar);
        group.classList.add("map-movable");
        for (const handle of [bar, head]) {
          handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.target.closest("button")) return;
            event.stopPropagation();
            startNodeDrag(event, stage, layout, box, group);
          });
        }
      }
      stage.insertBefore(group, wires);
    }
  };

  /** 開閉の山形: 枠を持たない小さなアイコン。開いているときは下向き、閉じているときは右向き */
  const disclosure = (expanded, title, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-disclosure";
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", `${title}を${expanded ? "閉じる" : "開く"}`);
    button.title = expanded ? "閉じる" : "開く";
    button.innerHTML = icon(expanded ? "collapse" : "expand");
    button.addEventListener("click", onClick);
    return button;
  };

  /** グループのタイトル: 押すとそのグループの中へ入るボタン */
  const groupTitle = (title, id) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-group-title";
    button.textContent = title;
    button.title = "中へ入る";
    button.addEventListener("click", () => enterGroup(id));
    return button;
  };
  const plainTitle = (title) => {
    const span = document.createElement("span");
    span.className = "map-group-title is-current";
    span.textContent = title;
    return span;
  };
  /** グループと、その中の全てのグループの ID */
  const groupsUnder = (id) => chart.boxes.filter((box) => isUnder(box.id, id)).map((box) => box.id);

  /** ノード: 閉じたグループは山形で開く。入ったグループの外は薄くする。案内と再生で強調する */
  const decorateNodes = (stage, layout) => {
    const hot = highlighted();
    const chosen = selection(layout);
    for (const leaf of layout.leaves) {
      const element = stage.querySelector(`[data-node="${CSS.escape(leaf.id)}"]`);
      if (!element) continue;
      if (!boxById.has(leaf.id)) applyKind(element, kindOf(leaf.id));
      // 種類に固有のノードの中身（ER 図の列の行）。開閉は state.collapsed に持つ
      spec.decorateNode?.(element, leaf.id, {
        faded: leaf.faded,
        collapsed: state.collapsed,
        toggle: (id) => {
          if (state.collapsed.has(id)) state.collapsed.delete(id);
          else state.collapsed.add(id);
          delete state.sizes[id];
          save();
          render();
        },
      });
      const color = spec.data.colors?.[leaf.id];
      if (color) {
        element.style.cssText += colorStyle(color);
        element.classList.add("map-colored");
      }
      if (leaf.faded) element.classList.add("map-faded");
      // 選んだノードの強調を、案内・再生の強調より優先する
      if (chosen ? !chosen.nodes.has(leaf.id) : hot && !hot.has(leaf.id)) element.classList.add("map-dim");
      element.classList.add("map-selectable");
      // 選んでいるかは data-selected に持つ（ノードは中に i のボタンを持つため、ボタンの役割は付けない。キーボードでの選び方は部品設計で決める）
      element.toggleAttribute("data-selected", state.selected.has(leaf.id));
      element.title = "名前の外を押すと、このノードとつながる線だけを残す。ドラッグで動かす";
      element.addEventListener("pointerdown", (event) => {
        // 名前の文字の上は、文字を選んでコピーできるよう、ドラッグと選択の対象にしない
        if (event.button !== 0 || event.target.closest("button, .mdmark-diagram-node-name")) return;
        // 図の枠のドラッグ（図を動かす）に渡さない
        event.stopPropagation();
        startNodeDrag(event, stage, layout, leaf, element);
      });
      element.addEventListener("click", (event) => {
        // ノードの中のボタン（i・開閉の山形）と名前の文字を押したとき、ドラッグした後は選ばない
        if (event.target.closest("button, .mdmark-diagram-node-name")) return;
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        if (state.selected.has(leaf.id)) state.selected.delete(leaf.id);
        else state.selected.add(leaf.id);
        render();
      });
      if (boxById.has(leaf.id) && !leaf.faded) {
        element.classList.add("map-closed-group");
        element.append(
          disclosure(false, labelOf(leaf.id), (event) => {
            // Shift を押しながらだと、このグループと中のグループを全て開く
            for (const id of event.shiftKey ? groupsUnder(leaf.id) : [leaf.id]) state.collapsed.delete(id);
            save();
            render();
          }),
        );
      }
    }
  };

  /** 線: 色・強調と、ポインターを当てた線を太くしてツールチップに元の線と説明を出す */
  const decorateWires = (figure, layout) => {
    const hot = highlighted();
    const chosen = selection(layout);
    let hoverPackets = [];
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const svg = figure.querySelector(".mdmark-diagram-wires");
    const box = figure.querySelector(".mdmark-diagram-box");
    const tip = document.createElement("div");
    tip.className = "map-wire-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    box.append(tip);
    // 線のラベルは、ラベルを持つ線の順に並ぶ
    const labelElements = [...stage.querySelectorAll(".mdmark-diagram-label")];
    const labels = placeLabels(layout);
    const labelOfWire = new Map(layout.edges.filter((edge) => labels.has(edge.id)).map((edge, index) => [edge.id, labelElements[index]]));
    for (const edge of layout.edges) {
      const wire = svg.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
      if (!wire) continue;
      const color = spec.data.colors?.[edge.id];
      if (color) wire.style.setProperty("--map-wire", `var(--mdmark-color-accent-${color}-text)`);
      const lineSource = chart.edges.find((item) => item.id === edge.id);
      applyLine(figure, wire.matches("path") ? wire : wire.querySelector("path"), lineOf(edge.id, lineSource?.line));
      // 両向きの線（<-->）は元の側にも矢じりを描く（今の部品の marker は orient="auto-start-reverse" のため、同じ marker を両端に使える）
      const wirePath = wire.matches("path") ? wire : wire.querySelector("path");
      if (sourcesOf(edge).some((item) => item.both)) wirePath.setAttribute("marker-start", wirePath.getAttribute("marker-end"));
      if (color) wire.classList.add("map-colored-wire");
      if (color) tintArrowhead(figure, wire.matches("path") ? wire : wire.querySelector("path"));
      const label = labelOfWire.get(edge.id);
      if (chosen ? !chosen.edges.has(edge.id) : hot && !(hot.has(edge.from) && hot.has(edge.to))) for (const element of [wire, label]) element?.classList.add("map-dim");
      const path = wire.matches("path") ? wire : wire.querySelector("path");
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hit.setAttribute("d", path.getAttribute("d"));
      hit.setAttribute("class", "map-wire-hit");
      const ends = [edge.from, edge.to].map((id) => stage.querySelector(`[data-node="${CSS.escape(id)}"]`)).filter(Boolean);
      hit.addEventListener("pointerenter", () => {
        // 線とつながるノードの表示は変えず、ほかを薄くする。説明が無い線はツールチップを出さない
        focusOn(stage, [wire, labelOfWire.get(edge.id), ...ends].filter(Boolean));
        // ポインターを当てている間は、その線にもデータの印を流す（案内・再生で流している線には重ねない）
        if (!path.id) {
          path.id = `map-hover-${spec.id}-${edge.id}`;
          const packet = { ...DEFAULT_PACKET, ...spec.data.layout?.packet, ...spec.data.layout?.[edge.id]?.packet };
          hoverPackets = addPackets(svg, path, { both: sourcesOf(edge).some((item) => item.both), packet });
        }
        tip.textContent = wireTip(edge);
        tip.hidden = tip.textContent === "";
      });
      hit.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const segment = innerSegment(edge, stagePoint(stage, event));
        if (!segment) return;
        event.stopPropagation();
        startWireDrag(event, stage, edge, segment);
      });
      hit.addEventListener("pointermove", (event) => {
        // 動かせる区間の上では、動かせる向きのポインターにする
        const segment = innerSegment(edge, stagePoint(stage, event));
        hit.style.cursor = segment ? (segment.horizontal ? "ns-resize" : "ew-resize") : "";
        const rect = box.getBoundingClientRect();
        // 図の枠の右端と下端からはみ出さないよう、ポインターの左上へ回す
        const x = event.clientX - rect.left + 12;
        const y = event.clientY - rect.top + 12;
        tip.style.left = `${x + tip.offsetWidth > rect.width ? Math.max(0, x - 24 - tip.offsetWidth) : x}px`;
        tip.style.top = `${y + tip.offsetHeight > rect.height ? Math.max(0, y - 24 - tip.offsetHeight) : y}px`;
      });
      hit.addEventListener("pointerleave", () => {
        clearFocus(stage);
        if (hoverPackets.length) {
          for (const shape of hoverPackets) shape.remove();
          hoverPackets = [];
          path.removeAttribute("id");
        }
        tip.hidden = true;
      });
      svg.append(hit);
    }
  };

  /**
   * 図の右上のツール: 外へ戻る・全て開く・全て閉じるを、今のツールの並びの先頭に常に同じ位置で置く。
   * 全体の図では戻るは押せない状態で出す。図を動かす矢印のボタンは出さない（枠の中のスクロールで動かす）
   */
  const decorateTools = (figure) => {
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    group.append(
      toolButton("back", "グループの外へ戻る", () => leaveGroup(), state.enter ? {} : { disabled: "" }),
      toolButton("expandAll", "全てのグループを開く", () => {
        state.collapsed.clear();
        save();
        render();
      }),
      toolButton("collapseAll", "全てのグループを閉じる", () => {
        for (const box of chart.boxes) if (!state.enter || !isUnder(state.enter, box.id)) state.collapsed.add(box.id);
        state.collapsed.delete(state.enter);
        save();
        render();
      }),
      // ノードを選んだか、ノード・線を動かしたときだけ押せる「配置と選択を元に戻す」（シーケンス図の「元に戻す」と同じアイコン）
      toolButton(
        "reset",
        "配置と選択を元に戻す",
        () => {
          state.selected.clear();
          state.positions = {};
          state.wireShifts = {};
          save();
          render();
        },
        state.selected.size || Object.keys(state.positions).length || Object.keys(state.wireShifts).length ? {} : { disabled: "" },
      ),
    );
    figure.querySelector(".mdmark-diagram-tools").prepend(group);
  };

  /** 図の枠の下の帯: 案内の手順を常に出す（シーケンス図のメッセージは、シーケンス図の下の帯で進める） */
  const renderBand = (figure) => {
    if (steps.length === 0) return;
    const index = state.step;
    figure.querySelector(".mdmark-diagram-box").after(
      stepBand({
        label: `${spec.title}の案内`,
        total: steps.length,
        index,
        heading: index === undefined ? "" : (steps[index].title ?? ""),
        text: index === undefined ? "" : steps[index].text,
        auto: state.auto,
        names: { prev: "前の手順", next: "次の手順", stop: "案内をやめる" },
        go: (next) => applyStep(next),
        stop: () => endWalkthrough(),
        toggleAuto: () => {
          state.auto = !state.auto;
          // 自動で進め始めたら、読者が図を動かすまで、手順ごとに強調するノードへ図の枠の中をスクロールする
          if (state.auto) state.follow = true;
          if (state.auto && index === undefined) applyStep(0);
          else render();
          schedule();
        },
      }),
    );
  };

  /**
   * データの流れ: 再生では今のメッセージの線、案内では強調するノードどうしの線の上に、
   * データの印を元から先へ流し続ける（両向きの線は両方へ）。線の表示は変えない
   */
  const renderPackets = (stage, layout) => {
    const hot = highlighted();
    const chosen = selection(layout);
    if (!hot && !chosen) return;
    const wires = stage.querySelector(".mdmark-diagram-wires");
    const routes = [];
    if (chosen) {
      // 選んだノードの線に流す（案内・再生より優先する）
      for (const edge of layout.edges) if (chosen.edges.has(edge.id)) routes.push({ edge, reverse: false, both: sourcesOf(edge).some((item) => item.both) });
    } else if (state.play !== undefined && sequence) {
      const message = sequence.messages[state.play];
      const from = visibleOf(message.from);
      const to = visibleOf(message.to);
      const edge = layout.edges.find((item) => item.from === from && item.to === to) ?? layout.edges.find((item) => item.from === to && item.to === from);
      if (edge) routes.push({ edge, reverse: edge.from !== from, both: false });
    } else {
      for (const edge of layout.edges) {
        if (hot.has(edge.from) && hot.has(edge.to)) routes.push({ edge, reverse: false, both: sourcesOf(edge).some((item) => item.both) });
      }
    }
    const nodeColorOf = (id) => {
      const element = stage.querySelector(`[data-node="${CSS.escape(id)}"]`);
      return element ? getComputedStyle(element).borderTopColor : undefined;
    };
    routes.forEach(({ edge, reverse, both }, index) => {
      const wire = wires.querySelector(`[data-wire="${CSS.escape(edge.id)}"]`);
      const path = wire.matches("path") ? wire : wire.querySelector("path");
      path.id = `map-packet-${spec.id}-${index}`;
      wire.classList.remove("map-dim");
      // データの流れは読者が次へ・再生を押して始め、停止で止められる動きのため、動きを減らす設定でも流す
      const packet = { ...DEFAULT_PACKET, ...spec.data.layout?.packet, ...spec.data.layout?.[edge.id]?.packet };
      addPackets(wires, path, { reverse, both, packet, nodeColor: { source: nodeColorOf(reverse ? edge.to : edge.from), target: nodeColorOf(reverse ? edge.from : edge.to) } });
    });
  };

  /** 自動で進める: 選んだ間隔ごとに次へ進み、最後の次は最初へ戻って繰り返す */
  const schedule = () => {
    clearInterval(timer);
    if (!state.auto) return;
    timer = setInterval(() => {
      if (steps.length) applyStep(state.step === undefined ? 0 : (state.step + 1) % steps.length);
    }, state.seconds * 1000);
  };

  const enterGroup = (id) => {
    state.enter = id;
    save();
    render();
  };
  const leaveGroup = () => {
    state.enter = boxById.get(state.enter)?.parent;
    save();
    render();
  };
  const applyStep = (index) => {
    // 案内を始めると、シーケンス図のメッセージの強調は解く
    if (state.play !== undefined) {
      state.play = undefined;
      spec.onWalkthrough?.();
    }
    if (state.step === undefined) start.enter = state.enter;
    state.step = index;
    state.enter = steps[index].enter ?? start.enter;
    render();
  };
  const endWalkthrough = () => {
    clearInterval(timer);
    state.auto = false;
    state.step = undefined;
    state.enter = start.enter;
    render();
  };
  /** シーケンス図の帯で進めた今のメッセージを、構成図の上でも強調してデータを流す（undefined で解く） */
  const showMessage = (index, auto = false) => {
    // シーケンス図の帯で自動で進め始めたら、読者が図を動かすまで、メッセージごとに送り手と受け手へスクロールする
    if (auto && !state.playAuto) state.follow = true;
    state.playAuto = auto;
    if (index === undefined) {
      if (state.play === undefined) return;
      state.play = undefined;
      state.enter = start.enter;
    } else {
      if (state.play === undefined) start.enter = state.enter;
      clearInterval(timer);
      state.auto = false;
      state.step = undefined;
      state.play = index;
    }
    render();
  };

  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selected.size) {
      event.stopPropagation();
      state.selected.clear();
      render();
      return;
    }
    if (event.key === "Escape" && state.enter && state.step === undefined && state.play === undefined) {
      event.stopPropagation();
      leaveGroup();
    }
  });

  render();
  schedule();
  return { showMessage };
};

/** 倍率の文字を、下限を当てた後の実際の倍率に合わせる */
const syncZoomText = (root, stage) => {
  const text = root.querySelector('[data-tool="fit"]');
  const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
  const value = `${Math.round(scale * 100)}%`;
  if (text && text.textContent !== value) text.textContent = value;
};

/** シーケンス図の map も構成図と同じく等倍より縮めず、表示する枠の高さを等倍の図の高さにする（実装では zoom の fitMin に 1 を渡す） */
const keepSequenceScale = (host) => {
  const stage = host.querySelector(".mdmark-diagram-stage");
  const sizer = host.querySelector(".mdmark-diagram-sizer");
  const viewport = host.querySelector(".mdmark-diagram-viewport");
  const enforce = () => {
    const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
    const width = stage.offsetWidth;
    const height = stage.offsetHeight;
    if (scale < MIN_SCALE) {
      stage.style.transform = `scale(${MIN_SCALE})`;
      sizer.style.width = `${width * MIN_SCALE}px`;
      sizer.style.height = `${height * MIN_SCALE}px`;
    }
    const frame = `${Math.max(scale, MIN_SCALE) * height + 16}px`;
    if (viewport.style.height !== frame || viewport.style.maxHeight !== frame) {
      viewport.style.height = frame;
      viewport.style.maxHeight = frame;
    }
    syncZoomText(host, stage);
  };
  const observer = new MutationObserver(enforce);
  observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
  observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
  enforce();
};

/**
 * シーケンス図の map: 今のシーケンス図の部品で描き、次を足す。
 * - 右上のツール: 参加者の並び順を元に戻す（並べ替えたときだけ押せる）。参加者は箱をドラッグして並べ替える
 * - 参加者の箱を押すと、その参加者が送る・受けるメッセージとライフラインを強調し、ほかを薄くする（2 人以上なら選んだ参加者のあいだ）
 * - メッセージの線にポインターを当てると線を太くして両端の参加者を強調し、補足の notes に説明があればツールチップに出す
 * - 構成図の上で再生している間は、今のメッセージの線にもデータの印を流す
 * spec: { id, title, source, notes }
 * kinds: 参加者の ID ごとの、使う側の設定の種類（{ label, icon, shape, color }）
 */
/**
 * シーケンス図の行: メッセージの行のほかに、複合フラグメントの見出し（loop・alt と else など）と注記の行を空けて、重ならないようにする。
 * 行は今のシーケンス図の部品の行の高さ（52px）で並ぶ。見出しと注記の行は、部品には空のメッセージとして渡し、描いた後に隠す
 */
const SEQ_ROW = { firstY: 116, height: 52 };
const sequenceRows = (sequence, view = { collapsed: new Set(), enter: undefined }) => {
  const fragments = sequence.fragments;
  const scope = view.enter === undefined ? undefined : fragments[view.enter];
  const contains = (outer, inner) => outer.start <= inner.start && inner.end <= outer.end && outer.depth < inner.depth;
  // 閉じたブロックの中のブロックは出さない。中だけを見ているときは、そのブロックの中のブロックだけを出す
  // 中だけを見ているブロックも、枠とタブを残す（構成図の中へ入ったグループと同じく、外枠が見える）
  const shown = (fragment, at) =>
    fragment.end > fragment.start &&
    (!scope || at === view.enter || contains(scope, fragment)) &&
    ![...view.collapsed].some((closed) => closed !== at && fragments[closed] && contains(fragments[closed], fragment));
  const closedAt = (index) => [...view.collapsed].find((at) => fragments[at] && shown(fragments[at], at) && fragments[at].start <= index && index < fragments[at].end);
  const rows = [];
  const first = scope ? scope.start : 0;
  const last = scope ? scope.end : sequence.messages.length;
  for (let index = first; index < last; index += 1) {
    if (closedAt(index) === undefined) for (const note of sequence.notes.filter((item) => item.after === index)) rows.push({ note });
    const starting = fragments.map((fragment, at) => ({ fragment, at })).filter(({ fragment, at }) => fragment.start === index && shown(fragment, at)).sort((x, y) => x.fragment.depth - y.fragment.depth);
    let closed = false;
    for (const { fragment, at } of starting) {
      if (view.collapsed.has(at)) {
        rows.push({ collapsed: at });
        closed = true;
        break;
      }
      rows.push({ fragment, fragmentAt: at, section: 0 });
    }
    if (!closed && closedAt(index) === undefined) {
      fragments.forEach((fragment, at) => {
        if (!shown(fragment, at) || view.collapsed.has(at)) return;
        fragment.sections.forEach((section, number) => {
          if (number > 0 && section.start === index) rows.push({ fragment, fragmentAt: at, section: number });
        });
      });
    }
    if (closedAt(index) === undefined) rows.push({ message: index });
  }
  if (!scope) for (const note of sequence.notes.filter((item) => item.after === sequence.messages.length)) rows.push({ note });
  return rows;
};

/** 複合フラグメントの枠・注記・活性化の帯・矢印の種類・番号を、描いたシーケンス図の上に足す */
const decorateSequence = ({ stage, svg, rows, rowWires, rowLabels, wires, messageLabels, visible, heads, sequence, enter, onToggle, onEnter }) => {
  const rowY = (at) => SEQ_ROW.firstY + at * SEQ_ROW.height;
  const columnX = (id) => {
    const head = heads(id);
    return head ? head.offsetLeft + head.offsetWidth / 2 : 0;
  };
  const columns = visible.map(columnX);
  const rowOf = new Map(rows.flatMap((row, at) => (row.message === undefined ? [] : [[row.message, at]])));
  // 見出しと注記の行の空のメッセージを隠す
  rows.forEach((row, at) => {
    if (row.message !== undefined) return;
    for (const element of [rowWires[at], rowLabels[at]]) element?.classList.add("map-gap");
  });
  const under = document.createElementNS(SVG_NS, "g");
  under.setAttribute("class", "map-seq-under");
  svg.prepend(under);
  // 複合フラグメント: 関わる参加者の列を囲み、左上に開閉の山形と種類とラベルのタブ（押すとブロックの中だけを見る）、else・and・option の区間を破線で分ける。
  // rect は名前の無いブロックで、直前の `%% block: 名前` のコメントで名前を付ける（読み取りで label に入る）
  const titleOf = (fragment) => fragment.label;
  const tabOf = (fragment, at, expanded, left, top) => {
    const tab = document.createElement("span");
    tab.className = `map-seq-fragment-tab${fragment.kind === "rect" ? " is-block" : ""}`;
    tab.style.left = `${left}px`;
    tab.style.top = `${top}px`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "map-disclosure";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${fragment.kind}「${titleOf(fragment)}」を${expanded ? "閉じる" : "開く"}`);
    toggle.innerHTML = icon(expanded ? "collapse" : "expand");
    toggle.addEventListener("click", (event) => onToggle(at, event.shiftKey));
    // 中だけを見ているブロックのタブは、開閉の山形を出さず、名前も押せない文字にする（構成図の今入っているグループと同じ）
    if (at === enter) {
      const current = document.createElement("span");
      current.className = "map-seq-fragment-title is-current";
      current.innerHTML = `${fragment.kind === "rect" ? "" : `<b>${fragment.kind}</b> `}${titleOf(fragment)}`;
      tab.append(current);
      return tab;
    }
    const title = document.createElement("button");
    title.type = "button";
    title.className = "map-seq-fragment-title";
    title.title = "このブロックの中だけを見る";
    title.innerHTML = `${fragment.kind === "rect" ? "" : `<b>${fragment.kind}</b> `}${titleOf(fragment)}`;
    title.addEventListener("click", () => onEnter(at));
    tab.append(toggle, title);
    return tab;
  };
  const spanOf = (fragment) => {
    const inside = sequence.messages.slice(fragment.start, fragment.end).flatMap((message) => [message.from, message.to]).filter((id) => visible.includes(id));
    const xs = inside.map(columnX);
    const pad = 70 - fragment.depth * 10;
    return [Math.min(...xs) - pad, Math.max(...xs) + pad];
  };
  rows.forEach((row, at) => {
    if (row.collapsed === undefined) return;
    const fragment = sequence.fragments[row.collapsed];
    const [left, right] = spanOf(fragment);
    const top = rowY(at) - 30;
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("class", "map-seq-fragment is-collapsed");
    for (const [key, value] of Object.entries({ x: left, y: top, width: right - left, height: 40, rx: 4 })) rect.setAttribute(key, String(value));
    under.append(rect);
    const tab = tabOf(fragment, row.collapsed, false, left, top);
    const count = document.createElement("span");
    count.className = "map-seq-fragment-count";
    count.textContent = `メッセージ ${fragment.end - fragment.start} 件`;
    tab.append(count);
    stage.append(tab);
  });
  rows.forEach((row, headRow) => {
    if (row.fragment === undefined || row.section !== 0) return;
    const fragment = row.fragment;
    const [left, right] = spanOf(fragment);
    const inside = rows.map((item, at) => ({ item, at })).filter(({ item }) => (item.message !== undefined && fragment.start <= item.message && item.message < fragment.end) || (item.collapsed !== undefined && sequence.fragments[item.collapsed].start >= fragment.start && sequence.fragments[item.collapsed].end <= fragment.end));
    const lastRow = Math.max(headRow, ...inside.map(({ at }) => at));
    const top = rowY(headRow) - 30;
    const bottom = rowY(lastRow) + 14;
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("class", `map-seq-fragment${fragment.kind === "rect" ? " is-rect" : ""}`);
    for (const [key, value] of Object.entries({ x: left, y: top, width: right - left, height: bottom - top, rx: 4 })) rect.setAttribute(key, String(value));
    under.append(rect);
    stage.append(tabOf(fragment, row.fragmentAt, true, left, top));
    fragment.sections.slice(1).forEach((section, offset) => {
      const at = rows.findIndex((item) => item.fragment === fragment && item.section === offset + 1);
      if (at === -1) return;
      const y = rowY(at) - 14;
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", "map-seq-section");
      for (const [key, value] of Object.entries({ x1: left, x2: right, y1: y, y2: y })) line.setAttribute(key, String(value));
      under.append(line);
      const text = document.createElement("span");
      text.className = "map-seq-section-label";
      text.textContent = `[${section.label}]`;
      text.style.left = `${left + 8}px`;
      text.style.top = `${y + 2}px`;
      stage.append(text);
    });
  });
  // 注記: 参加者の左・右・上（2 人なら 2 人の上をまたぐ）に置く箱
  rows.forEach((row, at) => {
    if (!row.note) return;
    const xs = row.note.of.map(columnX);
    const [left, right] =
      row.note.placement === "left"
        ? [xs[0] - 170, xs[0] - 16]
        : row.note.placement === "right"
          ? [xs[0] + 16, xs[0] + 170]
          : [Math.min(...xs) - 60, Math.max(...xs) + 60];
    const note = document.createElement("div");
    note.className = "map-seq-note";
    note.textContent = row.note.text;
    note.style.cssText = `left:${left}px;top:${rowY(at) - 32}px;width:${right - left}px`;
    stage.append(note);
  });
  // 活性化の帯: 参加者の縦線の上に、始まりのメッセージから終わりのメッセージまでの細い帯（入れ子は右へずらす）。
  // 帯はメッセージの線より上に面の色で描き、帯に出入りするメッセージの線は帯の端で止める（線が帯に透けて重ならない）
  const activeDepths = (id, index) => sequence.activations.filter((item) => item.id === id && item.start <= index && index <= item.end).map((item) => item.depth);
  sequence.messages.forEach((message, index) => {
    const wire = wires[index];
    const numbers = wire?.getAttribute("d")?.match(/-?[\d.]+/g)?.map(Number);
    if (!numbers || numbers.length < 4 || message.from === message.to) return;
    const [x1, y, x2] = numbers;
    const edge = (id, x, towards) => {
      const depths = activeDepths(id, index);
      if (depths.length === 0) return x;
      return towards > x ? x + 5 + Math.max(...depths) * 6 : x - 5;
    };
    const start = edge(message.from, x1, x2);
    const end = edge(message.to, x2, x1);
    wire.setAttribute("d", `M${start} ${y}L${end + Math.sign(start - end) * 1} ${y}`);
  });
  const above = document.createElementNS(SVG_NS, "g");
  above.setAttribute("class", "map-seq-above");
  svg.append(above);
  for (const activation of sequence.activations) {
    // 始まりか終わりのメッセージが閉じたブロックの中にある帯は、閉じたブロックの行から・行まで描く。ブロックの中だけを見ているときは、見えている行の範囲に縮める
    const rowOfMessage = (index) =>
      rowOf.get(index) ??
      rows.findIndex((row) => row.collapsed !== undefined && sequence.fragments[row.collapsed].start <= index && index < sequence.fragments[row.collapsed].end);
    const rowsIn = [];
    for (let index = activation.start; index <= activation.end; index += 1) {
      const at = rowOfMessage(index);
      if (at !== -1 && at !== undefined) rowsIn.push(at);
    }
    if (rowsIn.length === 0 || !visible.includes(activation.id)) continue;
    const x = columnX(activation.id) - 5 + activation.depth * 6;
    const top = rowY(Math.min(...rowsIn));
    const bottom = rowY(Math.max(...rowsIn));
    const bar = document.createElementNS(SVG_NS, "rect");
    bar.setAttribute("class", "map-seq-activation");
    for (const [key, value] of Object.entries({ x, y: top, width: 10, height: Math.max(12, bottom - top) })) bar.setAttribute(key, String(value));
    above.append(bar);
  }
  // 矢印の種類と番号: 実線と点線・矢じり（無し・塗り・×・非同期）・両向き。autonumber のときだけ番号を付ける
  let number = 0;
  sequence.messages.forEach((message, index) => {
    const wire = wires[index];
    const label = messageLabels[index];
    number += 1;
    if (label) label.textContent = sequence.autonumber ? `${number} ${message.text}` : message.text;
    if (!wire) return;
    wire.setAttribute("stroke-dasharray", message.arrow.dotted ? "6 4" : "");
    const marker = wire.getAttribute("marker-end");
    const ref = marker && /url\(#([^)]+)-head-[a-z]+\)/.exec(marker)?.[1];
    if (message.arrow.head === "none") wire.removeAttribute("marker-end");
    else if (ref) wire.setAttribute("marker-end", `url(#${ref}-head-${message.arrow.head === "async" ? "read" : message.arrow.head === "cross" ? "cross" : "flow"})`);
    if (message.arrow.both && wire.getAttribute("marker-end")) wire.setAttribute("marker-start", wire.getAttribute("marker-end"));
    if (message.arrow.head === "cross" && ref) ensureCrossMarker(svg.ownerDocument, stage.closest("figure"), ref);
    tintArrowhead(stage.closest("figure"), wire);
  });
};

/** 失敗のメッセージ（-x）の矢じりの × の marker を、図の defs に 1 つだけ足す */
const ensureCrossMarker = (doc, figure, ref) => {
  const id = `${ref}-head-cross`;
  if (figure.querySelector(`marker[id="${CSS.escape(id)}"]`)) return;
  const marker = doc.createElementNS(SVG_NS, "marker");
  for (const [key, value] of Object.entries({ id, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "8", markerHeight: "8", orient: "auto-start-reverse" })) marker.setAttribute(key, value);
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M2 1 L8 9 M8 1 L2 9");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-width", "1.6");
  marker.append(path);
  figure.querySelector(".mdmark-diagram-defs defs").append(marker);
};

export const createSequence = (host, spec, kinds, onStep) => {
  const sequence = parseSequence(spec.source);
  const notes = spec.notes ?? {};
  const state = {
    selected: new Set(),
    order: sequence.participants.map((participant) => participant.id),
    current: undefined,
    auto: false,
    /** 閉じた複合フラグメント（sequence.fragments の番号） */
    collapsed: new Set(),
    /** 参加者の箱が既定より高いとき、最初の行の前に空ける行の数（一番高い箱の下端から行を始める） */
    headRows: 0,
    /** 中だけを見ている複合フラグメントの番号（URL のクエリ文字列から読む） */
    enter: (() => {
      const value = Number(readQuery(spec.queryKey ?? "map-sequence"));
      return Number.isInteger(value) && sequence.fragments[value] ? value : undefined;
    })(),
  };
  const initialOrder = [...state.order];
  const seconds = spec.interval ?? DEFAULT_AUTOPLAY_SECONDS;
  let timer;
  const labelOf = (id) => sequence.participants.find((participant) => participant.id === id)?.label ?? id;

  const render = () => {
    writeQuery(spec.queryKey ?? "map-sequence", state.enter);
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const view = { collapsed: state.collapsed, enter: state.enter };
    const rows = [...Array.from({ length: state.headRows }, () => ({ gap: true })), ...sequenceRows(sequence, view)];
    const shownSet = new Set(rows.flatMap((row) => (row.message === undefined ? [] : [row.message])));
    const shown = sequence.messages.map((message, index) => ({ message, index })).filter(({ index }) => shownSet.has(index));
    // ブロックの中だけを見ているときは、ブロックの中のメッセージに関わる参加者だけを出す
    const involved = new Set(shown.flatMap(({ message }) => [message.from, message.to]));
    const visible = state.enter === undefined ? state.order : state.order.filter((id) => involved.has(id));
    const definition = {
      title: spec.title,
      scope: state.enter === undefined ? "map のシーケンス図" : `${sequence.fragments[state.enter].kind === "rect" ? "ブロック" : sequence.fragments[state.enter].kind}「${sequence.fragments[state.enter].label}」の中`,
      updated: "2026-11-09",
      participants: visible.map((id) => ({ id, kind: "script", name: labelOf(id) })),
      steps: rows.map((row) =>
        row.message === undefined
          ? { from: visible[0], to: visible[0], label: "" }
          : { from: sequence.messages[row.message].from, to: sequence.messages[row.message].to, label: sequence.messages[row.message].text },
      ),
    };
    host.replaceChildren();
    mount(host, { markdown: `<!-- sequence -->\n\n\`\`\`json\n${JSON.stringify(definition)}\n\`\`\`\n\n<!-- /sequence -->\n` });
    const figure = host.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const svg = stage.querySelector(".mdmark-diagram-wires");
    const rowWires = [...svg.querySelectorAll(".mdmark-diagram-wire")];
    const rowLabels = [...stage.querySelectorAll(".mdmark-diagram-label")];
    const lifelines = [...svg.querySelectorAll(".mdmark-diagram-lifeline")];
    const heads = (id) => stage.querySelector(`[data-node="${CSS.escape(id)}"]`);
    const rowOf = new Map(rows.flatMap((row, at) => (row.message === undefined ? [] : [[row.message, at]])));
    const wires = sequence.messages.map((_, index) => rowWires[rowOf.get(index)]);
    const messageLabels = sequence.messages.map((_, index) => rowLabels[rowOf.get(index)]);
    decorateSequence({
      enter: state.enter,
      stage,
      svg,
      rows,
      rowWires,
      rowLabels,
      wires,
      messageLabels,
      visible,
      heads,
      figure,
      sequence,
      onToggle: (index, all) => {
        // Shift を押しながらだと、そのブロックと中のブロックを全て開閉する
        const targets = all ? sequence.fragments.flatMap((item, at) => (item.start >= sequence.fragments[index].start && item.end <= sequence.fragments[index].end ? [at] : [])) : [index];
        const close = !state.collapsed.has(index);
        for (const at of targets) close ? state.collapsed.add(at) : state.collapsed.delete(at);
        render();
      },
      onEnter: (index) => {
        state.enter = index;
        state.collapsed.delete(index);
        render();
      },
    });

    // 参加者を選んだときの強調
    const related = (message) =>
      state.selected.size === 0
        ? undefined
        : state.selected.size === 1
          ? state.selected.has(message.from) || state.selected.has(message.to)
          : state.selected.has(message.from) && state.selected.has(message.to);
    shown.forEach(({ message, index }) => {
      const hit = related(message);
      if (hit === false) {
        wires[index]?.classList.add("map-dim");
        messageLabels[index]?.classList.add("map-dim");
      }
      // 選んだ参加者のメッセージの線には、データの印を送り手から受け手へ流し続ける（再生中の線には重ねない）
      if (hit === true && wires[index] && index !== state.current) {
        wires[index].id = `map-seq-select-${spec.id}-${index}`;
        addPackets(svg, wires[index]);
      }
    });
    visible.forEach((id, at) => {
      const head = heads(id);
      applyKind(head, kinds[id]);
      head.classList.add("map-participant");
      head.tabIndex = 0;
      head.setAttribute("role", "button");
      head.setAttribute("aria-pressed", String(state.selected.has(id)));
      head.title = "名前の外を押すと、この参加者のメッセージを強調する";
      if (state.selected.size && !state.selected.has(id)) for (const element of [head, lifelines[at]]) element?.classList.add("map-dim");
      const toggle = () => {
        if (state.selected.has(id)) state.selected.delete(id);
        else state.selected.add(id);
        render();
      };
      head.addEventListener("click", (event) => {
        // 名前の文字の上は、文字を選んでコピーできるよう、選択の対象にしない。並べ替えのドラッグの後も選ばない
        if (event.target.closest(".mdmark-diagram-node-name")) return;
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        toggle();
      });
      head.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggle();
        }
      });
      // ブロックの中だけを見ているときは並べ替えない
      if (state.enter === undefined) attachReorder(head, id, at, visible.length);
    });

    // メッセージの線のホバー
    const box = figure.querySelector(".mdmark-diagram-box");
    const tip = document.createElement("div");
    tip.className = "map-wire-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    box.append(tip);
    shown.forEach(({ message, index }) => {
      const at = index;
      const wire = wires[at];
      if (!wire) return;
      const hit = document.createElementNS(SVG_NS, "path");
      hit.setAttribute("d", wire.getAttribute("d"));
      hit.setAttribute("class", "map-wire-hit");
      const ends = [heads(message.from), heads(message.to)].filter(Boolean);
      const label = messageLabels[at];
      let hoverPackets = [];
      hit.addEventListener("pointerenter", () => {
        focusOn(stage, [wire, label, ...ends].filter(Boolean));
        // ポインターを当てている間は、その線にもデータの印を流す（選択・再生で流している線には重ねない）
        if (!wire.id) {
          wire.id = `map-seq-hover-${spec.id}-${at}`;
          hoverPackets = addPackets(svg, wire);
        }
        tip.textContent = notes[index + 1] ?? "";
        tip.hidden = tip.textContent === "";
      });
      hit.addEventListener("pointermove", (event) => {
        const rect = box.getBoundingClientRect();
        const x = event.clientX - rect.left + 12;
        const y = event.clientY - rect.top + 12;
        tip.style.left = `${x + tip.offsetWidth > rect.width ? Math.max(0, x - 24 - tip.offsetWidth) : x}px`;
        tip.style.top = `${y + tip.offsetHeight > rect.height ? Math.max(0, y - 24 - tip.offsetHeight) : y}px`;
      });
      hit.addEventListener("pointerleave", () => {
        clearFocus(stage);
        if (hoverPackets.length) {
          for (const shape of hoverPackets) shape.remove();
          hoverPackets = [];
          wire.removeAttribute("id");
        }
        tip.hidden = true;
      });
      // メッセージの線を押すと、送り手と受け手を選ぶ（どちらも選ばれていれば両方を解く）
      hit.addEventListener("click", () => {
        const ids = [message.from, message.to];
        if (ids.every((id) => state.selected.has(id))) for (const id of ids) state.selected.delete(id);
        else for (const id of ids) state.selected.add(id);
        render();
      });
      svg.append(hit);
      // 構成図の上で再生している今のメッセージ: 参加者を選んでいないときだけ、ほかのメッセージと参加者を薄くする（選んだ参加者の強調を優先する）
      const dimByPlay = state.current !== undefined && state.selected.size === 0;
      if (dimByPlay && index !== state.current) for (const element of [wire, label]) element?.classList.add("map-dim");
      if (index === state.current) {
        const playing = new Set([message.from, message.to]);
        visible.forEach((id, column) => {
          if (dimByPlay && !playing.has(id)) for (const element of [heads(id), heads(id)?.nextElementSibling, lifelines[column]]) element?.classList.add("map-dim");
        });
        wire.id = `map-seq-packet-${spec.id}`;
        addPackets(svg, wire, { reverse: false });
      }
    });

    // 右上のツール
    const tools = figure.querySelector(".mdmark-diagram-tools");
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    // 参加者を並べ替えたか選んだときだけ押せる「元に戻す」: 並び順と選択をまとめて戻す
    const changed = state.selected.size > 0 || state.order.some((id, at) => id !== initialOrder[at]);
    group.append(
      toolButton("back", "ブロックの外へ戻る", () => {
        const outer = sequence.fragments.filter((item, at) => at !== state.enter && item.start <= sequence.fragments[state.enter].start && sequence.fragments[state.enter].end <= item.end && item.depth < sequence.fragments[state.enter].depth);
        state.enter = outer.length ? sequence.fragments.indexOf(outer.at(-1)) : undefined;
        render();
      }, state.enter === undefined ? { disabled: "" } : {}),
      toolButton("expandAll", "全てのブロックを開く", () => {
        state.collapsed.clear();
        render();
      }),
      toolButton("collapseAll", "全てのブロックを閉じる", () => {
        sequence.fragments.forEach((item, at) => {
          if (at !== state.enter && item.depth === (state.enter === undefined ? 0 : sequence.fragments[state.enter].depth + 1)) state.collapsed.add(at);
        });
        render();
      }),
      toolButton("reset", "参加者の並び順と選択を元に戻す", () => {
        state.order = [...initialOrder];
        state.selected.clear();
        render();
      }, changed ? {} : { disabled: "" }),
    );
    tools.prepend(group);

    // 図の枠の下の帯: メッセージを 1 通ずつ進め、構成図の上でも同じメッセージを強調してデータを流す
    state.shownIndexes = shown.map(({ index }) => index);
    const total = shown.length;
    const position = state.shownIndexes.indexOf(state.current);
    const message = state.current === undefined ? undefined : sequence.messages[state.current];
    const note = state.current === undefined ? undefined : notes[state.current + 1];
    figure.querySelector(".mdmark-diagram-box").after(
      stepBand({
        label: `${spec.title}の再生`,
        total,
        index: position === -1 ? undefined : position,
        heading: message ? message.text : "",
        text: message ? `${labelOf(message.from)} → ${labelOf(message.to)}${note ? `\n${note}` : ""}` : "",
        auto: state.auto,
        names: { prev: "前のメッセージ", next: "次のメッセージ", stop: "再生を終える" },
        go: (next) => step(state.shownIndexes[next]),
        stop: () => stop(),
        toggleAuto: () => {
          state.auto = !state.auto;
          if (state.auto && state.current === undefined) step(state.shownIndexes[0]);
          else {
            render();
            if (state.current !== undefined) onStep(state.current, state.auto);
          }
          schedule();
        },
      }),
    );

    replaceResizeIcon(figure);
    keepSequenceScale(host);
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
    // 名前が 3 行以上に折り返して箱が高くなったときは、最初の行（タブ・注記・メッセージのラベルの上端は行の 30px 上）が一番高い箱の 8px 下から始まるよう、空ける行を決め直して描き直す
    const tallest = Math.max(...[...stage.querySelectorAll(".map-participant")].map((head) => head.offsetTop + head.offsetHeight));
    const firstTop = SEQ_ROW.firstY - 30;
    const needed = Math.max(0, Math.ceil((tallest + 8 - firstTop) / SEQ_ROW.height));
    if (needed !== state.headRows) {
      state.headRows = needed;
      render();
    }
  };

  /**
   * 参加者の並べ替え: 箱の名前の文字の外を押したまま左右へ動かし（4px 動くまでは押した扱い）、離した位置の列へ参加者を移す。
   * キーボードでは箱にフォーカスして Alt + 左右の矢印で 1 列ずつ動かす
   */
  let suppressClick = false;
  const attachReorder = (head, id, at, count) => {
    head.setAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowRight");
    const move = (to) => {
      if (to < 0 || to >= count || to === at) return;
      const next = [...state.order];
      const [item] = next.splice(at, 1);
      next.splice(to, 0, item);
      state.order = next;
      render();
      host.querySelector(`.map-participant[data-node="${CSS.escape(id)}"]`)?.focus();
    };
    head.addEventListener("keydown", (event) => {
      if (event.altKey && event.key === "ArrowLeft") move(at - 1);
      if (event.altKey && event.key === "ArrowRight") move(at + 1);
    });
    head.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(".mdmark-diagram-node-name, button")) return;
      event.stopPropagation();
      const heads = [...host.querySelectorAll(".map-participant")];
      // 動かし始めたときの列の位置で判定する（動かしている箱自身はポインターの下にあるため数えない）
      const rects = heads.map((item) => item.getBoundingClientRect());
      const container = head.parentElement;
      const base = container.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      let dragging = false;
      let target = at;
      let marker;
      const onMove = (moveEvent) => {
        if (!dragging && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
        if (!dragging) {
          dragging = true;
          // 挿入する場所を示す縦の線
          marker = document.createElement("div");
          marker.className = "map-insert-line";
          marker.hidden = true;
          container.append(marker);
          head.classList.add("is-dragging");
        }
        head.style.translate = `${moveEvent.clientX - startX}px 0`;
        const x = moveEvent.clientX;
        const centers = rects.map((rect) => (rect.left + rect.right) / 2);
        // ポインターに最も近い列を移す先にする
        target = centers.reduce((best, center, index) => (Math.abs(center - x) < Math.abs(centers[best] - x) ? index : best), 0);
        if (target === at) {
          marker.hidden = true;
          return;
        }
        // 左へ移すときは移す先の列の左、右へ移すときは右に線を出す
        const edge = target < at ? rects[target].left - 8 : rects[target].right + 8;
        marker.style.left = `${(edge - base.left) / (base.width / container.offsetWidth || 1)}px`;
        marker.hidden = false;
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        if (!dragging) return;
        suppressClick = true;
        head.style.translate = "";
        head.classList.remove("is-dragging");
        marker?.remove();
        move(target);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
    });
  };

  const step = (index) => {
    state.current = index;
    render();
    onStep(index, state.auto);
  };
  const stop = () => {
    clearInterval(timer);
    state.auto = false;
    state.current = undefined;
    render();
    onStep(undefined);
  };
  /** 自動で進める: 印の引数 interval の間隔ごとに次へ進み、最後の次は最初へ戻る */
  const schedule = () => {
    clearInterval(timer);
    if (!state.auto) return;
    timer = setInterval(() => {
      const list = state.shownIndexes;
      const at = list.indexOf(state.current);
      step(list[at === -1 ? 0 : (at + 1) % list.length]);
    }, seconds * 1000);
  };

  host.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.selected.size) {
      state.selected.clear();
      render();
    }
  });

  render();
  return {
    /** 指定の番号のメッセージから進める（モックの場面の初期状態） */
    start: (index) => step(index),
    /** 構成図の案内を始めたときに、メッセージの強調と自動で進めるのを止める */
    clear: () => {
      if (state.current === undefined) return;
      clearInterval(timer);
      state.auto = false;
      state.current = undefined;
      render();
    },
  };
};
