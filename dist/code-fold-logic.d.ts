/** 行の頭の空白から、コードブロックの中で最も小さいインデントの幅（空白の数）を 1 レベル、タブを 1 レベルとしてレベルを決める。空白だけの行と空行は `undefined` */
export declare function measureIndents(texts: string[]): Array<number | undefined>;
/** 次の空でない行がより深い行を畳める行とし、その後ろの、次の同じ深さ以下の行の手前までの行の数を返却する（範囲の末尾の空行は含めない）。畳めない行は `undefined` */
export declare function foldLinesOf(indents: Array<number | undefined>): Array<number | undefined>;
/** 畳んだ行の後ろの畳む行の数の行を、隠す行の位置（0 から）にする。内側の畳んだ状態は外側を開いても残る */
export declare function hiddenLinesOf(options: {
    foldLines: Array<number | undefined>;
    folded: boolean[];
}): Set<number>;
/** 行を含む最も内側の畳める範囲（畳める行の後ろの畳む行の数の行）を返却する。深さは範囲の畳める行のレベルに 1 を追加した値。含む範囲が無ければ `undefined` */
export declare function guideRangeOf(options: {
    indents: Array<number | undefined>;
    foldLines: Array<number | undefined>;
    index: number;
}): {
    from: number;
    to: number;
    depth: number;
} | undefined;
