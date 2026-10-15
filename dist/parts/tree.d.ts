/** 罫線を読んだ 1 項目 */
export type TreeNode = {
    /** 項目の名前 */
    name: string;
    /** 子の項目 */
    children?: TreeNode[] | undefined;
};
/** ファイルツリーの HTML を返す */
export declare function renderTree(options: {
    /** 項目 */
    nodes: TreeNode[];
}): string;
