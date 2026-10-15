import type { StateCore } from "markdown-it";
/** `callout` がオンなら、1 行目が `[!種類]` の引用を注意書きの部品にし、種類の文字を本文から外す。知らない種類は `note` */
export declare function buildCallouts(state: StateCore): void;
