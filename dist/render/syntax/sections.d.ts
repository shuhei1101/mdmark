import type { StateCore } from "markdown-it";
/** `sections` がオンなら、h1〜h4 の見出しの後ろから次の同じか上の階層の見出しの前までを節の中身の要素で囲む。タブの中身の中で開いた節は、次の見出しより前にその中身が終わるときは中身の終わりで閉じる（タブの外で開いた節はタブをまたいで続く） */
export declare function wrapSections(state: StateCore): void;
