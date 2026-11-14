import type { StateCore } from "markdown-it";
/** `views` がオンのとき、`<!-- view: {…} -->` の範囲を `div.mdmark-view` の囲みにし、範囲の最初の表に表の部品の指定を当て、記載方法の誤りを警告にする */
export declare function buildViews(state: StateCore): void;
