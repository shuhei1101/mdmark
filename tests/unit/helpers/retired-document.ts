import type { MapKind, MapLine } from "../../../src/map/spec.ts";

/**
 * シナリオ『バージョンを上げる』の「正常シナリオ（座標で書いた図を map へ書き換える）」の文書と、書き換えた後の期待値。
 * フロー図 2 つ（枠と層・種類の異なるノードと線・リンク先を持つ構成図と、判定フローチャート）とシーケンス図を持つ
 */

/** 枠と層 2 つ・`llm`・`script`・`data`・`external` のノード・`flow`・`read`・`write` の線を持つフロー図 */
const FLOW_DEFINITION = {
  title: "問い合わせの返信の構成",
  scope: "メールの受け取りから返信まで",
  updated: "2026-11-01",
  width: 760,
  height: 400,
  stickyTitles: false,
  frame: {
    title: "返信のシステム",
    x: 140,
    y: 10,
    w: 600,
    h: 380,
    hint: "受け取りから返信までを受け持つ",
  },
  lanes: [
    { label: "LLM", kind: "llm", y: 40, h: 100, hint: "返信を書く" },
    { label: "処理", kind: "mcp", y: 140, h: 120 },
  ],
  nodes: [
    {
      id: "mail",
      kind: "external",
      x: 10,
      y: 170,
      w: 110,
      h: 60,
      tag: "外部",
      name: "メールサーバー",
    },
    {
      id: "recv",
      kind: "script",
      x: 200,
      y: 170,
      w: 120,
      h: 60,
      name: "受け取り",
      io: { in: "メール", do: "本文を取り出す", out: "本文" },
    },
    {
      id: "draft",
      kind: "llm",
      x: 420,
      y: 60,
      w: 120,
      h: 60,
      name: "下書き",
      hint: "よくある質問から書く",
      href: "https://example.com/spec",
    },
    {
      id: "table",
      kind: "data",
      x: 420,
      y: 300,
      w: 120,
      h: 60,
      name: "問い合わせの表",
    },
  ],
  wires: [
    {
      id: "w-mail",
      from: "mail",
      to: "recv",
      line: "flow",
      points: [
        [120, 200],
        [200, 200],
      ],
      label: "メール",
      tip: "件名と本文",
    },
    {
      id: "w-body",
      from: "recv",
      to: "draft",
      line: "flow",
      points: [
        [320, 200],
        [420, 90],
      ],
      label: "本文",
    },
    {
      id: "w-save",
      from: "recv",
      to: "table",
      line: "write",
      points: [
        [260, 230],
        [420, 330],
      ],
      label: "保存",
    },
    {
      id: "w-read",
      from: "table",
      to: "draft",
      line: "read",
      points: [
        [480, 300],
        [480, 120],
      ],
      label: "記録",
    },
  ],
};

/** 開始・質問・アクション・結果のノードと `YES`・`NO` のラベルの線だけを持つ判定フローチャート */
const JUDGEMENT_DEFINITION = {
  title: "問い合わせの返信の判定",
  scope: "問い合わせを受け取ったとき",
  updated: "2026-11-02",
  width: 600,
  height: 400,
  nodes: [
    { id: "start", kind: "start", x: 250, y: 10, w: 100, h: 100, name: "受け取る" },
    {
      id: "q1",
      kind: "question",
      x: 160,
      y: 150,
      w: 280,
      h: 136,
      name: "よくある質問で回答できるか",
    },
    { id: "a1", kind: "action", x: 480, y: 180, w: 100, h: 72, name: "リンクを添える" },
    { id: "r1", kind: "result", x: 480, y: 320, w: 100, h: 60, name: "返信する" },
    { id: "r2", kind: "result", x: 200, y: 320, w: 200, h: 60, name: "担当者へ回す" },
  ],
  wires: [
    { id: "j-start", from: "start", to: "q1", line: "flow", points: [[300, 110], [300, 150]] },
    {
      id: "j-yes",
      from: "q1",
      to: "a1",
      line: "flow",
      points: [[440, 218], [480, 218]],
      label: "YES",
    },
    {
      id: "j-no",
      from: "q1",
      to: "r2",
      line: "flow",
      points: [[300, 286], [300, 320]],
      label: "NO",
    },
    { id: "j-a1", from: "a1", to: "r1", line: "flow", points: [[530, 252], [530, 320]] },
  ],
};

/** 参加者 3 つ・メッセージ 4 つ（`tip` を持つメッセージ 1 つ）・繰り返しを持つシーケンス図 */
const SEQUENCE_DEFINITION = {
  title: "依頼の流れ",
  scope: "依頼から回答まで",
  updated: "2026-11-03",
  participants: [
    { id: "user", kind: "external", name: "利用者" },
    { id: "app", kind: "script", name: "アプリ" },
    { id: "db", kind: "data", name: "データベース" },
  ],
  steps: [
    { from: "user", to: "app", label: "依頼する", tip: "依頼の内容" },
    { from: "app", to: "db", label: "参照する" },
    { from: "db", to: "app", label: "結果", reply: true },
    { from: "app", to: "user", label: "回答する", reply: true },
  ],
  loop: { label: "次の依頼" },
};

/** 廃止した図の範囲 */
const retiredRange = (directive: string, definition: unknown): string[] => [
  `<!-- ${directive} -->`,
  "",
  "```json",
  JSON.stringify(definition, null, 2),
  "```",
  "",
  `<!-- /${directive} -->`,
];

/** 範囲を差し替えた文書 */
const documentOf = (ranges: [string[], string[], string[]]): string =>
  [
    "# 問い合わせの返信",
    "",
    "返信の構成。",
    "",
    ...ranges[0],
    "",
    "返信の判定。",
    "",
    ...ranges[1],
    "",
    "依頼の流れ。",
    "",
    ...ranges[2],
    "",
    "`<!-- flow -->` の記載方法は廃止した。",
    "",
    "```markdown",
    "<!-- flow -->",
    "```",
    "",
  ].join("\n");

/** 書き換える前の文書 */
export const RETIRED_DOCUMENT: string = documentOf([
  retiredRange("flow", FLOW_DEFINITION),
  retiredRange("flow", JUDGEMENT_DEFINITION),
  retiredRange("sequence", SEQUENCE_DEFINITION),
]);

/** 書き換えた後の文書 */
export const RETIRED_DOCUMENT_CONVERTED: string = documentOf([
  [
    '<!-- map: {"title": "問い合わせの返信の構成"} -->',
    "",
    "```mermaid",
    "flowchart TB",
    '  subgraph frame["返信のシステム"]',
    '    subgraph lane1["LLM"]',
    "      draft[下書き]:::llm",
    "    end",
    '    subgraph lane2["処理"]',
    "      recv[受け取り]:::script",
    "    end",
    "    table[(問い合わせの表)]:::data",
    "  end",
    "  mail[外部<br>メールサーバー]:::external",
    "  mail -->|メール| recv",
    "  recv -->|本文| draft",
    "  recv -->|保存| table",
    "  table -->|記録| draft",
    '  click draft "https://example.com/spec"',
    "```",
    "",
    '<!-- map-data: {"version": 1, "notes": {"frame": {"text": "受け取りから返信までを受け持つ"}, "lane1": {"text": "返信を書く"}, "recv": {"text": "入力: メール\\n処理: 本文を取り出す\\n出力: 本文"}, "draft": {"text": "よくある質問から書く"}, "mail->recv": {"text": "件名と本文"}}, "layout": {"recv->table": {"line": "write"}, "table->draft": {"line": "read"}}} -->',
    "",
    "<!-- /map -->",
  ],
  [
    '<!-- map: {"title": "問い合わせの返信の判定"} -->',
    "",
    "```mermaid",
    "flowchart TB",
    "  start([受け取る]):::start",
    "  q1{よくある質問で回答できるか}:::question",
    "  a1[リンクを添える]:::action",
    "  r1([返信する]):::result",
    "  r2([担当者へ回す]):::result",
    "  start --> q1",
    "  q1 -->|YES| a1",
    "  q1 -->|NO| r2",
    "  a1 --> r1",
    "```",
    "",
    '<!-- map-data: {"version": 1} -->',
    "",
    "<!-- /map -->",
  ],
  [
    '<!-- map: {"title": "依頼の流れ"} -->',
    "",
    "```mermaid",
    "sequenceDiagram",
    "  participant user as 利用者",
    "  participant app as アプリ",
    "  participant db as データベース",
    "  loop 次の依頼",
    "    user->>app: 依頼する",
    "    app->>db: 参照する",
    "    db-->>app: 結果",
    "    app-->>user: 回答する",
    "  end",
    "```",
    "",
    '<!-- map-data: {"version": 1, "notes": {"1": {"text": "依頼の内容"}}} -->',
    "",
    "<!-- /map -->",
  ],
]);

/** 書き換えた文書が使用していたノードの種類（設定の `map.kinds` へ書き足す値） */
export const RETIRED_KINDS: Record<string, MapKind> = {
  external: { label: "外部", icon: "globe", shape: "rounded", color: "gray" },
  script: { label: "スクリプト", icon: "code-xml", shape: "rect", color: "blue" },
  llm: { label: "LLM", icon: "bot", shape: "rounded", color: "purple" },
  data: { label: "データ", icon: "database", shape: "double", color: "yellow" },
  start: { label: "開始", icon: "play", shape: "pill", color: "green" },
  question: {
    label: "質問",
    icon: "circle-question-mark",
    shape: "double",
    color: "orange",
  },
  action: { label: "アクション", icon: "wrench", shape: "rect", color: "blue" },
  result: { label: "結果", icon: "flag", shape: "pill", color: "purple" },
};

/** 書き換えた文書が使用していた `flow` 以外の線の種類（設定の `map.lines` へ書き足す値） */
export const RETIRED_LINES: Record<string, MapLine> = {
  read: { dash: "dashed", width: "normal", head: "open" },
  write: { dash: "solid", width: "thick", head: "filled" },
};
