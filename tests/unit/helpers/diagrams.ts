import guide from "../../../docs/使い方/図を描く/図を描く.md?raw";
import sample from "../../../docs/使い方/図を描く/見本.md?raw";

/** 見本の文書に書いた部品の定義（`json` のコードブロックを書いた順に） */
const SAMPLE_BLOCKS: string[] = [
  ...sample.matchAll(/```json\n([\s\S]*?)\n```/g),
].map((match) => match[1] ?? "");

/** 見本の `json` のコードブロックの中身を返す（文書の並びの番号） */
function block(index: number): string {
  const text = SAMPLE_BLOCKS[index];
  if (text === undefined) {
    throw new Error(`見本の定義が無い: ${index}`);
  }
  return text;
}

/** 見本のフロー図の定義（`inquiry`）の JSON */
export const INQUIRY_TEXT: string = block(0);

/** 見本のシーケンス図の定義（`inquiry-seq`）の JSON */
export const INQUIRY_SEQ_TEXT: string = block(1);

/** 見本のグラフの定義（`reply-time`）の JSON */
export const REPLY_TIME_TEXT: string = block(2);

/** 見本の操作できる部品の定義（`strength`）の JSON */
export const STRENGTH_TEXT: string = block(3);

/** 使い方『図を描く』の判定フローチャートの定義（モックの `judgement` に線の端を加えたもの）の JSON */
export const JUDGEMENT_TEXT: string = (() => {
  const found = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)]
    .map((match) => match[1] ?? "")
    .find((text) => text.includes('"kind": "question"'));
  if (found === undefined) {
    throw new Error("使い方『図を描く』に判定フローチャートの定義が無い");
  }
  return found;
})();

/** 定義の JSON を読んだ値 */
export function parsed<T>(text: string): T {
  return JSON.parse(text) as T;
}

/** 部品の印で囲んだ文書にする */
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

/** モックの `judgement-auto` から座標・`points`・`width`・`height` を除き、線に `from`・`to` を足した定義の JSON */
export const JUDGEMENT_AUTO_TEXT: string = JSON.stringify({
  title: "問い合わせの返信の判定",
  scope: "問い合わせを受け取ったとき",
  updated: "2026-11-04",
  nodes: [
    { id: "start", kind: "start", name: "問い合わせを受け取る" },
    { id: "q1", kind: "question", name: "よくある質問で答えられるか" },
    { id: "a1", kind: "action", name: "よくある質問のリンクを添える" },
    { id: "q2", kind: "question", name: "担当者が答えられるか" },
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

/** モックの `linked` の定義（線に `from`・`to` を足したもの）の JSON */
export const LINKED_TEXT: string = JSON.stringify({
  title: "問い合わせの処理",
  scope: "受け取りから記録まで",
  updated: "2026-11-04",
  width: 708,
  height: 152,
  nodes: [
    { id: "recv", kind: "script", x: 24, y: 40, w: 180, h: 72, name: "問い合わせを受け取る", href: "https://example.com/spec" },
    {
      id: "classify",
      kind: "llm",
      x: 264,
      y: 40,
      w: 180,
      h: 72,
      name: "分類する",
      href: "./other.md",
      io: { in: "問い合わせの本文", do: "種類を 1 つ選ぶ", out: "種類と確度" },
    },
    { id: "store", kind: "data", x: 504, y: 40, w: 180, h: 72, name: "記録する" },
  ],
  wires: [
    { id: "w-recv", from: "recv", to: "classify", line: "flow", points: [[204, 76], [264, 76]] },
    { id: "w-classify", from: "classify", to: "store", line: "write", points: [[444, 76], [504, 76]] },
  ],
});

/**
 * インターフェース定義『設定と索引を点検する』の「正常系（文字列に書き方の警告がある）」の Markdown。
 * 1 行目の `<!-- flow -->` の範囲にノードの種類 `begin` の定義、20 行目に `<!-- tabz -->`、22 行目に `<!-- code: highlight=9 -->` と 3 行のコードブロックを持つ
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
  lines.push("本文", "<!-- tabz -->", "", "<!-- code: highlight=9 -->");
  lines.push("```ts", "const a = 1;", "const b = 2;", "const c = 3;", "```", "");
  return lines.join("\n");
})();
