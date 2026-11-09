import type { StateCore } from "markdown-it";
/** `pagebreak` がオンなら `<!-- pagebreak -->` を改ページの要素にする（オフの印は `dropMarks` が取り除く） */
export declare const buildPagebreaks: (state: StateCore) => void;
