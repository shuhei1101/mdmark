import type { MarkdownIt } from "markdown-it";
/** markdown-it に、`==` で囲んだ文字を蛍光ペンにする行内のルールと、機能と色を適用するコアルールを追加する */
export declare const useHighlight: (md: MarkdownIt) => void;
