// map の軸と格子の配置の図のモック: gantt・timeline・gitGraph・journey・block-beta の Mermaid と補足を、日付・記載順の軸か columns の格子に沿って描く。
// 図の枠・拡大と縮小・リサイズハンドル・説明のマーカーは今のフロー図の部品（flow）を使用し、種類ごとの配置・section と入れ子の開閉・中へ入る・選択・再生をここで追加する

import { mount } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.12.0/dist/index.js";

const SVG = "http://www.w3.org/2000/svg";
/** section・ブランチごとに順に割り当てる色の名前 */
const COLORS = ["blue", "green", "orange", "purple", "red", "yellow"];
/** 図の外周の余白 */
const MARGIN = 24;
/** 最初に表示する枠の高さの上限 */
const MAX_INITIAL_HEIGHT = 520;
/** 今日の日付（モックでは固定する） */
const TODAY = "2026-11-12";

/** 今の図のボタンと同じ Lucide のアイコン */
const ICONS = {
  back: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  expandAll: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  collapseAll: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  enter: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  collapse: '<path d="m6 9 6 6 6-6"/>',
  expand: '<path d="m9 18 6-6-6-6"/>',
  prev: '<path d="m15 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  resize: '<line x1="5" x2="19" y1="9" y2="9"/><line x1="5" x2="19" y1="15" y2="15"/>',
};
const icon = (name) =>
  `<svg class="mdmark-diagram-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
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

/* ---------- 日付 ---------- */

const DAY = 24 * 60 * 60 * 1000;
const toDate = (text) => new Date(`${text}T00:00:00Z`);
const isWeekend = (date) => [0, 6].includes(date.getUTCDay());
/** 期間の日数を、土日を数えずに足す */
const addWorkdays = (start, days, excludeWeekends) => {
  let date = new Date(start);
  let left = days;
  while (left > 0) {
    if (!(excludeWeekends && isWeekend(date))) left -= 1;
    date = new Date(date.getTime() + DAY);
  }
  return date;
};
const dateLabel = (date) => `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;

/* ---------- 読み取り ---------- */

/** section を持つ種類の共通: 記載順の section と、同じ名前の section の状態のキー（記載順の s{番号}） */
const keySections = (sections) => {
  const counts = new Map();
  for (const section of sections) counts.set(section.label, (counts.get(section.label) ?? 0) + 1);
  sections.forEach((section, index) => {
    section.key = section.label;
    section.stateKey = counts.get(section.label) > 1 ? `s${index + 1}` : section.label;
    section.color = COLORS[index % COLORS.length];
  });
  return sections;
};

/** gantt: section・タスク（開始・終了・after・done / active / crit / milestone）を読み、開始日と終了日を決める */
const parseGantt = (source) => {
  const lines = source.split("\n").slice(1);
  const model = { title: undefined, excludeWeekends: false, todayMarker: true, sections: [], items: [], problems: [] };
  let section;
  lines.forEach((raw, index) => {
    const text = raw.trim();
    if (!text || text.startsWith("%%")) return;
    if (text.startsWith("title ")) model.title = text.slice(6).trim();
    else if (text.startsWith("dateFormat") || text.startsWith("axisFormat")) return;
    else if (text === "excludes weekends") model.excludeWeekends = true;
    else if (text === "todayMarker off") model.todayMarker = false;
    else if (text.startsWith("section ")) {
      section = { label: text.slice(8).trim(), items: [] };
      model.sections.push(section);
    } else {
      const match = /^(.+?)\s*:(.+)$/.exec(text);
      const parts = match ? match[2].split(",").map((part) => part.trim()) : [];
      const tags = parts.filter((part) => ["done", "active", "crit", "milestone"].includes(part));
      const rest = parts.filter((part) => !tags.includes(part));
      const valid = match && rest.length >= 2 && rest.length <= 3 && /^(\d{4}-\d{2}-\d{2}|after \S+)$/.test(rest.at(-2)) && /^(\d{4}-\d{2}-\d{2}|\d+d)$/.test(rest.at(-1));
      if (!valid) {
        model.problems.push(`${index + 2} 行目「${text}」: タスクの開始と終了か期間を読めないため、この行を読み飛ばしました`);
        return;
      }
      const item = { label: match[1].trim(), id: rest.length === 3 ? rest[0] : undefined, start: rest.at(-2), end: rest.at(-1), tags, section, order: model.items.length };
      model.items.push(item);
      section?.items.push(item);
    }
  });
  const byId = new Map(model.items.filter((item) => item.id).map((item) => [item.id, item]));
  for (const item of model.items) {
    if (item.start.startsWith("after ")) {
      item.after = byId.get(item.start.slice(6));
      item.from = item.after.to;
    } else item.from = toDate(item.start);
    item.to = /^\d+d$/.test(item.end) ? addWorkdays(item.from, Number.parseInt(item.end, 10), model.excludeWeekends) : new Date(toDate(item.end).getTime() + DAY);
    item.key = item.id ?? item.label;
  }
  keySections(model.sections);
  return model;
};

/** timeline: section・期間・出来事（`: 出来事` を続けて書く）を読む */
const parseTimeline = (source) => {
  const model = { title: undefined, sections: [], items: [], events: [], problems: [] };
  let section;
  source.split("\n").slice(1).forEach((raw) => {
    const text = raw.trim();
    if (!text) return;
    if (text.startsWith("title ")) model.title = text.slice(6).trim();
    else if (text.startsWith("section ")) {
      section = { label: text.slice(8).trim(), items: [] };
      model.sections.push(section);
    } else {
      const [period, ...events] = text.split(":").map((part) => part.trim());
      const item = { label: period, key: period, section, order: model.items.length, events: [] };
      for (const label of events) {
        const event = { label, key: label, period: item, order: model.events.length };
        item.events.push(event);
        model.events.push(event);
      }
      model.items.push(item);
      section?.items.push(item);
    }
  });
  keySections(model.sections);
  return model;
};

/** gitGraph: commit・branch・checkout・merge・cherry-pick を記載順に読み、ブランチの横の線と親の commit を決める */
const parseGitGraph = (source) => {
  const model = { branches: [{ name: "main", order: 0 }], items: [], problems: [] };
  const heads = new Map([["main", undefined]]);
  let current = "main";
  const attr = (text, name) => /"([^"]*)"/.exec(text.split(`${name}:`)[1] ?? "")?.[1];
  source.split("\n").slice(1).forEach((raw) => {
    const text = raw.trim();
    if (!text) return;
    const [command] = text.split(/\s+/);
    if (command === "branch") {
      const name = text.split(/\s+/)[1];
      model.branches.push({ name, order: model.branches.length, from: heads.get(current) });
      heads.set(name, heads.get(current));
      current = name;
    } else if (command === "checkout") current = text.split(/\s+/)[1];
    else if (["commit", "merge", "cherry-pick"].includes(command)) {
      const order = model.items.length + 1;
      const item = {
        kind: command,
        id: command === "cherry-pick" ? undefined : attr(text, "id"),
        msg: attr(text, "msg"),
        tag: attr(text, "tag"),
        type: /type:\s*(\w+)/.exec(text)?.[1] ?? "NORMAL",
        branch: current,
        order,
        parents: [heads.get(current)].filter(Boolean),
      };
      if (command === "merge") {
        const source_ = text.split(/\s+/)[1];
        item.mergeFrom = source_;
        item.parents.push(heads.get(source_));
        item.label = `${source_} を取り込む`;
      }
      if (command === "cherry-pick") item.pickOf = attr(text, "id");
      item.key = item.id ?? item.msg ?? `c${order}`;
      item.label ??= item.id ?? item.msg ?? (command === "cherry-pick" ? `${item.pickOf} を取り込む` : "");
      heads.set(current, item);
      model.items.push(item);
    }
  });
  return model;
};

/** journey: section・タスク・点数・人を読む */
const parseJourney = (source) => {
  const model = { title: undefined, sections: [], items: [], actors: [], problems: [] };
  let section;
  source.split("\n").slice(1).forEach((raw) => {
    const text = raw.trim();
    if (!text) return;
    if (text.startsWith("title ")) model.title = text.slice(6).trim();
    else if (text.startsWith("section ")) {
      section = { label: text.slice(8).trim(), items: [] };
      model.sections.push(section);
    } else {
      const [label, score, people] = text.split(":").map((part) => part.trim());
      const actors = people.split(",").map((name) => name.trim());
      for (const name of actors) if (!model.actors.includes(name)) model.actors.push(name);
      const item = { label, key: label, score: Number(score), actors, section, order: model.items.length };
      model.items.push(item);
      section?.items.push(item);
    }
  });
  keySections(model.sections);
  return model;
};

/** block-beta: columns・ブロック（幅 :{数}・形状）・space・入れ子の block … end・線を読む */
const parseBlock = (source) => {
  const SHAPES = [
    ["cylinder", /^(\w+)\[\("(.+)"\)\](?::(\d+))?$/],
    ["circle", /^(\w+)\(\("(.+)"\)\)(?::(\d+))?$/],
    ["square", /^(\w+)\["(.+)"\](?::(\d+))?$/],
    ["rounded", /^(\w+)\("(.+)"\)(?::(\d+))?$/],
  ];
  const root = { key: undefined, columns: 3, children: [] };
  const stack = [root];
  const model = { root, items: [], groups: [], wires: [], problems: [] };
  source.split("\n").slice(1).forEach((raw) => {
    const text = raw.trim();
    if (!text) return;
    const parent = stack.at(-1);
    if (text.startsWith("columns ")) parent.columns = Number(text.split(/\s+/)[1]);
    else if (text.startsWith("block:")) {
      const group = { key: text.slice(6).trim(), label: text.slice(6).trim(), columns: 1, children: [], span: 1, parent, isGroup: true };
      parent.children.push(group);
      model.groups.push(group);
      stack.push(group);
    } else if (text === "end") stack.pop();
    else if (/-->/.test(text)) {
      const match = /^(\w+)\s*(?:--\s*"(.+)"\s*)?-->\s*(\w+)$/.exec(text);
      if (match) model.wires.push({ from: match[1], to: match[3], label: match[2] });
    } else {
      for (const token of text.match(/\w+(?:\[\(".*?"\)\]|\(\(".*?"\)\)|\[".*?"\]|\(".*?"\))(?::\d+)?|space/g) ?? []) {
        if (token === "space") {
          parent.children.push({ space: true, span: 1 });
          continue;
        }
        for (const [shape, re] of SHAPES) {
          const match = re.exec(token);
          if (!match) continue;
          const item = { key: match[1], label: match[2], shape, span: Number(match[3] ?? 1), parent };
          parent.children.push(item);
          model.items.push(item);
          break;
        }
      }
    }
  });
  return model;
};

/* ---------- 種類ごとの配置 ---------- */
// 戻り値: { width, height, nodes: [{ key, label, x, y, w, h, cls, color, shape, hint }], sections: [{ key, stateKey, label, x, y, w, h, closed, count }], lines: [{ d, keys, cls, color }], labels: [{ text, x, y, cls, key }] }

/** ガントチャート: 上に日付の軸、左に名前の列、タスクを記載順に 1 行ずつ、開始日から終了日までの棒で並べる */
const layoutGantt = (model, state) => {
  const NAME_COL = 200;
  const DAY_W = 26;
  const ROW = 34;
  const AXIS = 34;
  const visibleSections = state.enter ? [state.enter] : model.sections;
  const shownItems = visibleSections.flatMap((section) => section.items);
  const from = new Date(Math.min(...shownItems.map((item) => item.from.getTime())));
  const to = new Date(Math.max(...shownItems.map((item) => item.to.getTime())));
  const days = Math.round((to - from) / DAY) + 1;
  const xOf = (date) => MARGIN + NAME_COL + Math.round((date - from) / DAY) * DAY_W;
  const layout = { nodes: [], sections: [], lines: [], labels: [], width: MARGIN * 2 + NAME_COL + days * DAY_W, height: 0 };
  // 日付の軸: 1 日ごとの目盛りの文字（土日は薄い面）
  for (let index = 0; index < days; index += 1) {
    const date = new Date(from.getTime() + index * DAY);
    if (index === 0 || date.getUTCDate() === 1) layout.labels.push({ text: `${date.getUTCMonth() + 1}月`, x: xOf(date), y: MARGIN - 4, cls: "ag-axis-month" });
    layout.labels.push({ text: String(date.getUTCDate()), x: xOf(date), y: MARGIN + 14, cls: `ag-axis-tick${isWeekend(date) && model.excludeWeekends ? " ag-weekend" : ""}`, w: DAY_W });
  }
  let y = MARGIN + AXIS;
  for (const section of visibleSections) {
    const closed = state.collapsed.has(section.stateKey) && !state.enter;
    const top = y;
    if (closed) {
      const first = new Date(Math.min(...section.items.map((item) => item.from.getTime())));
      const last = new Date(Math.max(...section.items.map((item) => item.to.getTime())));
      layout.nodes.push({ key: `section:${section.stateKey}`, label: `${section.label}（タスク ${section.items.length} 件）`, x: xOf(first), y: y + 6, w: xOf(last) - xOf(first), h: ROW - 12, cls: "ag-bar ag-bar-closed", color: section.color, section });
      y += ROW;
    } else {
      // 開いた section は、見出しの行の下にタスクを 1 行ずつ並べる
      y += 28;
      for (const item of section.items) {
        const milestone = item.tags.includes("milestone");
        const x = xOf(item.from);
        const w = milestone ? 20 : Math.max(DAY_W, xOf(item.to) - x);
        layout.nodes.push({ key: item.key, label: item.label, x: milestone ? x - 10 : x, y: y + 6, w, h: ROW - 12, cls: `ag-bar ${item.tags.map((tag) => `ag-${tag}`).join(" ")}`, color: section.color, item, section });
        layout.labels.push({ text: item.label, x: MARGIN + 28, y: y + 8, cls: "ag-row-name", key: item.key });
        y += ROW;
      }
    }
    layout.sections.push({ key: section.key, stateKey: section.stateKey, label: section.label, title: closed ? `${section.label}（タスク ${section.items.length} 件）` : section.label, x: MARGIN, y: top, w: layout.width - MARGIN * 2, h: y - top, closed, count: section.items.length, color: section.color, kind: "row" });
  }
  // after の依存: 選んだときだけ線を出す（keys の両端が強調に入るときに描く）
  for (const item of shownItems) {
    if (!item.after || !shownItems.includes(item.after)) continue;
    const a = layout.nodes.find((node) => node.item === item.after);
    const b = layout.nodes.find((node) => node.item === item);
    if (!a || !b) continue;
    const x1 = a.x + a.w;
    const y1 = a.y + a.h / 2;
    const x2 = b.x;
    const y2 = b.y + b.h / 2;
    layout.lines.push({ d: `M${x1} ${y1} H${x1 + 8} V${y2} H${x2 - 2}`, keys: [item.after.key, item.key], cls: "ag-dep", onlySelected: true });
  }
  // 今日の線
  if (model.todayMarker) {
    const today = toDate(TODAY);
    if (today >= from && today <= to) layout.today = { x: xOf(today) + DAY_W / 2, top: MARGIN + AXIS - 2, bottom: y };
  }
  layout.height = y + MARGIN + 20;
  return layout;
};

/** タイムライン: 期間を記載順に横の軸の上に並べ、期間の下に出来事を縦に並べる */
const layoutTimeline = (model, state) => {
  const COL = 188;
  const PERIOD_H = 40;
  const EVENT_H = 48;
  const GAP = 12;
  const SECTION_HEAD = 30;
  const visible = state.enter ? [state.enter] : [...model.items.filter((item) => !item.section).map((item) => ({ loose: item })), ...model.sections];
  const layout = { nodes: [], sections: [], lines: [], labels: [], width: 0, height: 0 };
  let x = MARGIN;
  const axisY = MARGIN + SECTION_HEAD + PERIOD_H / 2;
  let maxY = 0;
  const placePeriod = (item, color) => {
    layout.nodes.push({ key: item.key, label: item.label, x, y: MARGIN + SECTION_HEAD, w: COL - GAP * 2, h: PERIOD_H, cls: "ag-period", color, item });
    let y = MARGIN + SECTION_HEAD + PERIOD_H + GAP * 2;
    for (const event of item.events) {
      layout.nodes.push({ key: event.key, label: event.label, x: x + 8, y, w: COL - GAP * 2 - 16, h: EVENT_H, cls: "ag-event", color, item: event });
      layout.lines.push({ d: `M${x + (COL - GAP * 2) / 2} ${MARGIN + SECTION_HEAD + PERIOD_H} V${y}`, keys: [item.key, event.key], cls: "ag-stem", color });
      y += EVENT_H + GAP;
    }
    maxY = Math.max(maxY, y);
    x += COL;
  };
  for (const entry of visible) {
    if (entry.loose) {
      placePeriod(entry.loose, "gray");
      continue;
    }
    const section = entry;
    const closed = state.collapsed.has(section.stateKey) && !state.enter;
    const left = x - GAP / 2;
    if (closed) {
      layout.nodes.push({ key: `section:${section.stateKey}`, label: `${section.label}\n（期間 ${section.items.length} 件）`, x, y: MARGIN + SECTION_HEAD, w: COL - GAP * 2, h: PERIOD_H + 12, cls: "ag-period ag-closed ag-two-lines", color: section.color, section });
      x += COL;
    } else for (const item of section.items) placePeriod(item, section.color);
    layout.sections.push({ key: section.key, stateKey: section.stateKey, label: section.label, x: left, y: MARGIN, w: x - left - GAP, h: Math.max(maxY, MARGIN + SECTION_HEAD + PERIOD_H + GAP) - MARGIN, closed, count: section.items.length, color: section.color, kind: "box" });
  }
  layout.axis = { x1: MARGIN, x2: x - GAP, y: axisY };
  layout.width = x + MARGIN;
  layout.height = Math.max(maxY, MARGIN + SECTION_HEAD + PERIOD_H) + MARGIN;
  return layout;
};

/** Git グラフ: ブランチごとの横の線に、commit を記載順に左から右へ並べる */
const layoutGitGraph = (model) => {
  const NAME_COL = 96;
  const STEP = 104;
  const LANE = 64;
  const DOT = 24;
  const layout = { nodes: [], sections: [], lines: [], labels: [], width: MARGIN * 2 + NAME_COL + (model.items.length + 1) * STEP, height: MARGIN * 2 + model.branches.length * LANE + 16 };
  const laneY = (name) => MARGIN + 24 + model.branches.find((branch) => branch.name === name).order * LANE;
  const pos = new Map();
  for (const item of model.items) pos.set(item, { x: MARGIN + NAME_COL + item.order * STEP, y: laneY(item.branch) });
  model.branches.forEach((branch, index) => {
    const color = COLORS[index % COLORS.length];
    branch.color = color;
    const commits = model.items.filter((item) => item.branch === branch.name);
    if (!commits.length) return;
    const y = laneY(branch.name);
    const first = pos.get(commits[0]);
    const last = pos.get(commits.at(-1));
    const startX = branch.from ? pos.get(branch.from).x + STEP / 2 + 12 : first.x;
    layout.lines.push({ d: `M${startX} ${y} H${last.x}`, keys: commits.map((item) => item.key), cls: "ag-lane", color, branch: branch.name });
    if (branch.from) {
      const p = pos.get(branch.from);
      const mid = p.x + STEP / 2;
      layout.lines.push({ d: `M${p.x + DOT / 2} ${p.y} H${mid - 12} Q${mid} ${p.y} ${mid} ${p.y + 12} V${y - 12} Q${mid} ${y} ${mid + 12} ${y}`, keys: [branch.from.key, commits[0].key], cls: "ag-lane", color, branch: branch.name });
    }
    layout.labels.push({ text: branch.name, x: MARGIN, y: y - 12, cls: "ag-branch-name", branch: branch.name, color });
  });
  for (const item of model.items) {
    const p = pos.get(item);
    const color = model.branches.find((branch) => branch.name === item.branch).color;
    if (item.kind === "merge") {
      const q = pos.get(item.parents[1]);
      const fromColor = model.branches.find((branch) => branch.name === item.mergeFrom).color;
      layout.lines.push({ d: `M${q.x} ${q.y} C${p.x - STEP / 2} ${q.y} ${p.x} ${p.y} ${p.x} ${p.y}`, keys: [item.parents[1].key, item.key], cls: "ag-lane", color: fromColor, branch: item.mergeFrom });
    }
    layout.nodes.push({ key: item.key, label: item.label || "commit", x: p.x - DOT / 2, y: p.y - DOT / 2, w: DOT, h: DOT, cls: `ag-commit ag-commit-${item.type.toLowerCase()} ag-commit-${item.kind}`, color, item });
    const caption = item.kind === "cherry-pick" ? `← ${item.pickOf}` : item.id ?? item.msg;
    // commit の下の文字は、隣の commit との間に収まる幅で折り返す（分かれる線は丸の右の間を通る）
    if (caption) layout.labels.push({ text: caption, x: p.x - (STEP - 16) / 2, y: p.y + DOT / 2 + 4, w: STEP - 16, cls: "ag-commit-caption", key: item.key });
    if (item.tag) layout.labels.push({ text: item.tag, x: p.x - 36, y: p.y - DOT / 2 - 26, w: 72, cls: "ag-tag", key: item.key });
  }
  return layout;
};

/** ジャーニー: タスクを記載順に左から右へ、点数が高いほど上に置き、人の色の丸をタスクの下に並べる */
const layoutJourney = (model, state) => {
  const COL = 124;
  const SCORE_H = 34;
  const FACE = 36;
  const HEAD = 30;
  const visibleSections = state.enter ? [state.enter] : model.sections;
  const layout = { nodes: [], sections: [], lines: [], labels: [], width: 0, height: 0 };
  const baseY = MARGIN + HEAD + 6 * SCORE_H;
  const yOf = (score) => baseY - score * SCORE_H;
  let x = MARGIN + 36;
  const marks = [];
  for (const section of visibleSections) {
    const left = x;
    const closed = state.collapsed.has(section.stateKey) && !state.enter;
    const tasks = closed ? [{ label: `${section.label}\n（タスク ${section.items.length} 件）`, key: `section:${section.stateKey}`, score: section.items.reduce((sum, item) => sum + item.score, 0) / section.items.length, actors: [], closed: true }] : section.items;
    for (const task of tasks) {
      const cx = x + COL / 2;
      const y = yOf(task.score);
      layout.nodes.push({ key: task.key, label: task.label, x: cx - FACE / 2, y: y - FACE / 2, w: FACE, h: FACE, cls: `ag-face${task.closed ? " ag-closed" : ""}`, color: section.color, item: task.closed ? undefined : task, section: task.closed ? section : undefined, score: task.score });
      layout.labels.push({ text: task.label, x, y: baseY + 12, w: COL, cls: "ag-task-name", key: task.key });
      task.actors.forEach((name, index) => {
        layout.labels.push({ text: "", x: cx - task.actors.length * 9 + index * 18, y: baseY + 52, w: 14, cls: `ag-actor-dot ag-actor-${model.actors.indexOf(name)}`, key: task.key, actor: name });
      });
      marks.push({ key: task.key, x: cx, y, actors: task.actors });
      x += COL;
    }
    layout.sections.push({ key: section.key, stateKey: section.stateKey, label: section.label, x: left, y: MARGIN, w: x - left, h: HEAD, closed, count: section.items.length, color: section.color, kind: "band" });
  }
  for (let index = 1; index < marks.length; index += 1) {
    const a = marks[index - 1];
    const b = marks[index];
    layout.lines.push({ d: `M${a.x} ${a.y} L${b.x} ${b.y}`, keys: [a.key, b.key], cls: "ag-journey-line" });
  }
  // 人を選んだときは、その人のタスクの印だけを線でつなぐ
  if (state.actor) {
    const own = marks.filter((mark) => mark.actors.includes(state.actor));
    for (let index = 1; index < own.length; index += 1) layout.lines.push({ d: `M${own[index - 1].x} ${own[index - 1].y} L${own[index].x} ${own[index].y}`, keys: [own[index - 1].key, own[index].key], cls: `ag-actor-line ag-actor-${model.actors.indexOf(state.actor)}` });
  }
  layout.scale = { x: MARGIN, top: yOf(5), bottom: yOf(1), yOf };
  layout.width = x + MARGIN;
  layout.height = baseY + 72 + MARGIN;
  return layout;
};

/** ブロック図: columns の列の数の格子に記載の順で並べ、幅で列を進める。入れ子は中の columns で格子を作り直す */
const layoutBlock = (model, state) => {
  const CELL_W = 156;
  const CELL_H = 52;
  const GAP = 20;
  /** 行の間: 閉じた入れ子のブロックの開閉のボタンを上に置ける高さ */
  const ROW_GAP = 36;
  const HEAD = 28;
  const PAD = 12;
  const layout = { nodes: [], sections: [], lines: [], labels: [], width: 0, height: 0 };
  /** 格子を 1 つ配置し、占めた幅と高さを返す */
  const placeGrid = (container, left, top) => {
    let col = 0;
    let rowTop = top;
    let rowH = 0;
    let maxRight = left;
    const cellW = (span) => span * CELL_W + (span - 1) * GAP;
    for (const child of container.children) {
      if (col + child.span > container.columns) {
        col = 0;
        rowTop += rowH + ROW_GAP;
        rowH = 0;
      }
      const x = left + col * (CELL_W + GAP);
      if (child.isGroup) {
        const closed = state.collapsed.has(child.key);
        if (closed) {
          layout.nodes.push({ key: child.key, label: `${child.label}\n（ブロック ${child.children.filter((kid) => !kid.space).length} 件）`, x, y: rowTop, w: cellW(child.span), h: CELL_H, cls: "ag-block ag-closed ag-two-lines", group: child });
          layout.sections.push({ key: child.key, stateKey: child.key, label: child.label, x, y: rowTop, w: cellW(child.span), h: CELL_H, closed: true, count: child.children.length, kind: "block" });
          rowH = Math.max(rowH, CELL_H);
          child.box = { x, y: rowTop, w: cellW(child.span), h: CELL_H };
        } else {
          const inner = placeGrid(child, x + PAD, rowTop + HEAD);
          const w = Math.max(cellW(child.span), inner.w + PAD * 2);
          const h = inner.h + HEAD + PAD;
          layout.sections.push({ key: child.key, stateKey: child.key, label: child.label, x, y: rowTop, w, h, closed: false, count: child.children.length, kind: "block" });
          rowH = Math.max(rowH, h);
          child.box = { x, y: rowTop, w, h };
        }
      } else if (!child.space) {
        layout.nodes.push({ key: child.key, label: child.label, x, y: rowTop, w: cellW(child.span), h: CELL_H, cls: "ag-block", shape: child.shape, item: child, color: state.layoutData[child.key]?.color });
        child.box = { x, y: rowTop, w: cellW(child.span), h: CELL_H };
        rowH = Math.max(rowH, CELL_H);
      }
      col += child.span;
      maxRight = Math.max(maxRight, x + (child.box?.w ?? cellW(child.span)));
    }
    return { w: maxRight - left, h: rowTop + rowH - top };
  };
  const top = state.enter ?? model.root;
  const size = placeGrid(top, MARGIN, MARGIN);
  // 線: 両端のブロック（閉じた入れ子の中のブロックは入れ子）の辺から辺へ、横か縦に引く
  const visibleBox = (key) => {
    const item = [...model.items, ...model.groups].find((entry) => entry.key === key);
    for (let node = item; node; node = node.parent) if (node.isGroup && state.collapsed.has(node.key)) return { box: node.box, key: node.key };
    return item?.box ? { box: item.box, key } : undefined;
  };
  for (const wire of model.wires) {
    const a = visibleBox(wire.from);
    const b = visibleBox(wire.to);
    if (!a || !b || a.key === b.key) continue;
    const ac = { x: a.box.x + a.box.w / 2, y: a.box.y + a.box.h / 2 };
    const bc = { x: b.box.x + b.box.w / 2, y: b.box.y + b.box.h / 2 };
    const horizontal = Math.abs(bc.y - ac.y) < 8 || b.box.x > a.box.x + a.box.w || a.box.x > b.box.x + b.box.w;
    const d = horizontal
      ? `M${ac.x < bc.x ? a.box.x + a.box.w : a.box.x} ${ac.y} H${(ac.x + bc.x) / 2} V${bc.y} H${ac.x < bc.x ? b.box.x : b.box.x + b.box.w}`
      : `M${ac.x} ${ac.y < bc.y ? a.box.y + a.box.h : a.box.y} V${(ac.y + bc.y) / 2} H${bc.x} V${ac.y < bc.y ? b.box.y : b.box.y + b.box.h}`;
    layout.lines.push({ d, keys: [a.key, b.key], cls: "ag-wire", arrow: true });
    if (wire.label) layout.labels.push({ text: wire.label, x: (a.box.x + a.box.w + b.box.x) / 2 - 24, y: ac.y - 24, w: 48, cls: "ag-wire-label", key: a.key });
  }
  layout.width = size.w + MARGIN * 2;
  layout.height = size.h + MARGIN * 2;
  return layout;
};

/* ---------- 種類の定義 ---------- */

const KINDS = {
  gantt: {
    name: "ガントチャート",
    parse: parseGantt,
    layout: layoutGantt,
    hasSections: true,
    playable: true,
    /** 再生の手順: 開始日の順（同じ日は記載の順）のタスク */
    steps: (model) => [...model.items].sort((a, b) => a.from - b.from || a.order - b.order).map((item) => ({ key: item.key, title: item.label, text: `${dateLabel(item.from)} 〜 ${dateLabel(new Date(item.to.getTime() - DAY))}` })),
    /** 選んだタスクと after でつながる前後のタスク */
    related: (model, key) => {
      const item = model.items.find((entry) => entry.key === key);
      if (!item) return [key];
      return [item, item.after, ...model.items.filter((entry) => entry.after === item)].filter(Boolean).map((entry) => entry.key);
    },
    hint: (node) => (node.item ? `${dateLabel(node.item.from)} 〜 ${dateLabel(new Date(node.item.to.getTime() - DAY))}` : undefined),
  },
  timeline: {
    name: "タイムライン",
    parse: parseTimeline,
    layout: layoutTimeline,
    hasSections: true,
    playable: true,
    steps: (model) => model.items.map((item) => ({ key: item.key, title: item.label, text: item.events.map((event) => event.label).join("・") })),
    related: (model, key) => {
      const period = model.items.find((item) => item.key === key);
      if (period) return [key, ...period.events.map((event) => event.key)];
      const event = model.events.find((item) => item.key === key);
      return event ? [key, event.period.key] : [key];
    },
  },
  gitGraph: {
    name: "Git グラフ",
    parse: parseGitGraph,
    layout: layoutGitGraph,
    hasSections: false,
    playable: true,
    steps: (model) => model.items.map((item) => ({ key: item.key, title: `${item.branch} · ${item.id ?? item.msg ?? `c${item.order}`}`, text: item.label })),
    /** 選んだ commit から親をたどった全ての祖先 */
    related: (model, key) => {
      const item = model.items.find((entry) => entry.key === key);
      const keep = new Set();
      const walk = (node) => {
        if (!node || keep.has(node.key)) return;
        keep.add(node.key);
        for (const parent of node.parents) walk(parent);
      };
      walk(item);
      return [...keep];
    },
    /** 選んだブランチの commit と、merge と cherry-pick でそのブランチへ入った commit */
    branchRelated: (model, name) => {
      const own = model.items.filter((item) => item.branch === name);
      const merged = model.items.filter((item) => item.kind === "merge" && item.mergeFrom === name);
      const picked = model.items.filter((item) => item.kind === "cherry-pick" && own.some((entry) => entry.id === item.pickOf));
      return [...own, ...merged, ...picked].map((item) => item.key);
    },
  },
  journey: {
    name: "ジャーニー",
    parse: parseJourney,
    layout: layoutJourney,
    hasSections: true,
    playable: true,
    steps: (model) => model.items.map((item) => ({ key: item.key, title: item.label, text: `点数 ${item.score}・${item.actors.join("、")}` })),
    related: (model, key) => [key],
    hint: (node) => (node.score !== undefined ? `点数 ${Math.round(node.score * 10) / 10}` : undefined),
  },
  block: {
    name: "ブロック図",
    parse: parseBlock,
    layout: layoutBlock,
    hasSections: false,
    playable: false,
    /** 選んだブロックと線でつながる相手 */
    related: (model, key) => [key, ...model.wires.filter((wire) => wire.from === key || wire.to === key).map((wire) => (wire.from === key ? wire.to : wire.from))],
  },
};

/* ---------- 描画と操作 ---------- */

/**
 * map の軸と格子の配置の図を 1 つ作る。host の中に描き、操作のたびに描き直す。
 * spec: { kind, title, source, data: { notes, layout } }
 * initial: { enter, collapsed, selected, actor, branch, step }
 */
export const createAxisGrid = (host, spec, initial = {}) => {
  const kind = KINDS[spec.kind];
  const model = kind.parse(spec.source);
  const notes = spec.data?.notes ?? {};
  const layoutData = spec.data?.layout ?? {};
  const steps = kind.playable ? kind.steps(model) : [];
  const sectionsByKey = new Map((model.sections ?? []).map((section) => [section.label, section]));
  const groupsByKey = new Map((model.groups ?? []).map((group) => [group.key, group]));
  const stateKeyOf = (key) => sectionsByKey.get(key)?.stateKey ?? groupsByKey.get(key)?.key ?? key;
  const state = {
    enter: initial.enter ? sectionsByKey.get(initial.enter) ?? groupsByKey.get(initial.enter) : undefined,
    collapsed: new Set([
      ...Object.entries(layoutData).filter(([, value]) => value.collapsed).map(([key]) => stateKeyOf(key)),
      ...(initial.collapsed ?? []).map(stateKeyOf),
    ]),
    selected: initial.selected,
    actor: initial.actor,
    branch: initial.branch,
    step: initial.step,
    layoutData,
  };
  // 書き方の警告: 読めない行と、軸と格子の配置で適用しない layout の指定
  const warnings = [
    ...model.problems,
    ...Object.entries(layoutData).flatMap(([key, value]) =>
      [
        value.pos ? `layout の ${key} の pos: ${kind.name}では座標を適用しません` : undefined,
        value.order !== undefined ? `layout の ${key} の order: ${kind.name}では並び順を適用しません。並び順は Mermaid の行の順で変えてください` : undefined,
      ].filter(Boolean),
    ),
  ];

  /** 強調する項目のキー: 再生の手順・選んだ項目と種類ごとのつながり・選んだ人やブランチ */
  const keepSet = (layout) => {
    if (state.step !== undefined) {
      const key = steps[state.step].key;
      const node = layout.nodes.find((entry) => entry.key === key);
      if (node) return new Set([key]);
      // 閉じた section の中の項目は、その section を強調する
      const section = (model.sections ?? []).find((entry) => entry.items.some((item) => item.key === key));
      return new Set([`section:${section?.stateKey}`]);
    }
    if (state.actor) return new Set(model.items.filter((item) => item.actors.includes(state.actor)).map((item) => item.key));
    if (state.branch) return new Set(kind.branchRelated(model, state.branch));
    if (state.selected) return new Set(kind.related(model, state.selected));
    return undefined;
  };

  const render = () => {
    const pageY = window.scrollY;
    const oldViewport = host.querySelector(".mdmark-diagram-viewport");
    const scroll = oldViewport ? [oldViewport.scrollLeft, oldViewport.scrollTop] : [0, 0];
    const layout = kind.layout(model, state);
    const trailHeight = state.enter ? 32 : 0;
    const shift = (value) => value + trailHeight;
    const definition = {
      title: spec.title ?? model.title ?? kind.name,
      scope: state.enter ? `${state.enter.label}の中` : "全体",
      updated: "2026-11-18",
      width: layout.width,
      height: layout.height + trailHeight,
      nodes: layout.nodes.map((node, index) => ({
        id: `ag-${index}`,
        kind: "script",
        x: Math.round(node.x),
        y: Math.round(shift(node.y)),
        w: Math.round(node.w),
        h: Math.round(node.h),
        name: node.label,
        ...(notes[node.key] ? { hint: [notes[node.key].text, kind.hint?.(node)].filter(Boolean).join("\n") } : {}),
      })),
      wires: [],
    };
    host.replaceChildren();
    if (warnings.length) {
      const box = document.createElement("div");
      box.className = "map-warning";
      box.setAttribute("role", "note");
      box.innerHTML = `<p>書き方の警告</p><ul>${warnings.map((text) => `<li>${text}</li>`).join("")}</ul>`;
      host.append(box);
    }
    const holder = document.createElement("div");
    host.append(holder);
    mount(holder, { markdown: `<!-- flow -->\n\n\`\`\`json\n${JSON.stringify(definition)}\n\`\`\`\n\n<!-- /flow -->\n` });
    const figure = holder.querySelector("figure.mdmark-diagram");
    figure.classList.add("map-figure", "ag-figure");
    figure.dataset.agKind = spec.kind;
    const stage = figure.querySelector(".mdmark-diagram-stage");
    // 線・軸・今日の線は、中へ入ったときのパンくずの高さだけ下げた group に描く
    const svg = document.createElementNS(SVG, "g");
    svg.setAttribute("transform", `translate(0 ${trailHeight})`);
    figure.querySelector(".mdmark-diagram-wires").append(svg);
    const keep = keepSet(layout);
    const dimmed = (key) => keep && !keep.has(key);

    // section・入れ子のブロックの面（項目の下に敷く）と開閉・中へ入るボタン
    for (const section of layout.sections) {
      const face = document.createElement("div");
      face.className = `ag-section ag-section-${section.kind}${section.closed ? " ag-section-closed" : ""}`;
      Object.assign(face.style, { left: `${section.x}px`, top: `${shift(section.y)}px`, width: `${section.w}px`, height: `${section.h}px` });
      if (section.color) face.style.setProperty("--ag-color", `var(--mdmark-color-accent-${section.color}-text)`);
      if (section.color) face.style.setProperty("--ag-fill", `var(--mdmark-color-accent-${section.color}-bg)`);
      if (keep && !keep.has(`section:${section.stateKey}`) && !(section.closed === false && [...keep].some((key) => layout.nodes.some((node) => node.key === key && node.section?.stateKey === section.stateKey)))) face.classList.add("ag-dim");
      const head = document.createElement("div");
      head.className = "ag-section-head";
      const title = Object.assign(document.createElement("span"), { className: "ag-section-title", textContent: section.title ?? section.label });
      head.append(title);
      if (!state.enter || state.enter.key !== section.key) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "ag-toggle";
        toggle.setAttribute("aria-expanded", String(!section.closed));
        toggle.setAttribute("aria-label", section.closed ? `${section.label}を開く` : `${section.label}を閉じる`);
        toggle.title = toggle.getAttribute("aria-label");
        toggle.innerHTML = section.closed ? icon("expand") : icon("collapse");
        toggle.addEventListener("click", () => {
          if (section.closed) state.collapsed.delete(section.stateKey);
          else state.collapsed.add(section.stateKey);
          render();
        });
        const enter = document.createElement("button");
        enter.type = "button";
        enter.className = "ag-enter";
        enter.setAttribute("aria-label", `${section.label}の中へ入る`);
        enter.title = enter.getAttribute("aria-label");
        enter.innerHTML = icon("enter");
        enter.addEventListener("click", () => {
          state.enter = model.sections?.find((entry) => entry.stateKey === section.stateKey) ?? groupsByKey.get(section.key);
          state.collapsed.delete(section.stateKey);
          state.selected = undefined;
          render();
        });
        head.prepend(toggle);
        head.append(enter);
      }
      face.append(head);
      stage.prepend(face);
    }

    // 軸・今日の線・点数の目盛り
    if (layout.axis) {
      const line = document.createElementNS(SVG, "path");
      line.setAttribute("d", `M${layout.axis.x1} ${layout.axis.y} H${layout.axis.x2}`);
      line.setAttribute("class", "ag-axis-line");
      svg.prepend(line);
    }
    if (layout.today) {
      const line = document.createElementNS(SVG, "path");
      line.setAttribute("d", `M${layout.today.x} ${layout.today.top} V${layout.today.bottom}`);
      line.setAttribute("class", "ag-today");
      svg.append(line);
      stage.append(Object.assign(document.createElement("span"), { className: "ag-today-label", textContent: "今日", style: `left:${layout.today.x - 16}px;top:${shift(layout.today.bottom) + 2}px` }));
    }
    if (layout.scale) {
      for (let score = 1; score <= 5; score += 1) {
        const y = layout.scale.yOf(score);
        const rule = document.createElementNS(SVG, "path");
        rule.setAttribute("d", `M${layout.scale.x + 24} ${y} H${layout.width - MARGIN}`);
        rule.setAttribute("class", "ag-scale-rule");
        svg.prepend(rule);
        stage.append(Object.assign(document.createElement("span"), { className: "ag-scale-label", textContent: String(score), style: `left:${layout.scale.x}px;top:${shift(y) - 9}px` }));
      }
    }

    // 線: 種類ごとのつながり。選んだときだけ出す線は、両端が強調に入るときだけ描く
    for (const line of layout.lines) {
      if (line.onlySelected && !(keep && line.keys.every((key) => keep.has(key)))) continue;
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", line.d);
      path.setAttribute("class", line.cls);
      if (line.color) path.style.setProperty("--ag-color", `var(--mdmark-color-accent-${line.color}-text)`);
      if (line.arrow) path.setAttribute("marker-end", "url(#ag-arrow)");
      if (keep && !line.keys.every((key) => keep.has(key))) path.classList.add("ag-dim");
      if (state.branch && line.branch === state.branch) path.classList.remove("ag-dim");
      svg.append(path);
    }
    if (layout.lines.some((line) => line.arrow)) {
      const defs = document.createElementNS(SVG, "defs");
      defs.innerHTML = '<marker id="ag-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>';
      figure.querySelector(".mdmark-diagram-wires").prepend(defs);
    }

    // 文字: 軸の目盛り・行の名前・ブランチ名・commit の下の文字・札・人の丸
    for (const label of layout.labels) {
      const isBranch = Boolean(label.branch);
      const element = document.createElement(isBranch ? "button" : "span");
      element.className = label.cls;
      element.textContent = label.text;
      Object.assign(element.style, { left: `${label.x}px`, top: `${shift(label.y)}px`, ...(label.w ? { width: `${label.w}px` } : {}) });
      if (label.color) element.style.setProperty("--ag-color", `var(--mdmark-color-accent-${label.color}-text)`);
      if (label.key && dimmed(label.key)) element.classList.add("ag-dim");
      if (isBranch) {
        element.type = "button";
        element.setAttribute("aria-pressed", String(state.branch === label.branch));
        element.addEventListener("click", () => {
          state.branch = state.branch === label.branch ? undefined : label.branch;
          state.selected = undefined;
          render();
        });
        if (state.branch && state.branch !== label.branch) element.classList.add("ag-dim");
      }
      if (label.actor) element.title = label.actor;
      stage.append(element);
    }

    // 項目: 色・形状・選択
    layout.nodes.forEach((node, index) => {
      const element = stage.querySelector(`[data-node="ag-${index}"]`);
      if (!element) return;
      element.classList.add("ag-item", ...node.cls.split(" ").filter(Boolean));
      if (node.shape) element.dataset.agShape = node.shape;
      const color = layoutData[node.key]?.color ?? node.color;
      if (color) {
        element.style.setProperty("--ag-color", `var(--mdmark-color-accent-${color}-text)`);
        element.style.setProperty("--ag-fill", `var(--mdmark-color-accent-${color}-bg)`);
      }
      if (layoutData[node.key]?.color) element.classList.add("ag-colored");
      if (dimmed(node.key)) element.classList.add("ag-dim");
      if (node.score !== undefined) element.insertAdjacentHTML("beforeend", face(node.score));
      const selected = state.selected === node.key || (state.step !== undefined && keep?.has(node.key));
      if (selected) element.classList.add("ag-selected");
      const hit = document.createElement("span");
      hit.className = "ag-hit";
      hit.tabIndex = 0;
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-label", state.selected === node.key ? `${node.label}（選択中）` : node.label);
      hit.dataset.agHit = node.key;
      element.prepend(hit);
      const choose = () => {
        if (node.key.startsWith("section:")) return;
        state.selected = state.selected === node.key ? undefined : node.key;
        state.actor = undefined;
        state.branch = undefined;
        render();
      };
      element.addEventListener("click", (event) => {
        if (event.target.closest("button, .mdmark-diagram-info")) return;
        choose();
      });
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose();
        }
      });
    });

    // ジャーニーの人の凡例: 押すとその人のタスクを強調する
    if (spec.kind === "journey") {
      const legend = document.createElement("div");
      legend.className = "ag-legend";
      legend.setAttribute("role", "group");
      legend.setAttribute("aria-label", "人");
      for (const name of model.actors) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `ag-legend-item ag-actor-${model.actors.indexOf(name)}`;
        button.innerHTML = `<span class="ag-actor-dot" aria-hidden="true"></span>${name}`;
        button.setAttribute("aria-pressed", String(state.actor === name));
        button.addEventListener("click", () => {
          state.actor = state.actor === name ? undefined : name;
          state.selected = undefined;
          render();
        });
        legend.append(button);
      }
      figure.querySelector(".mdmark-diagram-box").after(legend);
    }

    // 中へ入ったときの道筋: 図の上端のパンくずに section・入れ子のブロックの名前を出す
    if (state.enter) {
      const bar = document.createElement("div");
      bar.className = "ag-trail";
      bar.setAttribute("aria-label", "現在の場所");
      bar.innerHTML = `<span>全体</span><span aria-hidden="true">›</span><span>${state.enter.label}</span>`;
      stage.append(bar);
    }

    decorateTools(figure);
    keepScale(figure, definition);
    if (steps.length) renderBand(figure);
    const handle = figure.querySelector(".mdmark-diagram-resize");
    if (handle) handle.innerHTML = icon("resize");
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    viewport.scrollLeft = scroll[0];
    viewport.scrollTop = scroll[1];
    window.scrollTo({ top: pageY });
  };

  /** 点数に合った表情の顔（1・2 は口を下げ、3 は横、4・5 は上げる） */
  const face = (score) => {
    const mouth = score >= 4 ? "M9 15 Q12 18 15 15" : score >= 3 ? "M9 15.5 H15" : "M9 17 Q12 14 15 17";
    return `<svg class="ag-face-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="10" r="1.2"/><circle cx="15" cy="10" r="1.2"/><path d="${mouth}" fill="none" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  };

  const leave = () => {
    if (!state.enter) return;
    state.enter = undefined;
    render();
  };

  /** 図の右上のツールの先頭に、戻る・全て開く・全て閉じる・選択を元に戻すを並べる（開閉を持つ種類だけ開閉のボタンを出す） */
  const decorateTools = (figure) => {
    const group = document.createElement("div");
    group.className = "mdmark-diagram-tools-group";
    group.dataset.group = "map";
    const closable = [...(model.sections ?? []).map((section) => section.stateKey), ...(model.groups ?? []).map((group_) => group_.key)];
    if (closable.length) {
      group.append(
        toolButton("back", "外へ戻る", leave, state.enter ? {} : { disabled: "" }),
        toolButton("expandAll", "全て開く", () => {
          state.collapsed.clear();
          render();
        }),
        toolButton("collapseAll", "全て閉じる", () => {
          for (const key of closable) state.collapsed.add(key);
          render();
        }),
      );
    }
    group.append(
      toolButton("reset", "配置と選択を元に戻す", () => {
        state.selected = undefined;
        state.actor = undefined;
        state.branch = undefined;
        render();
      }, state.selected || state.actor || state.branch ? {} : { disabled: "" }),
    );
    figure.querySelector(".mdmark-diagram-tools").prepend(group);
  };

  // Esc: 選択を解き、選んでいなければ外へ戻る
  host.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.selected || state.actor || state.branch) {
      state.selected = undefined;
      state.actor = undefined;
      state.branch = undefined;
      render();
    } else if (state.step === undefined) leave();
  });

  /** 再生の帯: 番号・項目の文字・説明の文と、前へ・停止・自動で進める・次へのボタン（シーケンス図の再生の帯と同じ並び） */
  const renderBand = (figure) => {
    const band = document.createElement("div");
    band.className = "map-band";
    band.setAttribute("role", "region");
    band.setAttribute("aria-label", "再生");
    const index = state.step;
    const go = (next) => {
      state.step = next;
      state.selected = undefined;
      render();
    };
    const head = document.createElement("div");
    head.className = "map-band-head";
    const count = Object.assign(document.createElement("span"), { className: "map-band-count", textContent: `${index === undefined ? "–" : index + 1}/${steps.length}` });
    const title = Object.assign(document.createElement("strong"), { className: "map-band-title", textContent: index === undefined ? "" : steps[index].title });
    const actions = document.createElement("div");
    actions.className = "map-band-actions";
    actions.append(
      toolButton("prev", "前の手順", () => go(index === undefined || index === 0 ? steps.length - 1 : index - 1)),
      toolButton("stop", "再生を止める", () => go(undefined), index === undefined ? { disabled: "" } : {}),
      toolButton("play", "自動で進める", () => {}, { "aria-pressed": "false" }),
      toolButton("next", "次の手順", () => go(index === undefined ? 0 : (index + 1) % steps.length)),
    );
    head.append(count, title, actions);
    const noteText = index === undefined ? "" : [steps[index].text, notes[steps[index].key]?.text].filter(Boolean).join("\n");
    const body = Object.assign(document.createElement("p"), { className: "map-band-text", textContent: noteText });
    body.hidden = index === undefined;
    body.setAttribute("aria-live", "polite");
    band.append(head, body);
    figure.querySelector(".mdmark-diagram-box").after(band);
  };

  /** map の図は等倍より縮めない: 今の部品が置き場所の幅に合わせて縮めたら等倍に戻し、表示する枠の中で横にスクロールさせる */
  const keepScale = (figure, definition) => {
    const stage = figure.querySelector(".mdmark-diagram-stage");
    const sizer = figure.querySelector(".mdmark-diagram-sizer");
    const viewport = figure.querySelector(".mdmark-diagram-viewport");
    const height = `${Math.min(definition.height + 16, MAX_INITIAL_HEIGHT)}px`;
    const enforce = () => {
      if (viewport.style.height !== height || viewport.style.maxHeight !== height) {
        viewport.style.height = height;
        viewport.style.maxHeight = height;
      }
      const scale = Number(/scale\(([\d.]+)\)/.exec(stage.style.transform)?.[1] ?? 1);
      if (scale >= 1) return;
      stage.style.transform = "scale(1)";
      sizer.style.width = `${definition.width}px`;
      sizer.style.height = `${definition.height}px`;
      const zoom = figure.querySelector(".mdmark-diagram-zoom-text, [data-zoom-text]");
      if (zoom) zoom.textContent = "100%";
    };
    const observer = new MutationObserver(enforce);
    observer.observe(stage, { attributes: true, attributeFilter: ["style"] });
    observer.observe(viewport, { attributes: true, attributeFilter: ["style"] });
    enforce();
  };

  render();
};

/** 範囲の外のコードブロック: 1 行目の種類の名前から、補足の無い map の図にする */
export const kindOf = (source) => ({ gantt: "gantt", timeline: "timeline", gitGraph: "gitGraph", journey: "journey", "block-beta": "block" })[source.trim().split(/\s/, 1)[0]];
