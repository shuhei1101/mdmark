/** 動画と音声の HTML を返す */
export declare function renderMedia(options: {
    /** 動画か音声か */
    kind: "video" | "audio";
    /** ファイルの URL */
    src: string;
    /** 読み上げの名前 */
    alt: string;
    /** キャプション（title） */
    caption?: string;
    /** 幅（`300px` か `40%`） */
    width?: string;
    /** 再生前と印刷のときに出す画像（動画だけ） */
    poster?: string;
    /** 開いたときに再生する */
    autoplay?: boolean;
    /** 音を消して始める */
    muted?: boolean;
    /** 繰り返し再生する */
    loop?: boolean;
}): string;
