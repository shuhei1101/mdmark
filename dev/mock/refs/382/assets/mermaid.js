// [data-mock-mermaid] の pre の mermaid のソースを、mdmark の CSS 変数から作ったテーマで描き、図の枠に入れる。
// 配色（html の data-scheme）が変わったら描き直す。
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";

// 図の枠のボタンとリサイズハンドルのアイコン（lucide）
const ICONS = {
  zoomIn: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  zoomOut: '<path d="M5 12h14"/>',
  fullscreen:
    '<path d="m15 15 6 6"/><path d="m15 9 6-6"/><path d="M21 16v5h-5"/><path d="M21 8V3h-5"/><path d="M3 16v5h5"/><path d="m3 21 6-6"/><path d="M3 8V3h5"/><path d="M9 9 3 3"/>',
  grip: '<circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/>',
  // シーケンス図の actor に当てる人のアイコン（lucide の user）
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  // 書き方の警告の題のアイコン（lucide の pencil）
  pencil:
    '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
};

// front matter の title も accTitle も無いときに図の枠のタイトルにする、図の種類の名前（ソースの先頭の語から引く）
const KIND_NAMES = {
  flowchart: "フローチャート",
  graph: "フローチャート",
  sequenceDiagram: "シーケンス図",
  classDiagram: "クラス図",
  stateDiagram: "状態遷移図",
  "stateDiagram-v2": "状態遷移図",
  erDiagram: "ER 図",
  gantt: "ガントチャート",
  pie: "円グラフ",
};

// mermaid の変数と、元にする mdmark の CSS 変数
const COLOR_VARIABLES = {
  background: "--mdmark-color-bg",
  primaryColor: "--mdmark-color-surface",
  primaryTextColor: "--mdmark-color-text",
  primaryBorderColor: "--mdmark-color-border",
  secondaryColor: "--mdmark-color-surface",
  tertiaryColor: "--mdmark-color-bg",
  lineColor: "--mdmark-color-diagram-line",
  textColor: "--mdmark-color-text",
  noteBkgColor: "--mdmark-color-surface",
  noteTextColor: "--mdmark-color-text",
  noteBorderColor: "--mdmark-color-border",
  actorBkg: "--mdmark-color-surface",
  actorBorder: "--mdmark-color-border",
  actorTextColor: "--mdmark-color-text",
  actorLineColor: "--mdmark-color-border",
  signalColor: "--mdmark-color-text",
  signalTextColor: "--mdmark-color-text",
  edgeLabelBackground: "--mdmark-color-bg",
  titleColor: "--mdmark-color-heading",
  pie1: "--mdmark-color-series-1",
  pie2: "--mdmark-color-series-2",
  pie3: "--mdmark-color-series-3",
  pie4: "--mdmark-color-series-4",
  pie5: "--mdmark-color-series-5",
  pie6: "--mdmark-color-series-6",
  pieStrokeColor: "--mdmark-color-bg",
  pieOuterStrokeColor: "--mdmark-color-border",
  pieTitleTextColor: "--mdmark-color-heading",
  pieSectionTextColor: "--mdmark-color-bg",
  pieLegendTextColor: "--mdmark-color-text",
};

const canvas = document.createElement("canvas");
canvas.width = 1;
canvas.height = 1;
const context = canvas.getContext("2d", { colorSpace: "srgb", willReadFrequently: true });

const hex2 = (value) => value.toString(16).padStart(2, "0");

/** CSS 変数を、試しの要素の color で色に解決して sRGB の hex にする。rgb()・rgba() は値をそのまま読み、ほかの書き方は canvas で変換する */
const resolveHex = (root, name) => {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  root.append(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const rgb = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  let channels;
  if (rgb) {
    const alpha = rgb[4] === undefined ? 255 : Math.round(Number(rgb[4]) * 255);
    channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
  } else {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = computed;
    context.fillRect(0, 0, 1, 1);
    channels = [...context.getImageData(0, 0, 1, 1).data];
  }
  const [r, g, b, a] = channels;
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a === 255 ? "" : hex2(a)}`;
};

/** 描く先の要素の CSS 変数から、mermaid の base テーマの変数を作る */
const themeVariables = (root) => {
  const variables = {};
  for (const [key, name] of Object.entries(COLOR_VARIABLES)) {
    variables[key] = resolveHex(root, name);
  }
  variables.fontFamily = getComputedStyle(root).getPropertyValue("--mdmark-font-body").trim();
  variables.fontSize = getComputedStyle(root).fontSize;
  // 枠線のグラデーションと影を付けない（デザイン方針の「使わないもの」）
  variables.useGradient = false;
  variables.dropShadow = "none";
  return variables;
};

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** front matter の title を取り出し、ソースから外す（図の中に同じタイトルを重ねて描かない） */
const splitTitle = (source) => {
  const front = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!front) {
    const acc = source.match(/^\s*accTitle:\s*(.+)$/m);
    return { title: acc ? acc[1].trim() : null, body: source };
  }
  const titleLine = front[1].match(/^title:\s*(.+)$/m);
  const rest = front[1].replace(/^title:.*$\n?/m, "").trim();
  const body = (rest ? `---\n${rest}\n---\n` : "") + source.slice(front[0].length);
  return { title: titleLine ? titleLine[1].trim() : null, body };
};

const kindName = (body) => {
  const first = body.replace(/^---\n[\s\S]*?\n---\n/, "").trim().split(/\s/)[0];
  return KIND_NAMES[first] ?? "図";
};

const tool = (name, label, iconName) =>
  `<button class="mdmark-diagram-tool" type="button" data-tool="${name}" aria-label="${label}"><svg class="mdmark-diagram-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[iconName]}</svg></button>`;

/** 図の枠の HTML（タイトル・右上のボタンの帯・表示する枠・リサイズハンドル）。範囲・更新日は mermaid が持たないので出さない */
const frameHtml = (id, title, svg) => `
  <figcaption class="mdmark-diagram-head" id="${id}-title"><span class="mdmark-diagram-title">${escapeHtml(title)}</span></figcaption>
  <div class="mdmark-diagram-box">
    <div class="mdmark-diagram-tools" role="toolbar" aria-label="「${escapeHtml(title)}」の表示">
      <div class="mdmark-diagram-tools-group" data-group="zoom">${tool("out", "縮小", "zoomOut")}<button class="mdmark-diagram-tool mdmark-diagram-zoom" type="button" data-tool="fit">100%</button>${tool("in", "拡大", "zoomIn")}</div>
      <div class="mdmark-diagram-tools-group" data-group="screen">${tool("fullscreen", "全画面で開く", "fullscreen")}</div>
    </div>
    <div class="mdmark-diagram-viewport mock-mermaid-viewport" tabindex="0" role="group" aria-roledescription="図" aria-labelledby="${id}-title" aria-keyshortcuts="+ - 0 ArrowLeft ArrowUp ArrowDown ArrowRight">${svg}</div>
    <div class="mdmark-diagram-resize" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="「${escapeHtml(title)}」の表示の高さ" aria-keyshortcuts="ArrowUp ArrowDown" title="ドラッグか ↑ ↓ で高さを変える。ダブルクリックで元の高さに戻す"><svg class="mdmark-diagram-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS.grip}</svg></div>
  </div>
  <ul class="mdmark-diagram-legend" aria-label="凡例" hidden></ul>`;

/** シーケンス図の actor の棒人間を、lucide の user のアイコンに替える */
const replaceActors = (svg) => {
  for (const group of svg.querySelectorAll("g.actor-man")) {
    const head = group.querySelector("circle");
    if (!head) continue;
    const box = group.getBBox();
    const size = Math.min(box.width, box.height);
    const x = box.x + (box.width - size) / 2;
    for (const child of [...group.children]) {
      if (child.tagName.toLowerCase() !== "text") child.remove();
    }
    group.insertAdjacentHTML(
      "afterbegin",
      `<svg class="mock-mermaid-actor" x="${x}" y="${box.y}" width="${size}" height="${size}" viewBox="0 0 24 24">${ICONS.user}</svg>`,
    );
  }
};

/** 解釈できない mermaid のコードブロックの前に置く書き方の警告 */
const warningHtml = (message) => `
  <div class="mdmark-syntax-warning">
    <p class="mdmark-syntax-warning-title"><svg class="mdmark-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS.pencil}</svg>書き方の警告</p>
    <p>mermaid の図を描けません（${escapeHtml(message)}）。コードブロックのまま表示しています。</p>
  </div>`;

let renderCount = 0;

/** 1 つのコードブロックを描く。解釈できないときは書き方の警告とコードブロックにする */
const drawOne = async (block) => {
  const source = block.dataset.source;
  const root = block.closest(".mdmark");
  const { title, body } = splitTitle(source);
  const holder = block.nextElementSibling?.matches("[data-mock-mermaid-out]") ? block.nextElementSibling : document.createElement("div");
  holder.dataset.mockMermaidOut = "";
  if (!holder.isConnected) block.after(holder);
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: themeVariables(root) });
  renderCount += 1;
  const id = `mock-mermaid-${renderCount}`;
  try {
    const { svg } = await mermaid.render(id, body);
    block.hidden = true;
    holder.innerHTML = `<figure class="mdmark-diagram" data-kind="mermaid">${frameHtml(id, title ?? kindName(body), svg)}</figure>`;
    const drawn = holder.querySelector("svg[id]");
    if (block.dataset.mockActor !== "mermaid") replaceActors(drawn);
  } catch (error) {
    // mermaid が文書の中に残すエラーの図を消す
    document.getElementById(`d${id}`)?.remove();
    block.hidden = false;
    holder.innerHTML = warningHtml(String(error?.message ?? error).split("\n")[0]);
    holder.after(block);
  }
};

const drawAll = async () => {
  for (const block of document.querySelectorAll("pre[data-mock-mermaid]")) {
    await drawOne(block);
  }
};

for (const block of document.querySelectorAll("pre[data-mock-mermaid]")) {
  block.dataset.source = block.textContent.replace(/^\n/, "");
}
await drawAll();
// 配色を切り替えたら、CSS 変数から作り直したテーマで描き直す
new MutationObserver(() => drawAll()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme"] });
