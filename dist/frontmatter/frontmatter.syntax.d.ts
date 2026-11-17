import type { StateCore } from "markdown-it";
/** `frontmatter` がオンで中身が空白だけでないとき、本文の先頭にフロントマターの折りたたみと、中身の yaml の fence を差し込む */
export declare const insertFrontmatter: (state: StateCore) => void;
