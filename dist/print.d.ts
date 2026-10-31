/** 印刷の前に、要素の中の閉じた折り畳み・閉じた節・行の詳細・ファイルツリーの閉じたフォルダを開き、タブの全ての中身を出し、印刷の後に開いたものだけを戻す受け取りを `window` に付け、外す関数を返す */
export declare function attachPrint(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 印刷の機能がオンか（印刷のたびに読む） */
    isEnabled: () => boolean;
}): () => void;
