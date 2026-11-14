import type { StateCore } from "markdown-it";
import type { WarningItem } from "../../extensions.ts";
import type { MapProblem } from "../../map/spec.ts";
/** 範囲の中の mermaid のコードブロックに付け、mermaid のライブラリで描くコードブロックの対象から外す印 */
export declare const MAP_SOURCE_META = "mdmarkMapSource";
/** 書き方の誤りの項目を、記載の警告の項目にする */
export declare const mapWarningItems: (problems: MapProblem[]) => WarningItem[];
/** `map` がオンのとき、`<!-- map -->` 〜 `<!-- /map -->` の範囲を div.mdmark-map にし、範囲の形の誤りを記載の警告にする。オフのときはマーカーと補足を取り除き、mermaid のブロックを普通のコードブロックとして残す */
export declare const buildMapRanges: (state: StateCore) => void;
