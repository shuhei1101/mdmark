import { type DiagramDirective, type MdmarkChartDefinition, type MdmarkParamDefinition } from "./definition.ts";
/** 値の変更のイベントの値 */
export type MdmarkParamChangeDetail = {
    /** 動かしたスライダーの `knob.key` */
    key: string;
    /** スライダーの今の値 */
    value: number;
};
/** グラフのカスタム要素の名前 */
export declare const GRAPH_ELEMENT_NAME = "mdmark-graph";
/** 操作できる部品のカスタム要素の名前 */
export declare const PARAM_GRAPH_ELEMENT_NAME = "mdmark-param-graph";
/** HTMLElement の無い環境（Node）で読み込んでも失敗しない基底のクラス */
declare const BaseElement: typeof HTMLElement;
/** 部品の定義を代入すると、次のマイクロタスクで図の部品か通知ブロックを描くカスタム要素の共通の処理 */
declare abstract class DiagramElement<Definition> extends BaseElement {
    #private;
    /** 描く図の部品のマーカーの名前 */
    protected abstract readonly directive: DiagramDirective;
    /** 部品の定義 */
    get definition(): Definition | undefined;
    set definition(value: Definition | undefined);
    /** 登録する前に代入されていた定義を取り出してアクセサーへ設定し、描画を予約する */
    connectedCallback(): void;
    /** 図の枠の操作を解除する（中身とプロパティは残す） */
    disconnectedCallback(): void;
    /** 描画を次のマイクロタスクに 1 回だけ予約する */
    scheduleRender(): void;
    /** 定義を確認し、誤りがあれば通知ブロックを、無ければ図の枠と図の部品を描く */
    renderNow(): void;
    /** 図の部品に固有の操作を付け、解除する関数を返却する */
    protected attachPart(_root: HTMLElement, _definition: Definition): () => void;
}
/** グラフの定義を代入すると、`chart` のマーカーの範囲と同じ図の枠とグラフか通知ブロックを描くカスタム要素 */
export declare class MdmarkGraphElement extends DiagramElement<MdmarkChartDefinition> {
    protected readonly directive = "chart";
}
/** 操作できる部品の定義を代入すると、`param` のマーカーの範囲と同じスライダーとグラフを描き、値の変更を `mdmark-param-change` で送信するカスタム要素 */
export declare class MdmarkParamGraphElement extends DiagramElement<MdmarkParamDefinition> {
    protected readonly directive = "param";
    protected attachPart(root: HTMLElement, definition: MdmarkParamDefinition): () => void;
}
/** 登録先に `mdmark-graph`・`mdmark-param-graph` が登録されていなければ、それぞれ登録する */
export declare const defineGraphElements: (registry: CustomElementRegistry) => void;
export {};
