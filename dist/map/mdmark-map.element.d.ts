/** ノードの押下のイベントの値 */
export type MdmarkNodeClickDetail = {
    /** 押したノードの Mermaid の ID */
    id: string;
};
/** map の設定 */
export type MdmarkMapOptions = {
    /** 図のタイトル */
    title?: string;
    /** 描いた直後に強調するノード */
    focus?: string;
};
/** カスタム要素の名前 */
export declare const MAP_ELEMENT_NAME = "mdmark-map";
/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
declare const BaseElement: typeof HTMLElement;
/** Mermaid と補足を代入すると、次のマイクロタスクで map の範囲と同じ図か通知ブロックを描き、ノードの押下を `mdmark-node-click` で送信するカスタム要素 */
export declare class MdmarkMapElement extends BaseElement {
    #private;
    /** Mermaid */
    get source(): string | undefined;
    set source(value: string | undefined);
    /** 補足 */
    get data(): object | undefined;
    set data(value: object | undefined);
    /** map の設定 */
    get options(): MdmarkMapOptions | undefined;
    set options(value: MdmarkMapOptions | undefined);
    /** 登録する前に代入されていたプロパティを取り出してアクセサーへ設定し、描画を予約する */
    connectedCallback(): void;
    /** `document` の受け取りを解除する（プロパティは残し、ページへ戻すと描き直す） */
    disconnectedCallback(): void;
    /** 描画を次のマイクロタスクに 1 回だけ予約する */
    scheduleRender(): void;
    /** 指定を確認し、map の範囲の Markdown を `render` して `attachMap` で図にする */
    renderNow(): Promise<void>;
}
/** 登録先に `mdmark-map` が登録されていなければ `MdmarkMapElement` を登録する */
export declare const defineMapElement: (registry: CustomElementRegistry) => void;
export {};
