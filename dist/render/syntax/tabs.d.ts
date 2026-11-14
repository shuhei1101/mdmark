import type { StateCore, Token } from "markdown-it";
import type { Mark } from "../marks.ts";
import { type CollapseMode } from "./collapse.ts";
/** タブのマーカーの設定から `group` と折り畳みの指定を読み込む */
export declare function readTabsOptions(mark: Mark): {
    group?: string;
    collapse: CollapseMode;
    title?: string | undefined;
};
/** `openIndex` のタブのマーカーと同じ階層のタブの開きと閉じを数え、対応する閉じの位置（無ければ `-1`）と、範囲に別のタブの開きを持つかを返却する */
export declare function findTabsClose(tokens: Token[], openIndex: number): {
    close: number;
    nested: boolean;
};
/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。中身の中のタブの範囲も同じ処理でタブにする。マーカーの引数の `group` は部品へ指定し、読み込めない指定は警告を差し込む。見出しが無ければ警告を差し込み、中身をそのまま残す */
export declare function buildTabs(state: StateCore): void;
