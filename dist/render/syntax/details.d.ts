import type { StateCore } from "markdown-it";
import type { MarkOptions } from "../mark-options.ts";
/** マーカーの設定の `title`（空の文字か省くと `詳細`）と `open`（省くと `false`）を読み込む */
export declare const readDetailsOptions: (options: MarkOptions) => {
    title: string;
    open: boolean;
};
/** `details` がオンなら、`<!-- details: … -->` 〜 `<!-- /details -->` を開閉する `details` にする。閉じのマーカーが無いときは警告を差し込んで囲まない */
export declare const buildDetailsRanges: (state: StateCore) => void;
