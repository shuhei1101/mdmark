import type { StateCore } from "markdown-it";
/** `tabs` がオンなら、`tabs` の範囲を最初に出る見出しの階層で区切り、タブの部品にする。見出しが無ければ警告を差し込み、中身をそのまま残す */
export declare function buildTabs(state: StateCore): void;
