import type { MdmarkMarkArgs, WarningItem } from "../../extensions.ts";
/** 折り畳みに入れるかと、既定の開閉 */
export type CollapseMode = "none" | "closed" | "open";
/** 表・タブ・ステップの印から `closed`・`open`・`title=` を読んだ結果 */
export type CollapseSpec = {
    /** 折り畳みに入れるかと既定の開閉。`closed` と `open` を両方書いたら `closed` */
    collapse: CollapseMode;
    /** 折り畳みの見出し（`title=` の値）。`collapse` が `none` のときと、値の無い `title=` では入れない */
    title?: string | undefined;
    /** 読めなかった指定 */
    items: WarningItem[];
    /** `closed`・`open`・`title=` を除いた残りの引数 */
    rest: MdmarkMarkArgs;
};
/** 表・タブ・ステップの印の引数から `closed`・`open`・`title=` を読む */
export declare function readCollapse(args: MdmarkMarkArgs): CollapseSpec;
