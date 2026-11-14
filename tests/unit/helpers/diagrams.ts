import sample from "../../../docs/guide/図を描く-見本.md?raw";
import { INQUIRY_TEXT } from "./retired-diagrams.ts";

export {
  INQUIRY_SEQ_TEXT,
  INQUIRY_TEXT,
  JUDGEMENT_TEXT,
} from "./retired-diagrams.ts";

/** 見本の文書に記載した部品の定義（`json` のコードブロックを記載した順に） */
const SAMPLE_BLOCKS: string[] = [
  ...sample.matchAll(/```json\n([\s\S]*?)\n```/g),
].map((match) => match[1] ?? "");

/** 見本の `json` のコードブロックのうち、`key` のキーを持つ最初の中身を返却する */
function block(key: string): string {
  const text = SAMPLE_BLOCKS.find((item) => item.includes(`"${key}"`));
  if (text === undefined) {
    throw new Error(`見本に ${key} を持つ定義が無い`);
  }
  return text;
}

/** 見本のグラフの定義（`reply-time`）の JSON */
export const REPLY_TIME_TEXT: string = block("series");

/** 見本の操作できる部品の定義（`strength`）の JSON */
export const STRENGTH_TEXT: string = block("knob");

/** 定義の JSON を読み込んだ値 */
export function parsed<T>(text: string): T {
  return JSON.parse(text) as T;
}

/** 部品のマーカーで囲んだ文書にする */
export function wrapDirective(directive: string, json: string): string {
  return [
    `<!-- ${directive} -->`,
    "",
    "```json",
    json,
    "```",
    "",
    `<!-- /${directive} -->`,
    "",
  ].join("\n");
}

/** モックの `judgement-auto` から座標・`points`・`width`・`height` を除き、線に `from`・`to` を追加した定義の JSON */
export const JUDGEMENT_AUTO_TEXT: string = JSON.stringify({
  title: "問い合わせの返信の判定",
  scope: "問い合わせを受け取ったとき",
  updated: "2026-11-04",
  nodes: [
    { id: "start", kind: "start", name: "問い合わせを受け取る" },
    { id: "q1", kind: "question", name: "よくある質問で回答できるか" },
    { id: "a1", kind: "action", name: "よくある質問のリンクを添える" },
    { id: "q2", kind: "question", name: "担当者が回答できるか" },
    { id: "r1", kind: "result", name: "返信を送信する" },
    { id: "r2", kind: "result", name: "開発に起票する" },
  ],
  wires: [
    { id: "j-start", from: "start", to: "q1", line: "flow" },
    { id: "j-q1-yes", from: "q1", to: "a1", line: "flow", label: "YES" },
    { id: "j-q1-no", from: "q1", to: "q2", line: "flow", label: "NO" },
    { id: "j-a1", from: "a1", to: "r1", line: "flow" },
    { id: "j-q2-yes", from: "q2", to: "r1", line: "flow", label: "YES" },
    { id: "j-q2-no", from: "q2", to: "r2", line: "flow", label: "NO" },
  ],
});

/**
 * インターフェース定義『設定と索引を点検する』の「正常系（文字列に記載の警告がある）」の Markdown。
 * 1 行目に廃止した `<!-- flow -->` の範囲、20 行目に `<!-- tabz -->`、22 行目に `<!-- code: {"highlight": [9]} -->` と 3 行のコードブロックを持つ
 */
export const WARNINGS_MARKDOWN: string = (() => {
  const flow = [
    "<!-- flow -->",
    "",
    "```json",
    JSON.stringify({
      title: "判定",
      scope: "点検",
      updated: "2026-11-05",
      nodes: [{ id: "s", kind: "begin", name: "始める" }],
      wires: [],
    }),
    "```",
    "",
    "<!-- /flow -->",
  ];
  const lines = [...flow];
  while (lines.length < 18) {
    lines.push("");
  }
  lines.push("本文", "<!-- tabz -->", "", '<!-- code: {"highlight": [9]} -->');
  lines.push(
    "```ts",
    "const a = 1;",
    "const b = 2;",
    "const c = 3;",
    "```",
    "",
  );
  return lines.join("\n");
})();

/** 見本のフロー図に、システムの枠と LLM の層の `hint` を加えた定義（モックの `inquiry-groups`）の JSON */
export const INQUIRY_GROUPS_TEXT: string = (() => {
  const definition = JSON.parse(INQUIRY_TEXT) as {
    frame: Record<string, unknown>;
    lanes: Array<Record<string, unknown>>;
  };
  definition.frame = {
    ...definition.frame,
    hint: "メールの受け取りから返信までを受け持つ範囲",
  };
  definition.lanes = definition.lanes.map((lane) =>
    lane.kind === "llm"
      ? { ...lane, hint: "返信の種類を選び、下書きを作成する" }
      : lane,
  );
  return JSON.stringify(definition);
})();

/** ノードの種類と線の種類が 1 つずつのフロー図の定義（モックの `single-kinds` に線の端を加えたもの）の JSON */
export const SINGLE_KINDS_TEXT: string = JSON.stringify({
  title: "下書きを確認する順番",
  scope: "送信の前",
  updated: "2026-11-04",
  width: 640,
  height: 120,
  nodes: [
    {
      id: "s-1",
      kind: "script",
      x: 24,
      y: 28,
      w: 160,
      h: 64,
      name: "宛先を確認する",
    },
    {
      id: "s-2",
      kind: "script",
      x: 240,
      y: 28,
      w: 160,
      h: 64,
      name: "本文を確認する",
    },
    {
      id: "s-3",
      kind: "script",
      x: 456,
      y: 28,
      w: 160,
      h: 64,
      name: "添付を確認する",
    },
  ],
  wires: [
    {
      id: "s-w1",
      from: "s-1",
      to: "s-2",
      line: "flow",
      points: [
        [184, 60],
        [240, 60],
      ],
    },
    {
      id: "s-w2",
      from: "s-2",
      to: "s-3",
      line: "flow",
      points: [
        [400, 60],
        [456, 60],
      ],
    },
  ],
});
