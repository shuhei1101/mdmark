import type { StateCore } from "markdown-it";
/** 図の部品の `html_block` に付ける `meta` の印（図表の番号の対象にする） */
export declare const DIAGRAM_META = "diagram";
/** `diagrams` がオンなら、図の部品の印の範囲の `json` のコードブロックを定義として読み、図か操作できる部品の HTML にする。読めない定義は書き方の警告にする。範囲の中身は出力に残さない。オフのときは印だけを取り除く */
export declare function buildDiagrams(state: StateCore): void;
