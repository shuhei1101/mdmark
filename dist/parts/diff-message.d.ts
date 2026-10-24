/** 部品設計『差分の状態の文』: 差分の場所に、行の代わりに出す短い文（変更が無い・比較対象が無い・読み込んでいる）の HTML を返す。`loading` は読み上げの対象にしない */
export declare function renderDiffMessage(options: {
    /** 出す文 */
    kind: "same" | "single" | "loading";
    /** 回る表示を足すか（`loading` のとき。待ちが 2 秒を過ぎたとき） */
    spinner?: boolean;
}): string;
