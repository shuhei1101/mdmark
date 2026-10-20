import { ZOOM } from "../diagram/geometry.ts";
export { ZOOM };
/** 図の `id` の頭 `from` を `to` に振り直し、それを指す属性も合わせて直す */
export declare function renumberIds(scope: HTMLElement, from: string, to: string): void;
/** 図を全画面のモーダルで開き、開いた全画面を閉じる関数を返す。閉じるボタンか Esc で閉じたら、付けた操作と監視を外して `dialog` を消し、フォーカスを全画面のボタンへ戻す */
export declare function openDiagramDialog(figure: HTMLElement, opener: HTMLButtonElement): () => void;
/** `root` の中の図ごとに、開いたときの倍率を当て、拡大・縮小・移動・全画面のボタンとキー・ドラッグ、ツールチップを付ける。付けた操作と監視を外し、開いている全画面を閉じる関数を返す */
export declare function attachDiagrams(root: HTMLElement): () => void;
