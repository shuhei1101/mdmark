/** 押した位置からこの px を超えて動いたときだけ図を動かしたことにし、リンク先を開かない。超えないうちはグラフの項目のツールチップを優先する */
export declare const DRAG_THRESHOLD = 4;
/** `deltaMode` が行（`1`）の `wheel` を px に直すときの 1 行の量（px） */
export declare const WHEEL_LINE = 16;
/** ホイールの量を px に直す。行は `WHEEL_LINE` 倍、ページは横を `page.width`・縦を `page.height` 倍にする */
export declare const wheelDelta: (input: {
    event: {
        deltaX: number;
        deltaY: number;
        deltaMode: number;
    };
    page: {
        width: number;
        height: number;
    };
}) => {
    x: number;
    y: number;
};
/** 祖先のうち縦にスクロールする最も近い要素を返却する。無ければ文書のスクロールする要素 */
export declare const scrollParentOf: (element: HTMLElement) => Element;
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
    /** 中身の座標の矩形と周りの余白が表示する枠に収まる倍率と位置へ、`duration` ミリ秒かけて移す */
    focusRect(rect: FocusRect, options: {
        margin: number;
        duration: number;
    }): void;
    /** 倍率を変えずに、中身の座標の矩形の中心が表示する枠の中央に来る位置へ `duration` ミリ秒かけて移す。全体が収まる倍率で矩形が見えていれば移さない */
    centerRect(rect: FocusRect, options: {
        duration: number;
    }): void;
    /** 中身の大きさを差し替え、全体が収まる倍率に対する今の倍率の比（倍率の文字）を保つ */
    resize(next: {
        width: number;
        height: number;
    }): void;
    /** 付けた操作と監視を解除する */
    detach(): void;
};
/** 倍率を掛ける前の中身の座標の矩形 */
export type FocusRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
/** `attachZoom` を付けた表示する枠の操作を返却する（付けていなければ `undefined`） */
export declare const zoomControlOf: (viewport: HTMLElement) => ZoomControl | undefined;
/** 表示する枠と中身に、全体が収まる倍率の `ZOOM.minRatio` 倍から `ZOOM.maxRatio` 倍までの拡大・縮小（ボタン・キー・ピンチ）と、拡大中の移動（キー・ドラッグ）を付ける */
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
    /** `data-tool` のボタンを持つ要素 */
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
    /** 指の移動の扱い（`native` は表示する枠のスクロールとしてブラウザに任せ、`pointer` は指もドラッグで動かす。既定 `pointer`） */
    touchPan?: "native" | "pointer";
    /** 拡大して縦にスクロールできる間のホイールを、縦にスクロールする祖先へ渡すか（既定 `false`） */
    wheelToScroller?: boolean;
}): ZoomControl;
