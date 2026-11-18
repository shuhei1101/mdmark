import type { StateCore } from "markdown-it";
/** `columns` がオンなら、`<!-- columns -->` 〜 `<!-- /columns -->` を `<!-- column -->` で区切り、2〜3 列なら段組みで囲む。列の数が合わない範囲と入れ子の内側は警告を差し込んで囲まない */
export declare const buildLayoutColumns: (state: StateCore) => void;
