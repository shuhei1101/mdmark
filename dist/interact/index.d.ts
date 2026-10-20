import type { MdmarkParamDefinition } from "../diagram/definition.ts";
/** 機能がオンの記法だけ操作を付け、`diagrams` がオンなら図と操作できる部品の操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、まとめて外す関数を返す */
export declare function attachInteractions(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** 描いた操作できる部品の定義。`div.mdmark-param` の並びと同じ順（既定 `[]`） */
    paramDefinitions?: MdmarkParamDefinition[];
}): () => void;
