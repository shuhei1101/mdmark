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
      ? { ...lane, hint: "返信の種類を選び、下書きを書く" }
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
