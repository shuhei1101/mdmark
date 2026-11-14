import { type PartStates } from "./part-states.ts";
/** ER 図のテーブルの列を畳む・開く: 主キーと外部キー以外の列の行・非表示の行・開閉のボタンを切り替え、関係の線をもう一度結ぶ */
export declare function setErTableFolded(options: {
    table: HTMLElement;
    folded: boolean;
}): void;
/** ER 図の開閉のボタンを押したら（Enter・Space を含む）列を畳む・開く。フォーカスはボタンに残す。付けた受け取りを解除する関数を返却する */
export declare function attachErFolds(figure: HTMLElement, states?: PartStates): () => void;
