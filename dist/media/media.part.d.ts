/** 動画と音声の HTML を返却する */
export declare function renderMedia(options: {
    /** 動画か音声か */
    kind: "video" | "audio";
    /** ファイルの URL */
    src: string;
    /** スクリーンリーダー向けの名前 */
    alt: string;
    /** キャプション（title） */
    caption?: string;
    /** 幅（`300px` か `40%`） */
    width?: string;
    /** 再生前と印刷のときに出す画像（動画だけ） */
    poster?: string;
    /** 開いたときに再生する */
    autoplay?: boolean;
    /** ミュートにして始める */
    muted?: boolean;
    /** 繰り返し再生する */
    loop?: boolean;
}): string;
/** 再生のボタン（ラベルと再生のアイコン、`thumbnail` は `poster` のサムネイル）の HTML を返却する */
export declare function renderMediaOpener(options: {
    /** 動画か音声か */
    kind: "video" | "audio";
    /** ファイルの URL */
    src: string;
    /** ラベル（空ならファイル名） */
    alt: string;
    /** キャプション（title） */
    caption?: string;
    /** サムネイルにする画像（動画だけ） */
    poster?: string;
    /** 開いたときに再生する */
    autoplay?: boolean;
    /** ミュートにして始める */
    muted?: boolean;
    /** 繰り返し再生する */
    loop?: boolean;
    /** ラベルのボタンか、`poster` のサムネイルか */
    opener: "button" | "thumbnail";
    /** 表のセルの中・文の途中か（`false` は段落ごと包む） */
    inline: boolean;
}): string;
