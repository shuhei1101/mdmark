/** 動画と音声の再生のダイアログの `dialog` の HTML を返却する */
export declare const renderMediaModal: (options: {
    /** タイトルの `id` の頭 */
    id: string;
    /** 動画か音声か */
    kind: "video" | "audio";
    /** ファイルの URL */
    src: string;
    /** タイトルとスクリーンリーダー向けの名前 */
    label: string;
    /** キャプション */
    caption?: string;
    /** 再生前に出す画像（動画だけ） */
    poster?: string;
    /** ミュートにして始める */
    muted?: boolean;
    /** 繰り返し再生する */
    loop?: boolean;
}) => string;
