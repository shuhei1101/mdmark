import type { MdmarkDiagramKind, MdmarkFlowDefinition } from "./definition.ts";
/** 座標を省いた判定フローチャートのノードの既定の大きさと配置の間隔（px）。大きさと間隔はモックの `judgement-auto` と同じ値 */
export declare const FLOWCHART_LAYOUT: {
    sizes: Partial<Record<MdmarkDiagramKind, {
        w: number;
        h: number;
    }>>;
    gapY: number;
    gapX: number;
    margin: number;
    lineStep: number;
};
/** 座標を省いた判定フローチャートの定義に、ノードの座標・線の点・図の大きさを入れた定義を返却する */
export declare function layoutFlowchart(definition: MdmarkFlowDefinition): MdmarkFlowDefinition;
