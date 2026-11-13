import type { MdmarkDiagramNode, MdmarkFlowDefinition } from "./definition.ts";
/** 描いた文書の CSS の `.mdmark-diagram-node` と同じ文字の大きさ（px）・行の高さの倍率・余白（px）。CSS を修正したときは合わせて修正する */
export declare const LABEL_METRICS: {
    kindSize: number;
    nameSize: number;
    subSize: number;
    lineHeight: number;
    padY: number;
    padX: number;
};
/** フロー図の配置のずれの種類 */
export type FlowLayoutKind = "diagram_node_overlap" | "diagram_node_overflow" | "diagram_wire_crosses_node" | "diagram_label_too_long";
/** フロー図の配置のずれ 1 件 */
export type FlowLayoutIssue = {
    /** ずれの種類 */
    kind: FlowLayoutKind;
    /** 対象のノードか線の `id` */
    ids: string[];
};
/** 全角の文字を文字の大きさ、半角の文字を 0.6 倍の幅とみなし、幅で折り返した行の数を返却する（空の文字は 0） */
export declare function labelLineCount(options: {
    text: string;
    fontSize: number;
    width: number;
}): number;
/** ノードの種類・名前・補足を折り返した行の高さの合計が、ノードの高さに収まらないか（上下の余白には文字がはみ出してよい） */
export declare function labelTooLong(node: MdmarkDiagramNode): boolean;
/** フロー図の定義の、ノードの重なり・はみ出し・線のノードの横切り・収まらないラベルを、ずれ 1 つにつき 1 件にして返却する */
export declare function checkFlowLayout(definition: MdmarkFlowDefinition): FlowLayoutIssue[];
