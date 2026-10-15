import type { StateCore } from "markdown-it";
/** `sections` がオンなら、h2〜h4 の見出しの後ろから次の同じか上の階層の見出しの前までを節の中身の要素で囲む */
export declare function wrapSections(state: StateCore): void;
