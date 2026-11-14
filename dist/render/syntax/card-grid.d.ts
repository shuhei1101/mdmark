import type { StateCore } from "markdown-it";
/** `card-grid` がオンなら、`<!-- cards -->` 〜 `<!-- /cards -->` の中身のリスト 1 つをカードの格子にする。中身がリスト 1 つでないときは警告を差し込み、オフのときは何もしない（マーカーは後で取り除く） */
export declare const buildCardGrid: (state: StateCore) => void;
