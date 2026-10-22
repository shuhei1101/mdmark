/** 図のツールチップ（線の詳細・箱の説明と入力・処理・出力・箱の中の用語）と、埋め込んだ HTML のヒント（`div.mdmark-html` を渡したとき）の操作を付け、開いているものを閉じる関数と、操作を外す関数を返す。ポインターとフォーカスで開き、上に乗っても消えず、Esc で閉じる。箱は右上の印の上、ヒントはブロックの要素の印か行内の要素の上でだけ開く */
export declare function attachDiagramTips(figure: HTMLElement): {
    closeOpen: () => boolean;
    detach: () => void;
};
