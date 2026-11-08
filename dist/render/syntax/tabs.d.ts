import type { StateCore, Token } from "markdown-it";
import type { Mark } from "../marks.ts";
import { type CollapseMode } from "./collapse.ts";
import { type SkippedArg, type SyntaxWarning } from "./warnings.ts";
/** タブの印の引数から `group` と折り畳みの指定を読む。値の無い `group=` は 1 つの書き方の警告にまとめ、知らないキーと `キー=値` の形でない指定は読み飛ばした引数にする */
export declare function readTabsOptions(mark: Mark): {
    group?: string;
    collapse: CollapseMode;
    title?: string | undefined;
    warning?: SyntaxWarning;
    skipped: SkippedArg[];
};
/** `openIndex` のタブのマーカーと同じ階層のタブの開きと閉じを数え、対応する閉じの位置（無ければ `-1`）と、範囲に別のタブの開きを持つかを返す */
export declare function findTabsClose(tokens: Token[], openIndex: number): {
    close: number;
    nested: boolean;
};
/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。中身の中のタブの範囲も同じ処理でタブにする。印の引数の `group` は部品へ渡し、読めない指定は警告を差し込む。見出しが無ければ警告を差し込み、中身をそのまま残す */
export declare function buildTabs(state: StateCore): void;
