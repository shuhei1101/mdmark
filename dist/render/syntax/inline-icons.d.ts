import type { StateCore } from "markdown-it";
/** Lucide のアイコンの名前の記載方法 */
export declare const ICON_NAME_PATTERN: RegExp;
/** `icon` がオンなら、頭が `icon:` の行内のコードのうち名前の記載方法に合うものを行内のアイコンにし、合わないものは段落の前に警告を配置する */
export declare const buildInlineIcons: (state: StateCore) => void;
