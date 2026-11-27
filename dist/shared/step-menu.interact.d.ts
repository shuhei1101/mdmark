import { type IconName } from "./icons.part.ts";
/** メニューの 1 つのボタンの文言・アイコン・押せるか・押したときの処理 */
export type StepMenuItem = {
    /** ボタンの文言（`上へ移す`・`高くする` など） */
    label: string;
    /** 文言の前に出すアイコン */
    icon: IconName;
    /** 押せるか。開いたときと項目を押した後に呼ぶ */
    enabled: () => boolean;
    /** 押したときの処理 */
    run: () => void;
};
/** 開いたメニューを置き直す・閉じる関数 */
export type StepMenuHandle = {
    /** 項目の `disabled` を求め直し、開いた元の要素の今の位置に置き直す */
    refresh: () => void;
    /** メニューを閉じて削除し、`restoreFocus` が `true` なら開いた元の要素へフォーカスを戻す */
    close: (options: {
        restoreFocus: boolean;
    }) => void;
};
/** メニューを置く側 */
export type StepMenuSide = "below" | "above" | "right" | "left";
/** 開いた元の要素の周りの候補の側のうち、画面に収まり避ける矩形と重ならない最初の側の座標を返す */
export declare const placeStepMenu: (options: {
    /** 開いた元の要素の矩形 */
    anchor: DOMRect;
    /** メニューの大きさ */
    size: {
        width: number;
        height: number;
    };
    /** 重ねない矩形 */
    avoid: DOMRect[];
    /** 画面の大きさ */
    viewport: {
        width: number;
        height: number;
    };
    /** 試す側の順 */
    sides: ReadonlyArray<StepMenuSide>;
    /** 上下の候補の合わせ方。既定は `start` */
    align?: "start" | "center";
}) => {
    x: number;
    y: number;
    side: StepMenuSide;
};
/** 開いた元の要素のそばに popover の `role="group"` のメニューを開き、項目を押しても開いたままにする */
export declare const openStepMenu: (options: {
    /** 開いた元のボタン・ハンドル */
    opener: HTMLElement;
    /** メニューの `aria-label` */
    label: string;
    /** 並べる項目 */
    items: StepMenuItem[];
    /** メニューを重ねない矩形。`opener` の矩形は常に含める */
    avoid?: () => DOMRect[];
    /** 試す側の順 */
    sides?: ReadonlyArray<StepMenuSide>;
    /** 上下の候補の合わせ方 */
    align?: "start" | "center";
    /** Esc で閉じたときにフォーカスを戻す要素。既定は `anchor` の要素 */
    focusBack?: HTMLElement;
    /** 配置の基準にする今の要素（再描画で `opener` が置き換わるとき）。既定は `opener` */
    anchor?: () => HTMLElement | null;
    /** メニューを入れる要素。既定は `opener` の直後 */
    container?: HTMLElement;
    /** Esc・メニューの外の押下・`close` のどれで閉じたときも呼ぶ */
    onClose?: () => void;
}) => StepMenuHandle;
