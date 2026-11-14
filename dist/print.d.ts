/** 印刷の前に、要素の中の閉じた折り畳み・閉じたセクション・行の詳細・ファイルツリーの閉じたフォルダ・コードブロックの畳んだ行・ER 図の畳んだテーブルを開き、タブの全ての中身を出し、印刷の後に開いたものだけを戻す受け取りを `window` に付け、削除する関数を返却する */
export declare function attachPrint(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 印刷の機能がオンか（印刷のたびに読み込む） */
    isEnabled: () => boolean;
}): () => void;
