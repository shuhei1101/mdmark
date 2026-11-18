/** 押した位置からこの px を超えて動いたときだけ図を動かしたことにし、リンク先を開かない。超えないうちはグラフの項目のツールチップを優先する */
export declare const DRAG_THRESHOLD = 4;
/** 倍率が変わったときに呼ぶ関数 */
export type ZoomChange = (zoom: number, fit: number) => void;
/** `attachZoom` が返却する操作 */
export type ZoomControl = {
    /** 全体が収まる倍率と位置に戻す */
    reset(): void;
    /** 今の全体が収まる倍率を返却する */
    fit(): number;
    /** 今の倍率と位置を保ったまま、全体が収まる倍率とボタンの状態をもう一度求める */
    refit(): void;
    /** 付けた操作と監視を解除する */
    detach(): void;
};
/** 表示する枠と中身に、全体が収まる倍率から `ZOOM.max` までの拡大・縮小と、拡大中の移動（ボタン・キー・ドラッグ）を付ける */
export declare function attachZoom(options: {
    /** 表示する枠 */
    viewport: HTMLElement;
    /** 倍率を掛ける中身（親の要素を倍率を掛けた大きさのノードにする） */
    content: HTMLElement;
    /** 中身の大きさ */
    size: {
        width: number;
        height: number;
    };
    /** `data-tool` のボタンと `data-group="pan"` のまとまりを持つ要素 */
    tools: HTMLElement;
    /** 倍率が変わったときに呼ぶ関数（ボタンの状態を書き換える前に呼ぶ） */
    onChange?: ZoomChange;
    /** ドラッグで動かし始めたときに呼ぶ関数 */
    onPanStart?: () => void;
    /** 全体が収まる倍率を高さでも決めるか（既定 `true`。文書の中の図は幅だけで決める）。関数のときは倍率を求めるたびに呼ぶ */
    fitHeight?: boolean | (() => boolean);
    /** ドラッグを始めない要素のセレクタ（押せる所に加える） */
    dragIgnore?: string;
    /** キーを受ける要素（既定は表示する枠とボタンを持つ要素） */
    keyTargets?: HTMLElement[];
    /** 倍率の文字の基準（`fit` は全体が収まる倍率、`content` は中身の大きさを 100% とする。既定 `content`） */
    percentBase?: "fit" | "content";
    /** 全体が収まる倍率の下限（既定は下限なし） */
    fitMin?: number;
}): ZoomControl;
