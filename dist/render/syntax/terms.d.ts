import type { StateCore } from "markdown-it";
/** `glossary` か `backlinks` がオンなら、本文の文字を辞書の語と照合し、当たった語を語とツールチップの組に置き換える */
export declare function termsRule(state: StateCore): void;
