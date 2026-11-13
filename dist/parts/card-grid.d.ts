import { type MdmarkIconNode } from "./inline-icon.ts";
/** カードの格子のカード 1 枚の中身 */
export type CardGridItem = {
    /** タイトルの HTML */
    title: string;
    /** リンク先。無いときはリンクではないカード */
    href?: string | undefined;
    /** Lucide のアイコンの名前 */
    icon?: string | undefined;
    /** 説明の HTML */
    description?: string | undefined;
};
/** カードの格子の HTML を返却する */
export declare const renderCardGrid: (options: {
    /** 項目ごとのカードの中身 */
    items: CardGridItem[];
    /** まとめていない名前のアイコンの形状の表 */
    icons?: Record<string, MdmarkIconNode> | undefined;
}) => string;
