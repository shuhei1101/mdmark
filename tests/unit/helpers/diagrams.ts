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
