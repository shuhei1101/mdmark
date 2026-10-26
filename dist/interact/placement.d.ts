import type { TooltipPlacement } from "../config.ts";
/** 持ち主の上端・下端とツールチップの高さから、ツールチップを上と下のどちらに置くかを返す。先に出す側に収まればそちら、収まらず反対側に収まればそちら、どちらにも収まらなければ下 */
export declare function chooseTipSide(options: {
    /** 持ち主の画面に対する上端（px） */
    anchorTop: number;
    /** 持ち主の画面に対する下端（px） */
    anchorBottom: number;
    /** ツールチップの高さ（px） */
    height: number;
    /** 持ち主との間（px） */
    gap: number;
    /** 画面の高さ（px） */
    viewportHeight: number;
    /** 先に出す側 */
    placement: TooltipPlacement;
}): TooltipPlacement;
