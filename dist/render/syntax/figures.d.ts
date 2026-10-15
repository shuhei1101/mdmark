import type { StateCore } from "markdown-it";
/** `figures` がオンなら、`fig` の印の直後の画像の段落と表を図表の番号の部品で囲み、`#fig-{ID}` へのリンクの文字を番号に替える。切れた参照と重なった ID は警告を差し込む */
export declare function numberFigures(state: StateCore): void;
