import type { TooltipPlacement } from "../config.ts";
/** 図のツールチップ（線の詳細・ノードの説明と入力・処理・出力・ノードの中の用語）と、埋め込んだ HTML のヒント（`div.mdmark-html` を指定したとき）の操作を付け、開いているものを閉じる関数と、操作を削除する関数を返却する。ポインターとフォーカスで開き、上に乗っても消えず、Esc で閉じる。タッチは持ち主のタップで開閉を切り替え、開いている間はツールチップと持ち主の外の `pointerdown` で閉じる。ノードは右上のマーカーの上、ヒントはブロックの要素のマーカーか行内の要素の上でだけ開く。配置する側は `chooseTipSide` が決める */
export declare function attachDiagramTips(options: {
    /** 図か、埋め込んだ HTML の `div.mdmark-html` */
    figure: HTMLElement;
    /** ツールチップを先に出す側 */
    placement: TooltipPlacement;
}): {
    closeOpen: () => boolean;
    detach: () => void;
};
