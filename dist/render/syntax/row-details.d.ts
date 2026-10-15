import type { StateCore } from "markdown-it";
/** `row-details` がオンなら、表の直後の `row-detail` の範囲の中身を、その行の直後の行の詳細の行に移す。表に無い行は警告を差し込み、中身を表の後に残す */
export declare function attachRowDetails(state: StateCore): void;
