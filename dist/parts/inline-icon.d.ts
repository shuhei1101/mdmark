/** Lucide の IconNode（要素の名前と属性の並び） */
export type MdmarkIconNode = Array<[string, Record<string, string>]>;
/** IconNode を、許す要素と描画の属性だけを残した `svg.mdmark-icon` の文字にする */
export declare const iconNodeSvg: (node: MdmarkIconNode) => string;
/** 行内のアイコンの HTML を返却する。構造があれば svg を中に入れ、無ければ中を空にする */
export declare const renderInlineIcon: (options: {
    /** アイコンの名前 */
    name: string;
    /** アイコンの形状 */
    node?: MdmarkIconNode | undefined;
}) => string;
