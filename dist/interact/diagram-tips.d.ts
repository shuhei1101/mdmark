/** 図のツールチップ（線の詳細・箱の入力・処理・出力・箱の中の用語）の操作を付け、開いているものを閉じる関数と、操作を外す関数を返す。ポインターとフォーカスで開き、上に乗っても消えず、Esc で閉じる */
export declare function attachDiagramTips(figure: HTMLElement): {
    closeOpen: () => boolean;
    detach: () => void;
};
