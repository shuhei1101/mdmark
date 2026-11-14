import type { StateCore, Token } from "markdown-it";
import { type CalloutKind } from "../../parts/callout.ts";
/** 引用の最初の段落の 1 行目（最初の `softbreak` の手前まで）から、注意書きの種類・開閉・タイトルの HTML を読み込む。注意書きでなければ `undefined` */
export declare function readCallout(options: {
    state: StateCore;
    tokens: Token[];
    openIndex: number;
}): {
    kind: CalloutKind;
    collapsed: boolean;
    open: boolean;
    title?: string;
} | undefined;
/** `callout` がオンなら、1 行目が `[!種類]` の引用を注意書きの部品にし、1 行目を本文から除外する。知らない種類は `note`。注意書きの本文の中の引用も注意書きにする */
export declare function buildCallouts(state: StateCore): void;
