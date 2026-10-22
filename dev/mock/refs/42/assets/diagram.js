// 図の部品と操作できる部品のモック（実装の mount が描く形と、付ける操作）。
// [data-mock-diagram] に samples.js の定義の名前を書いた figure へ、題・凡例・右上のボタン・図・ツールチップを描く。
// [data-mock-param] の要素へ、スライダー・今の値を写すボタン・グラフを描く。
// モックの見本だけの指定: data-mock-zoom（開いたときの倍率）・data-mock-scroll（開いたときの位置。図の座標の "x,y"）・
// data-mock-open（開いたままにするツールチップの持ち主。線の id・"node:{箱の id}"・"term:{語}"）・data-mock-copy（"copied" / "failed" の知らせを出したまま）・
// data-mock-hints="off"（機能 hints をオフにした文書。figure か祖先に書く。線の詳細・箱の入力・処理・出力・箱の hint のツールチップと印を出さない）

// sample.js・glossary.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 線のアイコン（24 の格子。lucide の形）
  const ICONS = {
    llm: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    dm: '<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>',
    script: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
    mcp: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>',
    data: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    external: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    frame: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
    zoomIn: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    zoomOut: '<path d="M5 12h14"/>',
    fullscreen: '<path d="m15 15 6 6"/><path d="m15 9 6-6"/><path d="M21 16v5h-5"/><path d="M21 8V3h-5"/><path d="M3 16v5h5"/><path d="m3 21 6-6"/><path d="M3 8V3h5"/><path d="M9 9 3 3"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  };

  // 箱の種類の既定の名前（定義の tag が無いときに種類の行に出す）と、凡例の並び
  const KIND_TAGS = { llm: "LLM", dm: "意思決定モデル", script: "スクリプト", mcp: "MCP", data: "データ", external: "外部" };
  const KIND_LEGEND = { llm: "LLM", dm: "意思決定モデル", script: "スクリプト", mcp: "MCP", data: "データ（下の角が丸い箱）", external: "外部のシステム" };

  // システムの枠を持つ図で、外部のシステムの凡例に添える置き場所
  const OUTSIDE_FRAME = "（枠の外）";

  // 線の種類の凡例の名前（定義に出る種類だけを凡例に載せる）
  const LINE_LEGEND = { flow: "処理の流れ", read: "読む", write: "書く", reply: "返す", loop: "戻る（ループ）" };

  // 塗った矢じりの線の種類（ほかは開いた矢じり）
  const FILLED_HEADS = new Set(["flow", "write"]);

  // 拡大・縮小の 1 回の倍率と上限、矢印キーと移動のボタンの 1 回の移動量（px）
  const ZOOM_STEP = 1.25;
  const ZOOM_MAX = 3;
  const PAN_STEP = 80;

  // 倍率を比べるときの誤差
  const ZOOM_EPSILON = 0.001;

  // 線の交差を飛び越える半円の半径（px）
  const JUMP_RADIUS = 6;

  // 矢じりの大きさ（px）
  const HEAD_SIZE = 9;

  // ポインターが持ち主とツールチップの間を移る間、閉じるのを待つ時間（ミリ秒）と、持ち主との間・画面の端との間に空ける幅（px）
  const CLOSE_DELAY_MS = 150;
  const TIP_GAP_PX = 6;
  const VIEWPORT_MARGIN_PX = 16;

  // シーケンス図の寸法（px）: 相手の列の間隔・左端の中心・相手の箱の幅と高さ・メッセージの行の高さ・最初の行の位置・戻りの帯の幅
  const SEQ_COL_GAP = 180;
  const SEQ_FIRST_X = 92;
  const SEQ_HEAD_W = 150;
  const SEQ_HEAD_H = 56;
  const SEQ_ROW_H = 52;
  const SEQ_FIRST_Y = 116;
  const SEQ_BAND_W = 200;

  // グラフの寸法（px）: 全体と、描く範囲の上下左右の余白
  const CHART_W = 640;
  const CHART_H = 320;
  const CHART_PAD = { top: 36, right: 24, bottom: 56, left: 56 };

  // 系列の点の印の大きさ（px）。散布図は点だけで読むので大きくする
  const POINT_SIZE = 4.5;
  const SCATTER_POINT_SIZE = 5.5;

  // 文字を選べる所（ここではドラッグを始めない）と、押せる所
  const TEXT_SELECTOR = ".mdmark-diagram-node-kind, .mdmark-diagram-node-name, .mdmark-diagram-node-sub, .mdmark-diagram-label, .mdmark-diagram-frame-title, .mdmark-diagram-lane-label, .mdmark-diagram-axis-text, .mdmark-diagram-value-text, .mdmark-term";
  const CONTROL_SELECTOR = "button, a, input";

  // 図ごとの id の通し番号
  let figureCount = 0;

  // 描いている図のヒント（線の詳細・箱の入力・処理・出力・箱の hint）を出すか。mountDiagram が図ごとに決める
  let hintsOn = true;

  /** HTML に入れる文字を逃がす。 */
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** 線のアイコンの SVG を返す。 */
  const icon = (name) => `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  /** ツールチップを集める入れ物を作る。add は中身を登録して id を返す。 */
  const createTips = (fid) => {
    const list = [];
    const add = (html, label) => {
      const id = `${fid}-tip-${list.length + 1}`;
      list.push({ id, html, label });
      return id;
    };
    return { list, add };
  };

  /** 文の {{語}} を、用語集の意味のツールチップを持つ下線の語にする。 */
  const withTerms = (text, tips) =>
    esc(text).replace(/\{\{(.+?)\}\}/g, (_, term) => {
      const meaning = window.mdmarkMockGlossary[term];
      const id = tips.add(
        `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">用語</span><span class="mdmark-term-tip-meaning">${esc(meaning)}</span></span>`,
        `term:${term}`,
      );
      return `<span class="mdmark-term" tabindex="0" aria-describedby="${id}" data-tip-owner="term:${esc(term)}">${esc(term)}</span>`;
    });

  /** 線の詳細のツールチップの中身（要約の語を見出しに、詳細を本文に）。 */
  const wireTipHtml = (label, tip) =>
    `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${esc(label)}</span><span class="mdmark-term-tip-meaning">${esc(tip)}</span></span>`;

  /** 箱のツールチップの中身。hint は名前の下の文、io は入力・処理・出力の並び。両方あるときは hint を先に置く。 */
  const nodeTipHtml = (node) => {
    const hint = node.hint ? `<span class="mdmark-term-tip-meaning">${esc(node.hint)}</span>` : "";
    const io = node.io ? `<dl class="mdmark-diagram-tip-io"><dt>入力</dt><dd>${esc(node.io.in)}</dd><dt>処理</dt><dd>${esc(node.io.do)}</dd><dt>出力</dt><dd>${esc(node.io.out)}</dd></dl>` : "";
    return `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${esc(node.name)}</span>${hint}${io}</span>`;
  };

  /** 線の種類ごとの矢じりの marker を返す（大きさは線の太さによらない）。 */
  const markerDefs = (fid) =>
    Object.keys(LINE_LEGEND)
      .map((line) => {
        const shape = FILLED_HEADS.has(line) ? '<path d="M0,0 L9,4.5 L0,9 z"/>' : '<path d="M1,1 L8,4.5 L1,8" />';
        return `<marker id="${fid}-head-${line}" class="mdmark-diagram-arrowhead" data-line="${line}" viewBox="0 0 9 9" refX="8.5" refY="4.5" markerWidth="${HEAD_SIZE}" markerHeight="${HEAD_SIZE}" markerUnits="userSpaceOnUse" orient="auto-start-reverse">${shape}</marker>`;
      })
      .join("");

  /** 折れ線の点を、横と縦の区間に分ける。 */
  const segmentsOf = (points) =>
    points.slice(1).map((p, i) => {
      const a = points[i];
      return { a, b: p, horizontal: a[1] === p[1] };
    });

  /** 横の区間が他の線の縦の区間と交わる x を集める（横の線が縦の線を飛び越える）。 */
  const jumpsFor = (wire, wires) => {
    const jumps = new Map();
    segmentsOf(wire.points).forEach((seg, index) => {
      if (!seg.horizontal) return;
      const y = seg.a[1];
      const [x1, x2] = [seg.a[0], seg.b[0]].sort((p, q) => p - q);
      for (const other of wires) {
        if (other === wire) continue;
        for (const v of segmentsOf(other.points)) {
          if (v.horizontal) continue;
          const x = v.a[0];
          const [y1, y2] = [v.a[1], v.b[1]].sort((p, q) => p - q);
          // 端の点どうしで接するものは交差としない
          if (x > x1 + JUMP_RADIUS && x < x2 - JUMP_RADIUS && y > y1 && y < y2) {
            jumps.set(index, [...(jumps.get(index) ?? []), x]);
          }
        }
      }
    });
    return jumps;
  };

  /** 折れ線を、交差の点に飛び越えの半円を入れた path の d にする。 */
  const wirePath = (wire, wires) => {
    const jumps = jumpsFor(wire, wires);
    let d = `M${wire.points[0][0]},${wire.points[0][1]}`;
    segmentsOf(wire.points).forEach((seg, index) => {
      const dir = Math.sign(seg.b[0] - seg.a[0]);
      // 進む向きの順に飛び越える。右へ進むときも左へ進むときも上へふくらませる
      const xs = (jumps.get(index) ?? []).sort((p, q) => (p - q) * dir);
      for (const x of xs) {
        d += ` L${x - JUMP_RADIUS * dir},${seg.a[1]} A${JUMP_RADIUS},${JUMP_RADIUS} 0 0 ${dir > 0 ? 1 : 0} ${x + JUMP_RADIUS * dir},${seg.a[1]}`;
      }
      d += ` L${seg.b[0]},${seg.b[1]}`;
    });
    return d;
  };

  /** 箱の HTML（種類の行・名前・補足と、hint か入力・処理・出力を持つ箱の右上の印）。 */
  const nodeHtml = (node, tips) => {
    const tag = node.tag ?? KIND_TAGS[node.kind];
    const hasTip = hintsOn && Boolean(node.io || node.hint);
    let info = "";
    if (hasTip) {
      const id = tips.add(nodeTipHtml(node), `node:${node.id}`);
      info = `<button class="mdmark-diagram-info" type="button" aria-label="「${esc(node.name)}」の${node.io ? "入力・処理・出力" : "説明"}" aria-describedby="${id}" data-tip-owner="node:${esc(node.id)}">${icon("info")}</button>`;
    }
    const style = node.x === undefined ? "" : ` style="left:${node.x}px;top:${node.y}px;width:${node.w}px;height:${node.h}px"`;
    return `<div class="mdmark-diagram-node${hasTip ? " has-tip" : ""}" data-kind="${node.kind}"${node.shape ? ` data-shape="${node.shape}"` : ""} data-node="${esc(node.id)}"${style}>
      <span class="mdmark-diagram-node-kind">${icon(node.kind)}<span>${withTerms(tag, tips)}</span></span>
      <span class="mdmark-diagram-node-name">${esc(node.name)}</span>
      ${node.sub ? `<span class="mdmark-diagram-node-sub">${withTerms(node.sub, tips)}</span>` : ""}
      ${info}
    </div>`;
  };

  /** 線のラベルの HTML。詳細を持つラベルはフォーカスでき、ツールチップを指す。 */
  const labelHtml = (wire, x, y, tips) => {
    if (!wire.label) return "";
    const style = `left:${x}px;top:${y}px`;
    if (!wire.tip || !hintsOn) return `<span class="mdmark-diagram-label" data-line="${wire.line}" style="${style}">${esc(wire.label)}</span>`;
    const id = tips.add(wireTipHtml(wire.label, wire.tip), wire.id);
    return `<span class="mdmark-diagram-label has-tip" data-line="${wire.line}" tabindex="0" aria-describedby="${id}" data-tip-owner="${esc(wire.id)}" style="${style}">${esc(wire.label)}</span>`;
  };

  /** 線（見える線と、ツールチップを拾う透明の太い線）の SVG。 */
  const wireSvg = (fid, wire, d) =>
    `<path class="mdmark-diagram-wire" data-line="${wire.line}" data-wire="${esc(wire.id)}" d="${d}" marker-end="url(#${fid}-head-${wire.line})"/>` +
    (wire.tip && hintsOn ? `<path class="mdmark-diagram-wire-hit" data-tip-owner="${esc(wire.id)}" d="${d}"/>` : "");

  /** フロー図の本体（枠・層・線・箱・ラベル）を描き、図の大きさを返す。 */
  const renderFlow = (def, fid, tips) => {
    const parts = [];
    const { frame } = def;
    if (frame) {
      parts.push(`<div class="mdmark-diagram-frame" style="left:${frame.x}px;top:${frame.y}px;width:${frame.w}px;height:${frame.h}px"></div>`);
      for (const lane of def.lanes ?? []) {
        parts.push(`<div class="mdmark-diagram-lane" data-kind="${lane.kind}" style="left:${frame.x + 1.5}px;top:${lane.y}px;width:${frame.w - 3}px;height:${lane.h}px"></div>`);
        parts.push(`<span class="mdmark-diagram-lane-label" style="left:${frame.x + 12}px;top:${lane.y + 6}px">${esc(lane.label)}</span>`);
      }
      parts.push(`<span class="mdmark-diagram-frame-title" style="left:${frame.x + 12}px;top:${frame.y + 8}px">${icon("frame")}${esc(frame.title)}</span>`);
    }
    const wires = def.wires.map((wire) => wireSvg(fid, wire, wirePath(wire, def.wires))).join("");
    parts.push(`<svg class="mdmark-diagram-wires" width="${def.width}" height="${def.height}" aria-hidden="true">${wires}</svg>`);
    for (const node of def.nodes) parts.push(nodeHtml(node, tips));
    for (const wire of def.wires) parts.push(labelHtml(wire, wire.labelAt[0], wire.labelAt[1], tips));
    return { html: parts.join(""), width: def.width, height: def.height };
  };

  /** シーケンス図の本体（相手・時刻の軸・メッセージ・繰り返しの帯と戻り）を描き、図の大きさを返す。 */
  const renderSequence = (def, fid, tips) => {
    const col = new Map(def.participants.map((p, i) => [p.id, SEQ_FIRST_X + i * SEQ_COL_GAP]));
    const lastX = SEQ_FIRST_X + (def.participants.length - 1) * SEQ_COL_GAP;
    const rowY = (i) => SEQ_FIRST_Y + i * SEQ_ROW_H;
    const lastY = rowY(def.steps.length - 1);
    const width = lastX + SEQ_HEAD_W / 2 + SEQ_BAND_W;
    const height = lastY + SEQ_ROW_H + 24;
    const bandX = lastX + SEQ_HEAD_W / 2 + 40;
    const parts = [];
    const svg = [];
    // 繰り返しの範囲の面と、右の帯を通って 1 の受け手の縦線へ戻る線。1 のラベルより上を通す
    if (def.loop) {
      svg.push(`<rect class="mdmark-diagram-loop-band" x="12" y="${rowY(0) - 30}" width="${bandX}" height="${lastY - rowY(0) + 48}" rx="8"/>`);
      const backY = rowY(0) - 27;
      const loopWire = { id: `${fid}-loop`, line: "loop", points: [[col.get(def.steps.at(-1).to), lastY + 14], [bandX, lastY + 14], [bandX, backY], [col.get(def.steps[0].to) + 2, backY]] };
      svg.push(wireSvg(fid, loopWire, wirePath(loopWire, [])));
      parts.push(labelHtml({ ...loopWire, label: def.loop.label }, bandX, (lastY + rowY(0)) / 2, tips));
    }
    for (const x of col.values()) svg.push(`<line class="mdmark-diagram-lifeline" x1="${x}" y1="${16 + SEQ_HEAD_H}" x2="${x}" y2="${height - 12}"/>`);
    def.steps.forEach((step, i) => {
      const x1 = col.get(step.from);
      const x2 = col.get(step.to);
      const y = rowY(i);
      const wire = { id: `${fid}-step-${i + 1}`, line: step.reply ? "reply" : "flow", points: [[x1, y], [x2 + Math.sign(x1 - x2) * 2, y]], label: `${i + 1} ${step.label}`, tip: step.tip };
      svg.push(wireSvg(fid, wire, wirePath(wire, [])));
      parts.push(labelHtml(wire, (x1 + x2) / 2, y - 14, tips));
    });
    parts.unshift(`<svg class="mdmark-diagram-wires" width="${width}" height="${height}" aria-hidden="true">${svg.join("")}</svg>`);
    // 相手の名前の行: 別の層にし、縦に動かしても表示枠の上端に留める（attachView が位置を合わせる）
    const heads = def.participants.map((p) => nodeHtml({ ...p, x: col.get(p.id) - SEQ_HEAD_W / 2, y: 16, w: SEQ_HEAD_W, h: SEQ_HEAD_H }, tips));
    parts.push(`<div class="mdmark-diagram-seq-heads" style="width:${width}px;height:${16 + SEQ_HEAD_H + 8}px">${heads.join("")}</div>`);
    return { html: parts.join(""), width, height };
  };

  /** 系列の点の印（1 丸・2 四角・3 三角・4 菱形）の SVG。 */
  const pointSvg = (n, x, y, s = POINT_SIZE) => {
    if (n === 1) return `<circle class="mdmark-diagram-point" cx="${x}" cy="${y}" r="${s}"/>`;
    if (n === 2) return `<rect class="mdmark-diagram-point" x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}"/>`;
    if (n === 3) return `<path class="mdmark-diagram-point" d="M${x},${y - s - 1} L${x + s + 1},${y + s} L${x - s - 1},${y + s} z"/>`;
    return `<path class="mdmark-diagram-point" d="M${x},${y - s - 1} L${x + s + 1},${y} L${x},${y + s + 1} L${x - s - 1},${y} z"/>`;
  };

  /** 軸の範囲を省いたとき: データの最小と最大を含む、1・2・5×10 のべき乗の刻みで目盛りを切る（目盛りは 5 本前後）。zero は 0 を範囲に含めるか。 */
  const niceAxis = (axis, values, zero) => {
    if (axis.min !== undefined && axis.max !== undefined && axis.step !== undefined) return axis;
    const lo = Math.min(...values, ...(zero ? [0] : []));
    const hi = Math.max(...values, ...(zero ? [0] : []));
    const rough = (hi - lo || Math.abs(hi) || 1) / 5;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= rough);
    return { ...axis, min: Math.floor(lo / step) * step, max: Math.ceil(hi / step) * step, step };
  };

  /** 目盛りの値を並べる（刻みの誤差で桁が崩れないよう丸める）。 */
  const ticksOf = (axis) => {
    const list = [];
    for (let i = 0; axis.min + i * axis.step <= axis.max + axis.step / 1000; i += 1) list.push(Number((axis.min + i * axis.step).toPrecision(12)));
    return list;
  };

  /** 系列の塗りの模様（1 塗りつぶし・2 斜線・3 点・4 格子）。折れ線の模様（実線・破線・点線・一点鎖線）と同じ順に、線から面へ移した形。 */
  const fillDefs = (fid) =>
    [1, 2, 3, 4]
      .map((n) => {
        const tint = "fill:color-mix(in srgb, var(--series-color) 22%, var(--mdmark-color-bg))";
        const ink = "stroke:var(--series-color);stroke-width:2;stroke-linecap:square";
        const body = [
          `<rect width="8" height="8" style="fill:var(--series-color)"/>`,
          `<rect width="8" height="8" style="${tint}"/><path d="M-2,2 L2,-2 M0,8 L8,0 M6,10 L10,6" style="${ink}"/>`,
          `<rect width="8" height="8" style="${tint}"/><circle cx="4" cy="4" r="1.8" style="fill:var(--series-color)"/>`,
          `<rect width="8" height="8" style="${tint}"/><path d="M0,0 L8,8 M8,0 L0,8" style="stroke:var(--series-color);stroke-width:1.25"/>`,
        ][n - 1];
        return `<pattern id="${fid}-fill-${n}" data-series="${n}" patternUnits="userSpaceOnUse" width="8" height="8" style="--series-color:var(--mdmark-color-series-${n})">${body}</pattern>`;
      })
      .join("");

  /** 縦の軸（補助線・目盛りの値・軸の名前）と横の軸の線を描く。 */
  const yAxisSvg = (y, yAt, box) => {
    const svg = [];
    for (const v of ticksOf(y)) {
      svg.push(`<line class="mdmark-diagram-grid" x1="${box.left}" y1="${yAt(v)}" x2="${box.right}" y2="${yAt(v)}"/>`);
      svg.push(`<text class="mdmark-diagram-axis-text" x="${box.left - 8}" y="${yAt(v) + 4}" text-anchor="end">${v}</text>`);
    }
    svg.push(`<text class="mdmark-diagram-axis-text" x="${box.left - 8}" y="${box.top - 18}" text-anchor="start">${esc(y.label)}</text>`);
    return svg;
  };

  /** 軸の線と横の軸の名前。 */
  const axisLinesSvg = (x, box) => [
    `<line class="mdmark-diagram-axis" x1="${box.left}" y1="${box.bottom}" x2="${box.right}" y2="${box.bottom}"/>`,
    `<line class="mdmark-diagram-axis" x1="${box.left}" y1="${box.top - 8}" x2="${box.left}" y2="${box.bottom}"/>`,
    `<text class="mdmark-diagram-axis-text" x="${(box.left + box.right) / 2}" y="${box.bottom + 44}" text-anchor="middle">${esc(x.label)}</text>`,
  ];

  /** 横の目盛りが項目の名前の軸（折れ線・棒）の目盛りの値。 */
  const xTicksSvg = (ticks, xAt, box) => ticks.map((t, i) => `<text class="mdmark-diagram-axis-text" x="${xAt(i)}" y="${box.bottom + 20}" text-anchor="middle">${esc(t)}</text>`);

  /** 折れ線: 系列を色と線の模様・点の印の組で引く。 */
  const lineSvg = (def, box) => {
    const ticks = def.x.ticks;
    const y = niceAxis(def.y, def.series.flatMap((s) => s.points), true);
    const xAt = (i) => box.left + (i * (box.right - box.left)) / (ticks.length - 1);
    const yAt = (v) => box.bottom - ((v - y.min) * (box.bottom - box.top)) / (y.max - y.min);
    const svg = [...yAxisSvg(y, yAt, box), ...xTicksSvg(ticks, xAt, box), ...axisLinesSvg(def.x, box)];
    def.series.forEach((series, i) => {
      const n = i + 1;
      const pts = series.points.map((v, j) => [xAt(j), yAt(v)]);
      svg.push(`<path class="mdmark-diagram-series" data-series="${n}" d="M${pts.map((p) => p.join(",")).join(" L")}"/>`);
      svg.push(`<g data-series="${n}">${pts.map(([px, py]) => pointSvg(n, px, py)).join("")}</g>`);
    });
    return { svg, label: def.series.map((s) => `${s.name}: ${s.points.join("・")}`).join("。") };
  };

  /** 棒: 項目ごとに系列の棒を横に並べ、系列を色と塗りの模様の組で分ける。 */
  const barSvg = (def, box, fid) => {
    const ticks = def.x.ticks;
    const y = niceAxis(def.y, def.series.flatMap((s) => s.points), true);
    const band = (box.right - box.left) / ticks.length;
    const xAt = (i) => box.left + band * (i + 0.5);
    const yAt = (v) => box.bottom - ((v - y.min) * (box.bottom - box.top)) / (y.max - y.min);
    const barW = Math.min(28, (band * 0.72) / def.series.length);
    const svg = [...yAxisSvg(y, yAt, box), ...xTicksSvg(ticks, xAt, box)];
    def.series.forEach((series, i) => {
      const n = i + 1;
      const bars = series.points.map((v, j) => {
        const x = xAt(j) - (barW * def.series.length) / 2 + barW * i;
        const top = Math.min(yAt(v), yAt(0));
        return `<rect class="mdmark-diagram-bar" x="${x + 1}" y="${top}" width="${barW - 2}" height="${Math.abs(yAt(v) - yAt(0))}" fill="url(#${fid}-fill-${n})"/>`;
      });
      svg.push(`<g data-series="${n}">${bars.join("")}</g>`);
    });
    svg.push(...axisLinesSvg(def.x, box));
    return { svg, label: def.series.map((s) => `${s.name}: ${s.points.map((v, j) => `${ticks[j]} ${v}`).join("・")}`).join("。") };
  };

  /** 円: 項目の値の割合の角度で扇形を描き、扇形の外に割合を出す。項目の名前と値は凡例が持つ。 */
  const pieSvg = (def, fid) => {
    const cx = CHART_W / 2;
    const cy = CHART_H / 2;
    const r = 118;
    const total = def.items.reduce((sum, item) => sum + item.value, 0);
    const svg = [];
    let angle = -Math.PI / 2;
    def.items.forEach((item, i) => {
      const n = i + 1;
      const sweep = (item.value / total) * Math.PI * 2;
      const end = angle + sweep;
      const at = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
      const [x1, y1] = at(angle, r);
      const [x2, y2] = at(end, r);
      svg.push(`<g data-series="${n}"><path class="mdmark-diagram-slice" d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2},${y2} Z" fill="url(#${fid}-fill-${n})"/></g>`);
      const mid = angle + sweep / 2;
      const [lx, ly] = at(mid, r + 16);
      const anchor = Math.abs(Math.cos(mid)) < 0.2 ? "middle" : Math.cos(mid) > 0 ? "start" : "end";
      svg.push(`<text class="mdmark-diagram-value-text" x="${lx}" y="${ly + 5}" text-anchor="${anchor}">${percentOf(item.value, total)}</text>`);
      angle = end;
    });
    return { svg, label: def.items.map((item) => `${item.name}: ${item.value}${def.unit ?? ""}（${percentOf(item.value, total)}）`).join("。") };
  };

  /** 割合の文字（整数の %）。 */
  const percentOf = (value, total) => `${Math.round((value / total) * 100)}%`;

  /** 散布図: 横と縦の両方を数値の軸にし、系列の点の印だけを置く（線で結ばない）。 */
  const scatterSvg = (def, box) => {
    const x = niceAxis(def.x, def.series.flatMap((s) => s.points.map((p) => p[0])), false);
    const y = niceAxis(def.y, def.series.flatMap((s) => s.points.map((p) => p[1])), false);
    const xAt = (v) => box.left + ((v - x.min) * (box.right - box.left)) / (x.max - x.min);
    const yAt = (v) => box.bottom - ((v - y.min) * (box.bottom - box.top)) / (y.max - y.min);
    const svg = [...yAxisSvg(y, yAt, box)];
    for (const v of ticksOf(x)) {
      svg.push(`<line class="mdmark-diagram-grid" x1="${xAt(v)}" y1="${box.top}" x2="${xAt(v)}" y2="${box.bottom}"/>`);
      svg.push(`<text class="mdmark-diagram-axis-text" x="${xAt(v)}" y="${box.bottom + 20}" text-anchor="middle">${v}</text>`);
    }
    svg.push(...axisLinesSvg(def.x, box));
    def.series.forEach((series, i) => {
      const n = i + 1;
      svg.push(`<g data-series="${n}">${series.points.map(([px, py]) => pointSvg(n, xAt(px), yAt(py), SCATTER_POINT_SIZE)).join("")}</g>`);
    });
    return { svg, label: def.series.map((s) => `${s.name}: ${s.points.map(([px, py]) => `(${px}, ${py})`).join("・")}`).join("。") };
  };

  /** グラフの本体（軸・目盛り・系列）を種類（折れ線・棒・円・散布図）ごとに描き、図の大きさを返す。 */
  const renderChart = (def, fid) => {
    const box = { left: CHART_PAD.left, right: CHART_W - CHART_PAD.right, top: CHART_PAD.top, bottom: CHART_H - CHART_PAD.bottom };
    const type = def.type ?? "line";
    const body = type === "bar" ? barSvg(def, box, fid) : type === "pie" ? pieSvg(def, fid) : type === "scatter" ? scatterSvg(def, box) : lineSvg(def, box);
    const defs = type === "bar" || type === "pie" ? `<defs>${fillDefs(fid)}</defs>` : "";
    return {
      html: `<svg class="mdmark-diagram-wires" width="${CHART_W}" height="${CHART_H}" role="img" aria-label="${esc(`${def.title}。${body.label}`)}">${defs}${body.svg.join("")}</svg>`,
      width: CHART_W,
      height: CHART_H,
    };
  };

  /** 凡例の箱の見本（種類の色の線と地。データは下の角を丸める）。 */
  const kindSample = (kind) => {
    const shape = kind === "data" ? '<path d="M1,1 H17 V9 Q17,13 13,13 H5 Q1,13 1,9 Z"/>' : '<rect x="1" y="1" width="16" height="12" rx="3"/>';
    return `<svg class="mdmark-diagram-legend-sample" data-kind="${kind}" width="18" height="14" aria-hidden="true" style="fill:color-mix(in srgb, var(--node-color) 10%, var(--mdmark-color-bg));stroke:var(--node-color);stroke-width:1.5">${shape}</svg>`;
  };

  /** 凡例の線の見本（線の模様と矢じり）。 */
  const lineSample = (fid, line) =>
    `<svg class="mdmark-diagram-legend-sample" width="34" height="12" aria-hidden="true"><path class="mdmark-diagram-wire" data-line="${line}" d="M1,6 H32" marker-end="url(#${fid}-head-${line})"/></svg>`;

  /** 凡例の系列の見本（線の模様と点の印）。 */
  const seriesSample = (n) =>
    `<svg class="mdmark-diagram-legend-sample" width="34" height="12" aria-hidden="true"><path class="mdmark-diagram-series" data-series="${n}" d="M1,6 H33"/><g data-series="${n}">${pointSvg(n, 17, 6)}</g></svg>`;

  /** 凡例の棒・扇形の見本（系列の色と塗りの模様）。 */
  const fillSample = (fid, n) =>
    `<svg class="mdmark-diagram-legend-sample" width="18" height="14" aria-hidden="true"><g data-series="${n}"><rect class="mdmark-diagram-bar" x="1" y="1" width="16" height="12" fill="url(#${fid}-fill-${n})"/></g></svg>`;

  /** 凡例の散布図の点の見本（点の印だけ）。 */
  const pointSample = (n) => `<svg class="mdmark-diagram-legend-sample" width="14" height="14" aria-hidden="true"><g data-series="${n}">${pointSvg(n, 7, 7, SCATTER_POINT_SIZE)}</g></svg>`;

  /** 図の定義に出る色・形・線・矢じり・印を全て載せた凡例の項目。 */
  const legendItems = (def, fid) => {
    const item = (sample, text) => `<li class="mdmark-diagram-legend-item">${sample}<span>${text}</span></li>`;
    if (def.kind === "chart") {
      const type = def.type ?? "line";
      if (type === "bar") return def.series.map((s, i) => item(fillSample(fid, i + 1), esc(s.name)));
      if (type === "pie") return def.items.map((it, i) => item(fillSample(fid, i + 1), `${esc(it.name)}（${esc(it.value)}${esc(def.unit ?? "")}）`));
      if (type === "scatter") return def.series.map((s, i) => item(pointSample(i + 1), esc(s.name)));
      return def.series.map((s, i) => item(seriesSample(i + 1), esc(s.name)));
    }
    const nodes = def.kind === "sequence" ? def.participants : def.nodes;
    const kinds = Object.keys(KIND_LEGEND).filter((k) => nodes.some((n) => n.kind === k));
    const lines = new Set(def.kind === "sequence" ? def.steps.map((s) => (s.reply ? "reply" : "flow")) : def.wires.map((w) => w.line));
    if (def.loop) lines.add("loop");
    const items = kinds.map((k) => item(kindSample(k), k === "external" && def.frame ? KIND_LEGEND[k] + OUTSIDE_FRAME : KIND_LEGEND[k]));
    if (def.frame) {
      items.push(item('<svg class="mdmark-diagram-legend-sample" width="18" height="14" aria-hidden="true"><rect x="1" y="1" width="16" height="12" rx="4" fill="none" stroke="var(--mdmark-color-muted)" stroke-width="1.5"/></svg>', "システムの枠"));
      items.push(item('<svg class="mdmark-diagram-legend-sample" width="18" height="14" aria-hidden="true"><rect x="0" y="0" width="18" height="14" rx="2" fill="color-mix(in srgb, var(--mdmark-color-diagram-llm) 14%, var(--mdmark-color-bg))"/></svg>', "層の背景（層の箱の色）"));
    }
    for (const line of Object.keys(LINE_LEGEND)) if (lines.has(line)) items.push(item(lineSample(fid, line), LINE_LEGEND[line]));
    if (def.kind === "flow" && def.wires.some((w) => jumpsFor(w, def.wires).size)) {
      items.push(item('<svg class="mdmark-diagram-legend-sample" width="34" height="14" aria-hidden="true"><path d="M17,0 V14" stroke="var(--mdmark-color-diagram-line)" stroke-width="1.5"/><path d="M1,9 H11 A6,6 0 0 1 23,9 H33" fill="none" stroke="var(--mdmark-color-diagram-line)" stroke-width="1.5"/></svg>', "線の交差（横の線が飛び越える）"));
    }
    if (hintsOn && nodes.some((n) => n.io || n.hint)) {
      const io = nodes.some((n) => n.io);
      const hint = nodes.some((n) => n.hint && !n.io);
      const text = io && hint ? "説明や入力・処理・出力が出る箱" : io ? "入力・処理・出力が出る箱" : "説明が出る箱";
      items.push(item(`<svg class="mdmark-diagram-legend-sample" width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:var(--mdmark-color-muted);stroke-width:2.25;stroke-linecap:round">${ICONS.info}</svg>`, text));
    }
    // 下線: 箱の中の用語（意味が出る）と、線のラベル（送るものの詳細が出る）を 1 項目にまとめる
    const hasTerm = nodes.some((n) => `${n.tag ?? ""}${n.sub ?? ""}`.includes("{{"));
    const hasTip = hintsOn && (def.kind === "flow" ? def.wires.some((w) => w.tip) : def.steps.some((s) => s.tip));
    const underline = hasTerm && hasTip ? "用語の意味・送るものの詳細が出る" : hasTerm ? "用語の意味が出る" : "送るものの詳細が出る";
    if (hasTerm || hasTip) items.push(item("", `<span class="mdmark-diagram-legend-term">下線</span>（${underline}）`));
    return items;
  };

  /** 右上のボタンの帯（移動・拡大と縮小・全画面）の HTML。モーダルの中では全画面のボタンの代わりに閉じるボタンを置く。 */
  const toolsHtml = (title, modal) => {
    const tool = (name, label, iconName) => `<button class="mdmark-diagram-tool" type="button" data-tool="${name}" aria-label="${label}">${icon(iconName)}</button>`;
    return `<div class="mdmark-diagram-tools" role="toolbar" aria-label="「${esc(title)}」の表示">
      <div class="mdmark-diagram-tools-group" data-group="pan" hidden>
        ${tool("left", "左へ動かす", "left")}${tool("up", "上へ動かす", "up")}${tool("down", "下へ動かす", "down")}${tool("right", "右へ動かす", "right")}
      </div>
      <div class="mdmark-diagram-tools-group" data-group="zoom">
        ${tool("out", "縮小", "zoomOut")}<button class="mdmark-diagram-tool mdmark-diagram-zoom" type="button" data-tool="fit">100%</button>${tool("in", "拡大", "zoomIn")}
      </div>
      <div class="mdmark-diagram-tools-group" data-group="screen">
        ${modal ? tool("close", "全画面を閉じる", "close") : tool("fullscreen", "全画面で開く", "fullscreen")}
      </div>
    </div>`;
  };

  /** 図の本体を種類ごとに描く。 */
  const renderBody = (def, fid, tips) => {
    if (def.kind === "sequence") return renderSequence(def, fid, tips);
    if (def.kind === "chart") return renderChart(def, fid);
    return renderFlow(def, fid, tips);
  };

  /** figure に図の部品を描き、操作を付ける。getDef は全画面で開くときの今の定義、modal はモーダルの中に描くか。 */
  const mountDiagram = (figure, def, { getDef = () => def, modal = false } = {}) => {
    figureCount += 1;
    const fid = `mdmark-diagram-${figureCount}`;
    hintsOn = !figure.closest('[data-mock-hints="off"]');
    const tips = createTips(fid);
    const body = renderBody(def, fid, tips);
    figure.classList.add("mdmark-diagram");
    figure.dataset.kind = def.kind;
    figure.innerHTML = `
      <figcaption class="mdmark-diagram-head" id="${fid}-title">
        <span class="mdmark-diagram-title">${esc(def.title)}</span>
        <span class="mdmark-diagram-meta">範囲: ${esc(def.scope)}・更新日: <time datetime="${def.updated}">${def.updated}</time></span>
      </figcaption>
      <div class="mdmark-diagram-box">
        ${toolsHtml(def.title, modal)}
        <div class="mdmark-diagram-viewport" tabindex="0" role="group" aria-roledescription="図" aria-labelledby="${fid}-title" aria-keyshortcuts="+ - 0 ArrowLeft ArrowUp ArrowDown ArrowRight">
          <div class="mdmark-diagram-sizer"><div class="mdmark-diagram-stage" style="width:${body.width}px;height:${body.height}px">${body.html}</div></div>
        </div>
        ${tips.list.map((t) => `<div class="mdmark-diagram-tip" id="${t.id}" role="tooltip" data-tip-for="${esc(t.label)}" hidden>${t.html}</div>`).join("")}
      </div>
      <ul class="mdmark-diagram-legend" aria-label="凡例">${legendItems(def, fid).join("")}</ul>
      <svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${markerDefs(fid)}</defs></svg>`;
    const view = attachView(figure, body.width, body.height, modal);
    attachTips(figure);
    figure.querySelector('[data-tool="fullscreen"]')?.addEventListener("click", (event) => openFullscreen(getDef(), event.currentTarget));
    return { view, fid, tips };
  };

  /** 図をモーダルに開く。閉じたら（閉じるボタン・Esc）モーダルを消し、全画面のボタンへフォーカスを戻す。 */
  const openFullscreen = (def, opener) => {
    const dialog = document.createElement("dialog");
    dialog.className = "mdmark mdmark-diagram-dialog";
    // ヒントを外した文書の図は、全画面でもヒントを出さない
    if (opener.closest('[data-mock-hints="off"]')) dialog.dataset.mockHints = "off";
    dialog.innerHTML = "<figure></figure>";
    document.body.append(dialog);
    dialog.showModal();
    const figure = dialog.querySelector("figure");
    mountDiagram(figure, def, { modal: true });
    dialog.setAttribute("aria-labelledby", figure.querySelector(".mdmark-diagram-head").id);
    figure.querySelector('[data-tool="close"]').addEventListener("click", () => dialog.close());
    figure.querySelector(".mdmark-diagram-viewport").focus();
    dialog.addEventListener("close", () => {
      dialog.remove();
      opener.focus();
    });
  };

  /** 倍率と位置の操作（右上のボタン・キー・ドラッグ・Shift＋ホイール）を付け、図の大きさを差し替える口を返す。 */
  const attachView = (figure, width, height, modal) => {
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    const sizer = figure.querySelector(".mdmark-diagram-sizer");
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const zoomText = figure.querySelector(".mdmark-diagram-zoom");
    const panGroup = figure.querySelector('[data-group="pan"]');
    const button = (name) => figure.querySelector(`[data-tool="${name}"]`);
    const state = { scale: 1, fit: 1, atFit: true, width, height };

    /** シーケンス図の相手の名前の行を、表示枠の上端に留める（図の座標で縦に動いた分だけ下げる）。 */
    const heads = figure.querySelector(".mdmark-diagram-seq-heads");
    const stickHeads = () => {
      if (!heads) return;
      heads.style.transform = `translateY(${viewport.scrollTop / state.scale}px)`;
      heads.classList.toggle("is-stuck", viewport.scrollTop > 0);
    };
    viewport.addEventListener("scroll", stickHeads, { passive: true });

    /** 枠に図の全体が収まる倍率。文書の中は幅だけ、モーダルの中は幅と高さで決める。 */
    const fitScale = () => Math.min(1, viewport.clientWidth / state.width, modal ? viewport.clientHeight / state.height : 1);

    /** 倍率を当て、ボタンの有効・無効と移動のボタンの有無を合わせる。 */
    const apply = (scale) => {
      state.scale = scale;
      stage.style.transform = `scale(${scale})`;
      sizer.style.width = `${state.width * scale}px`;
      sizer.style.height = `${state.height * scale}px`;
      stickHeads();
      // 今の倍率のボタン: 倍率を出し、押すと開いたときの倍率と位置に戻ることを読み上げの名前に書く
      zoomText.textContent = `${Math.round(scale * 100)}%`;
      zoomText.setAttribute("aria-label", `倍率 ${zoomText.textContent}。全体が収まる倍率に戻す`);
      button("out").disabled = scale <= state.fit + ZOOM_EPSILON;
      button("in").disabled = scale >= ZOOM_MAX - ZOOM_EPSILON;
      // 図の全体が見えている間は、移動のボタンは何も動かさないので出さない
      panGroup.hidden = state.width * scale <= viewport.clientWidth + 1 && state.height * scale <= viewport.clientHeight + 1;
      // 押したボタンが押せなくなった・消えたときは、フォーカスを表示枠へ移して失わせない
      if (figure.contains(document.activeElement) && (document.activeElement.disabled || panGroup.contains(document.activeElement) && panGroup.hidden)) {
        viewport.focus({ preventScroll: true });
      }
    };

    /** 開いたときの倍率（全体が収まる倍率）と位置に戻す。文書の中では表示枠の高さを全体が収まる高さにする（モーダルの中はモーダルの高さに合わせる）。 */
    const reset = () => {
      state.fit = fitScale();
      state.atFit = true;
      if (!modal) viewport.style.height = `${state.height * state.fit}px`;
      apply(state.fit);
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    };

    /** 表示枠の中央を保ったまま倍率を変える。 */
    const zoomTo = (scale) => {
      const next = Math.min(ZOOM_MAX, Math.max(state.fit, scale));
      const cx = (viewport.scrollLeft + viewport.clientWidth / 2) / state.scale;
      const cy = (viewport.scrollTop + viewport.clientHeight / 2) / state.scale;
      state.atFit = Math.abs(next - state.fit) < ZOOM_EPSILON;
      apply(next);
      viewport.scrollLeft = cx * next - viewport.clientWidth / 2;
      viewport.scrollTop = cy * next - viewport.clientHeight / 2;
      if (state.atFit) reset();
    };

    /** 図を動かす（右・下が正）。 */
    const pan = (dx, dy) => {
      viewport.scrollLeft += dx;
      viewport.scrollTop += dy;
      state.atFit = false;
    };

    const actions = {
      in: () => zoomTo(state.scale * ZOOM_STEP),
      out: () => zoomTo(state.scale / ZOOM_STEP),
      fit: reset,
      left: () => pan(-PAN_STEP, 0),
      right: () => pan(PAN_STEP, 0),
      up: () => pan(0, -PAN_STEP),
      down: () => pan(0, PAN_STEP),
    };
    for (const [name, run] of Object.entries(actions)) button(name)?.addEventListener("click", run);

    // キー: 表示の箱（右上のボタンと表示枠）にフォーカスがあるとき、+・-・0 で拡大・縮小・戻す、矢印キーで動かす（動かせる向きがあるときだけ文書のスクロールを止める）
    const keys = { "+": "in", "=": "in", "-": "out", 0: "fit", ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    figure.querySelector(".mdmark-diagram-box").addEventListener("keydown", (event) => {
      const name = keys[event.key];
      if (!name || event.ctrlKey || event.metaKey || event.altKey) return;
      if (name in { left: 1, right: 1, up: 1, down: 1 } && panGroup.hidden) return;
      event.preventDefault();
      actions[name]();
    });

    // ドラッグ: 文字と押せる所の外でつかんで動かす。ドラッグ中は文字を選ばせない
    let drag = null;
    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest(`${TEXT_SELECTOR}, ${CONTROL_SELECTOR}`)) return;
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, id: event.pointerId };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
      if (event.clientX !== drag.x || event.clientY !== drag.y) {
        state.atFit = false;
      }
    });
    const endDrag = () => {
      drag = null;
      viewport.classList.remove("is-dragging");
    };
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    // Shift＋ホイールで動かしたとき（横のスクロール）も、開いたときの位置から外れたことにする
    viewport.addEventListener("scroll", () => {
      if (viewport.scrollLeft || viewport.scrollTop) {
        state.atFit = false;
      }
    });

    // 枠の大きさが変わったとき（画面の幅・ページの縦のスクロールバーの出入り・モーダルの高さ）: 全体が収まる倍率で見ていたなら、新しい大きさで全体が収まる倍率に合わせ直す。
    // 文書の中では高さは reset が決めるので、幅の変化だけを見る
    let lastSize = `${viewport.clientWidth}x${modal ? viewport.clientHeight : 0}`;
    new ResizeObserver(() => {
      const size = `${viewport.clientWidth}x${modal ? viewport.clientHeight : 0}`;
      if (size === lastSize) return;
      lastSize = size;
      if (state.atFit) reset();
      else {
        state.fit = fitScale();
        apply(Math.max(state.fit, state.scale));
      }
    }).observe(viewport);

    reset();

    // モックの見本: 開いたときの倍率と位置を変えて見せる
    if (figure.dataset.mockZoom) {
      zoomTo(Number(figure.dataset.mockZoom));
      const [x, y] = (figure.dataset.mockScroll ?? "0,0").split(",").map(Number);
      viewport.scrollLeft = x * state.scale;
      viewport.scrollTop = y * state.scale;
    }

    return {
      /** 図の大きさを差し替える（操作できる部品がグラフを描き直したとき）。今の倍率を保つ。 */
      resize: (w, h) => {
        state.width = w;
        state.height = h;
        apply(state.scale);
      },
    };
  };

  /** 図のツールチップ（線の詳細・箱の入力・処理・出力・箱の中の用語）の操作を付ける。ポインターとフォーカスで開き、上に乗っても消えず、Esc で閉じる。 */
  const attachTips = (figure) => {
    const box = figure.querySelector(".mdmark-diagram-box");
    const tips = new Map([...figure.querySelectorAll(".mdmark-diagram-tip")].map((tip) => [tip.dataset.tipFor, tip]));
    let current = null;
    let pinned = null;
    let closeTimer = null;

    /** 持ち主の名前から、ツールチップを置く基準の要素（フォーカスできる要素）を引く。 */
    const anchorOf = (owner) => figure.querySelector(`[data-tip-owner="${CSS.escape(owner)}"]:not(.mdmark-diagram-wire-hit)`);

    /** ツールチップを持ち主の下（収まらなければ上）に、画面からはみ出さないよう置く。 */
    const place = (tip, anchor) => {
      const target = anchor.classList.contains("mdmark-diagram-info") ? anchor.closest(".mdmark-diagram-node") : anchor;
      const a = target.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const { width, height } = tip.getBoundingClientRect();
      const above = a.bottom + TIP_GAP_PX + height > window.innerHeight && a.top - TIP_GAP_PX - height >= 0;
      const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(a.left, window.innerWidth - width - VIEWPORT_MARGIN_PX));
      tip.style.left = `${left - b.left}px`;
      tip.style.top = `${(above ? a.top - TIP_GAP_PX - height : a.bottom + TIP_GAP_PX) - b.top}px`;
    };

    /** ツールチップを閉じ、持ち主の線の強調を外す。 */
    const close = () => {
      clearTimeout(closeTimer);
      if (!current) return;
      tips.get(current).hidden = true;
      figure.querySelector(`.mdmark-diagram-wire[data-wire="${CSS.escape(current)}"]`)?.classList.remove("is-active");
      current = null;
    };

    /** ほかのツールチップを閉じてから、この持ち主のツールチップを開く。開いたままの見本があるときは開き直さない。 */
    const open = (owner) => {
      clearTimeout(closeTimer);
      if (pinned || owner === current) return;
      close();
      const tip = tips.get(owner);
      if (!tip) return;
      tip.hidden = false;
      place(tip, anchorOf(owner));
      figure.querySelector(`.mdmark-diagram-wire[data-wire="${CSS.escape(owner)}"]`)?.classList.add("is-active");
      current = owner;
    };

    /** ポインターもフォーカスも持ち主とツールチップを離れたら、少し待って閉じる。 */
    const closeLater = () => {
      clearTimeout(closeTimer);
      if (pinned) return;
      closeTimer = setTimeout(() => {
        const tip = current && tips.get(current);
        if (tip && (tip.matches(":hover") || anchorOf(current)?.matches(":hover, :focus"))) return;
        close();
      }, CLOSE_DELAY_MS);
    };

    // 持ち主: 線のラベル・透明の太い線・箱の印・箱の中の用語。箱の説明・入力・処理・出力は右上の印でだけ開く（箱の印の外では開かない）
    for (const owner of figure.querySelectorAll("[data-tip-owner]")) {
      owner.addEventListener("pointerenter", () => open(owner.dataset.tipOwner));
      owner.addEventListener("pointerleave", closeLater);
      owner.addEventListener("focus", () => open(owner.dataset.tipOwner));
      owner.addEventListener("blur", closeLater);
    }
    for (const tip of tips.values()) {
      tip.addEventListener("pointerenter", () => clearTimeout(closeTimer));
      tip.addEventListener("pointerleave", closeLater);
    }

    // Esc: 開いているツールチップを閉じ、フォーカスは持ち主に残す（ポインターで開いてフォーカスが図の外にあるときも閉じる）
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !current || pinned) return;
      // 全画面のモーダルの中では、ツールチップだけを閉じてモーダルは閉じない
      event.preventDefault();
      close();
    });

    // 図を動かしたとき・画面をスクロールしたとき: 開いているツールチップを持ち主に付いて動かす
    const follow = () => {
      if (current) place(tips.get(current), anchorOf(current));
    };
    figure.querySelector(".mdmark-diagram-viewport").addEventListener("scroll", follow, { passive: true });
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);

    // 印刷の前: 開いているツールチップを閉じる（紙には出さない）
    window.addEventListener("beforeprint", close);

    // モックの見本: 開いた状態のまま見せる
    if (figure.dataset.mockOpen) {
      requestAnimationFrame(() => {
        open(figure.dataset.mockOpen);
        pinned = figure.dataset.mockOpen;
      });
    }
  };

  /** 操作できる部品のグラフの系列: 今の値と既定の値で、経過ごとの返信の進みを計算する。 */
  const paramSeries = (knob, value) => {
    const progress = (strength) => [0, 2, 4, 6, 8, 10].map((t) => Math.round(100 * (1 - Math.exp((-strength * t) / 20))));
    return [
      { name: `今の値（${value}）`, points: progress(value) },
      { name: `既定の値（${knob.value}）`, points: progress(knob.value) },
    ];
  };

  /** 今の値を JSON にする（スライダーの名前と今の値）。 */
  const paramJson = (knob, value) => JSON.stringify({ [knob.key]: { name: knob.label, value } }, null, 2);

  /** 要素に操作できる部品（スライダー・今の値を写すボタン・グラフ）を描き、操作を付ける。 */
  const mountParam = (root, def) => {
    figureCount += 1;
    const pid = `mdmark-param-${figureCount}`;
    const { knob } = def;
    let value = Number(root.dataset.mockValue ?? knob.value);
    root.classList.add("mdmark-param");
    root.setAttribute("role", "group");
    root.setAttribute("aria-labelledby", `${pid}-title`);
    root.innerHTML = `
      <p class="mdmark-param-title" id="${pid}-title">${esc(def.title)}</p>
      <div class="mdmark-param-controls">
        <div class="mdmark-param-knob">
          <label for="${pid}-knob">${esc(knob.label)}</label>
          <output for="${pid}-knob" id="${pid}-value">${value}</output>
          <input type="range" id="${pid}-knob" min="${knob.min}" max="${knob.max}" step="${knob.step}" value="${value}">
          <span class="mdmark-param-range" aria-hidden="true"><small>${knob.min}</small><small>${knob.max}</small></span>
        </div>
        <div class="mdmark-param-actions">
          <button class="mdmark-param-copy" type="button">${icon("copy")}今の値を写す</button>
          <p class="mdmark-param-status" role="status"></p>
        </div>
        <pre class="mdmark-param-fallback" hidden tabindex="0" aria-label="写す JSON"><code></code></pre>
      </div>
      <figure></figure>`;
    const figure = root.querySelector("figure");
    const chartDef = () => ({ kind: "chart", ...def.chart, series: paramSeries(knob, value) });
    const { view } = mountDiagram(figure, chartDef(), { getDef: chartDef });
    const input = root.querySelector("input");
    const output = root.querySelector("output");
    const status = root.querySelector(".mdmark-param-status");
    const fallback = root.querySelector(".mdmark-param-fallback");

    /** グラフを今の値で描き直す（題・凡例・倍率は保つ）。 */
    const redraw = () => {
      const def2 = chartDef();
      const body = renderChart(def2, "");
      figure.querySelector(".mdmark-diagram-stage").innerHTML = body.html;
      figure.querySelector(".mdmark-diagram-legend").innerHTML = legendItems(def2, "").join("");
      view.resize(body.width, body.height);
    };

    /** 写したか・写せなかったかを知らせる。写せなかったときは、選んで写せる JSON を出す。 */
    const notify = (ok, json) => {
      status.dataset.state = ok ? "copied" : "failed";
      status.innerHTML = ok
        ? `${icon("check")}クリップボードに写しました`
        : `${icon("alert")}クリップボードへ書けませんでした。下の JSON を選んで写してください`;
      fallback.hidden = ok;
      fallback.querySelector("code").textContent = json;
    };

    input.addEventListener("input", () => {
      value = Number(input.value);
      output.textContent = String(value);
      // 値を変えたら前の知らせは古くなるので消す
      status.textContent = "";
      delete status.dataset.state;
      fallback.hidden = true;
      redraw();
    });

    root.querySelector(".mdmark-param-copy").addEventListener("click", async () => {
      const json = paramJson(knob, value);
      try {
        if (root.dataset.mockCopy === "failed" || !navigator.clipboard) throw new Error("クリップボードを使えない");
        await navigator.clipboard.writeText(json);
        notify(true, json);
      } catch {
        notify(false, json);
      }
    });

    // モックの見本: 写した・写せなかったの知らせを出したまま見せる
    if (root.dataset.mockCopy) notify(root.dataset.mockCopy === "copied", paramJson(knob, value));
  };

  for (const figure of document.querySelectorAll("[data-mock-diagram]")) {
    mountDiagram(figure, window.mdmarkMockDiagrams[figure.dataset.mockDiagram]);
  }
  for (const root of document.querySelectorAll("[data-mock-param]")) {
    mountParam(root, window.mdmarkMockParams[root.dataset.mockParam]);
  }
}
