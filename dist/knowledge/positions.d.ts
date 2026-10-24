import type { Token } from "markdown-it";
/** 本文の位置 `cursor` から、照合した文字を 1 文字ずつ本文へ当て、各文字の本文の位置と当て終えた位置を返す */
export declare function alignText(options: {
    body: string;
    cursor: number;
    text: string;
}): {
    offsets: number[];
    end: number;
};
/** 行内のトークンの子を頭から本文へ当て、照合してよい `text` の子ごとに各文字の本文の位置を返す */
export declare function inlineOffsets(options: {
    body: string;
    inline: Token;
    start: number;
}): {
    byChild: Map<number, number[]>;
    end: number;
};
/** 埋め込んだ HTML のうち、照合に渡らない範囲を、どの文字にも当たらない文字で伏せた同じ長さの文字列を返す */
export declare function maskEmbeddedHtml(html: string): string;
