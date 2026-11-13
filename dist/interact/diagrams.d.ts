import type { TooltipPlacement } from "../config.ts";
import { ZOOM } from "../diagram/geometry.ts";
export { ZOOM };
/** 図の中身を再描画したときに `figure` へ送信するイベント（ツールチップをもう一度付ける） */
export declare const DIAGRAM_REDRAW_EVENT = "mdmark-diagram-redraw";
/** 図の `id` の頭 `from` を `to` にもう一度振り、それを指す属性も合わせて修正する */
export declare function renumberIds(scope: HTMLElement, from: string, to: string): void;
/** 図を全画面のモーダルで開き、開いた全画面を閉じる関数を返却する。閉じるボタンか Esc で閉じたら、付けた操作と監視を解除して `dialog` を削除し、フォーカスを全画面のボタンへ戻す */
export declare function openDiagramDialog(options: {
    /** 開く図 */
    figure: HTMLElement;
    /** 全画面のボタン */
    opener: HTMLButtonElement;
    /** モーダルの中のツールチップを先に出す側 */
    placement: TooltipPlacement;
}): () => void;
/** `root` の中の図ごとに、開いたときの倍率を当て、拡大・縮小・移動・全画面のボタンとキー・ドラッグ、ツールチップを付ける。付けた操作と監視を解除し、開いている全画面を閉じる関数を返却する */
export declare function attachDiagrams(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 図のツールチップを先に出す側（`attachDiagramTips` と `openDiagramDialog` へ指定する） */
    placement: TooltipPlacement;
    /** リサイズハンドルで変えた高さを保つ先（既定は sessionStorage） */
    storage?: Storage | null;
    /** 付ける図（省くと `root` の中の全ての図。高さのキーの通し番号は `root` の中の順） */
    figures?: HTMLElement[];
}): () => void;
