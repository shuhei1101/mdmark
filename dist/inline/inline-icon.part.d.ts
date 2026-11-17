import { type MdmarkIconNode } from "../shared/icon-node.logic.ts";
/** 行内のアイコンの HTML を返却する。構造があれば svg を中に入れ、無ければ中を空にする */
export declare const renderInlineIcon: (options: {
    /** アイコンの名前 */
    name: string;
    /** アイコンの形状 */
    node?: MdmarkIconNode | undefined;
}) => string;
