/** 比べた結果の 1 つの切れ */
export type DiffChange = {
    /** 切れの文字 */
    value: string;
    /** 後にだけある切れか */
    added: boolean;
    /** 前にだけある切れか */
    removed: boolean;
};
/** 行と語の比較。既定は jsdiff を包む `jsdiffEngine`、単体テストで差し替える */
export type DiffEngine = {
    /** 行ごとに比べる */
    lines: (pair: {
        before: string;
        after: string;
    }) => DiffChange[];
    /** 語ごとに比べる。`segmenter` が無いときは 1 文字ずつ比べる */
    words: (pair: {
        before: string;
        after: string;
        segmenter: Intl.Segmenter | undefined;
    }) => DiffChange[];
};
/** 差分の行の切れ（語）。対の行で変わった語だけ `changed` が true */
export type DiffPart = {
    text: string;
    changed: boolean;
};
/** 比べた 1 行 */
export type DiffLine = {
    /** 同じ行・前にだけある行・後にだけある行 */
    kind: "same" | "del" | "add";
    /** 行の文字を切った並び。対にならない行は 1 つだけで `changed` が false */
    parts: DiffPart[];
};
/** 行の塊か、埋め込んだ HTML の範囲の塊 */
export type DiffBlock = {
    type: "lines";
    lines: DiffLine[];
} | {
    type: "html";
    lines: DiffLine[];
    /** 範囲の行に `same` 以外があるか */
    changed: boolean;
    /** 前のリビジョンの範囲の `html` のコードブロックの中身。範囲が無ければ `null` */
    before: string | null;
    /** 後のリビジョンの範囲の `html` のコードブロックの中身。範囲が無ければ `null` */
    after: string | null;
};
/** 比べた結果 */
export type DiffResult = {
    /** 上から順の塊 */
    blocks: DiffBlock[];
    /** 削除した行と追加した行の数。どちらも 0 なら変更が無い */
    counts: {
        del: number;
        add: number;
    };
};
/** jsdiff の `diffLines`・`diffWords`・`diffChars` を包んだ既定の計算 */
export declare const jsdiffEngine: DiffEngine;
/** 2 つの Markdown のソースを行ごとに比べ、対の行を語ごとに比べ、埋め込んだ HTML の範囲を塊に分ける */
export declare function computeDiff(options: {
    /** 前の Markdown */
    before: string;
    /** 後の Markdown */
    after: string;
    /** 語の区切り。持たないブラウザでは `undefined` */
    segmenter: Intl.Segmenter | undefined;
    /** 比較の計算。既定は `jsdiffEngine` */
    engine?: DiffEngine;
}): DiffResult;
