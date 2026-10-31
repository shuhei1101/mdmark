import type { StateCore } from "markdown-it";
import type { Mark } from "../marks.ts";
import { type CollapseMode } from "./collapse.ts";
import { type SyntaxWarning } from "./warnings.ts";
/** タブの印の引数から `group` と折り畳みの指定を読む。値の無い `group=`・読めないキー・`キー=値` の形でない指定は、1 つの書き方の警告にまとめる */
export declare function readTabsOptions(mark: Mark): {
    group?: string;
    collapse: CollapseMode;
    title?: string | undefined;
    warning?: SyntaxWarning;
};
/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。印の引数の `group` は部品へ渡し、読めない指定は警告を差し込む。見出しが無ければ警告を差し込み、中身をそのまま残す */
export declare function buildTabs(state: StateCore): void;
