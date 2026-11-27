import { type PartStates } from "../shared/part-states.interact.ts";
/** 各 `mdmark-code-bar` の右端にコピーのボタンを配置し、押すとコードをクリップボードへ書き込む。ボタンとタイマーを取り除く関数を返却する */
export declare function attachCodeCopy(root: HTMLElement): () => void;
/** 帯のコピーのボタンの前に折り返しのボタンを配置し、押すたびにそのブロックだけの折り返しを切り替える。ボタンと受け取りを取り除く関数を返却する */
export declare function attachCodeWraps(root: HTMLElement, options: {
    /** 設定の `code.wrap` */
    defaultWrap: boolean;
    /** 再描画で保つ部品の状態 */
    partStates?: PartStates | undefined;
    /** ボタンを付ける種類（機能 `code`・`tree` のオン・オフ。既定は両方） */
    blocks?: {
        code: boolean;
        tree: boolean;
    };
}): () => void;
