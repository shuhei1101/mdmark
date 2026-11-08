import type { StateCore } from "markdown-it";
/** 印の引数の最後の語が `open` なら開いた状態にしてタイトルから外し、空のタイトルは `詳細` にする */
export declare const readDetailsOptions: (args: string) => {
    title: string;
    open: boolean;
};
/** `details` がオンなら、`<!-- details: … -->` 〜 `<!-- /details -->` を開閉する `details` にする。閉じの印が無いときは警告を差し込んで囲まない */
export declare const buildDetailsRanges: (state: StateCore) => void;
