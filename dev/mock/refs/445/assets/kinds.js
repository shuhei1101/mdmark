// map の図のノードと線の種類の作り方の一覧: ノードと線の種類は mdmark では決めず、使う側が設定（mdmark.config.yaml の map）で作る。
// 設定で選択できる形状・アイコン・線の模様を並べ、設定の例を 2 つ描く。本文は配布物の mount で描き、目印の段落の場所に map の図を置く

import { mount } from "../../../../../dist/index.js";
import { createMap } from "./map-mock.js";

/** 形の見本: 種類ごとに形だけを変えた設定 */
const SHAPE_CONFIG = {
  kinds: {
    rounded: { shape: "rounded" },
    rect: { shape: "rect" },
    pill: { shape: "pill" },
    double: { shape: "double" },
  },
};
const SHAPES = `flowchart LR
  a["rounded"]:::rounded
  b["rect"]:::rect
  c["pill"]:::pill
  d["double"]:::double
  e["種類を書かないノード"]
`;

/** 線の模様の見本: 名前の線を補足の layout の line で指す */
const LINE_CONFIG = {
  lines: {
    solid: {},
    dashed: { dash: "dashed" },
    dotted: { dash: "dotted" },
    "dash-dot": { dash: "dash-dot" },
    "long-dash": { dash: "long-dash" },
    thick: { width: "thick" },
    open: { head: "open" },
    none: { head: "none" },
  },
};
const LINES = `flowchart TB
  s1["solid（既定）"] --> t1["先"]
  s2["dash: dashed"] --> t2["先"]
  s3["dash: dotted"] --> t3["先"]
  s4["dash: dash-dot"] --> t4["先"]
  s5["dash: long-dash"] --> t5["先"]
  s6["width: thick"] --> t6["先"]
  s7["head: open"] --> t7["先"]
  s8["head: none"] --> t8["先"]
`;
const LINE_LAYOUT = Object.fromEntries(Object.keys(LINE_CONFIG.lines).map((name, index) => [`L${index}`, { line: name }]));

/** 設定の例 1: システムの構成を描くとき */
const SYSTEM_CONFIG = {
  kinds: {
    app: { label: "アプリ", icon: "server", shape: "rounded", color: "blue" },
    store: { label: "保存先", icon: "database", shape: "rect", color: "purple" },
    outside: { label: "外部のサービス", icon: "globe", shape: "pill", color: "green" },
  },
  lines: {
    "-.->": { dash: "dashed", head: "open" },
    "==>": { width: "thick" },
  },
};
const SYSTEM = `flowchart LR
  user(["利用者"]):::outside
  web["Web の画面"]:::app
  api["API"]:::app
  db[("DB")]:::store
  pay(["決済のサービス"]):::outside
  user --> web
  web --> api
  api ==> db
  db -.-> api
  api --> pay
`;

/** 設定の例 2: 業務の流れを描くとき */
const WORK_CONFIG = {
  kinds: {
    person: { label: "担当者", icon: "user", shape: "pill", color: "orange" },
    doc: { label: "書類", icon: "file", shape: "rect" },
    tool: { label: "システム", icon: "server", shape: "double", color: "blue" },
  },
  lines: {
    "-.->": { dash: "dotted", head: "open", color: "gray" },
  },
};
const WORK = `flowchart LR
  apply(["申請者"]):::person
  form["申請書"]:::doc
  check(["承認者"]):::person
  sys["経費のシステム"]:::tool
  apply -.-> form
  form -.-> check
  apply --> check
  check --> sys
`;

const markdown = `# map の図のノードと線の種類の作り方

map の図は、ノードと線の種類を mdmark では決めない。使う側が設定（\`mdmark.config.yaml\` の \`map\`）で、種類の名前・アイコン・形・色と、線の模様・太さ・矢じり・色を作る。凡例は出さない。

\`\`\`yaml
map:
  kinds:            # Mermaid のクラス名ごとのノードの種類
    app:            # Mermaid では  api["API"]:::app
      label: アプリ  # ノードの種類の行に出す名前（省くと出さない）
      icon: server  # Lucide のアイコンの名前（省くとアイコン無し）
      shape: rounded # rounded（既定）・rect・pill・double
      color: blue   # 色の名前（省くと既定の線の色）
  lines:            # Mermaid の矢印か名前ごとの線の種類
    "-.->": { dash: dashed, head: open }
    "==>":  { width: thick }
    back:   { dash: dotted }   # 名前の線は補足の layout で  L3: { line: back }
\`\`\`

種類を書かないノードは種類の行を出さず、設定に無い矢印は既定の実線で描く。

## ノードの形

MAP-SLOT-SHAPES

| 設定 | 値 |
| --- | --- |
| \`label\` | ノードの種類の行に、アイコンの右に出す名前 |
| \`shape\` | \`rounded\`（角の丸い四角・既定）・\`rect\`（角の四角）・\`pill\`（端の丸い形）・\`double\`（二重の枠） |
| \`icon\` | Lucide のアイコンの名前（\`server\`・\`database\`・\`user\`・\`file\`・\`globe\`・\`cog\` など） |
| \`color\` | 色の名前（\`blue\`・\`red\`・\`green\`・\`yellow\`・\`orange\`・\`purple\`・\`gray\`） |

## 線の模様

MAP-SLOT-LINES

| 設定 | 値 |
| --- | --- |
| \`dash\` | \`solid\`（既定）・\`dashed\`・\`dotted\`・\`dash-dot\`・\`long-dash\` |
| \`width\` | \`thin\`・\`normal\`（既定）・\`thick\` |
| \`head\` | \`filled\`（塗りの矢じり・既定）・\`open\`（線の矢じり）・\`none\`（矢じり無し） |
| \`color\` | 色の名前 |

## 設定の例 1: システムの構成

MAP-SLOT-SYSTEM

アプリ・保存先・外部のサービスの 3 種類と、破線・太い線を作った例。

## 設定の例 2: 業務の流れ

MAP-SLOT-WORK

担当者・書類・システムの 3 種類と、灰色の点線を作った例。同じ map の図でも、設定を変えると別の分野の図になる。
`;

const doc = document.getElementById("doc");
mount(doc, { markdown });
const slot = (text) => [...doc.querySelectorAll("p")].find((p) => p.textContent.trim() === text);
const place = (text, spec) => {
  const host = document.createElement("div");
  host.className = "map-host";
  slot(text).replaceWith(host);
  createMap(host, spec);
};

// 線を持たないノードは自動配置で 1 列に並ぶため、見本では座標の固定（補足の layout の pos）で横に並べる
const row = Object.fromEntries(["a", "b", "c", "d", "e"].map((id, index) => [id, { pos: { x: index * 180, y: 0 } }]));
place("MAP-SLOT-SHAPES", { id: "kinds-shapes", title: "ノードの形", flow: SHAPES, config: SHAPE_CONFIG, data: { layout: row } });
place("MAP-SLOT-LINES", { id: "kinds-lines", title: "線の模様", flow: LINES, config: LINE_CONFIG, data: { layout: LINE_LAYOUT } });
place("MAP-SLOT-SYSTEM", { id: "kinds-system", title: "システムの構成", flow: SYSTEM, config: SYSTEM_CONFIG, data: {} });
place("MAP-SLOT-WORK", { id: "kinds-work", title: "業務の流れ", flow: WORK, config: WORK_CONFIG, data: {} });
