import { escapeHtml } from "./escape.ts";

/** 罫線を読んだ 1 項目 */
export type TreeNode = {
  /** 項目の名前 */
  name: string;
  /** 子の項目 */
  children?: TreeNode[] | undefined;
};

/** 項目 1 つを `li` にする。名前が `/` で終わるか子を持つ項目はフォルダ */
function renderNode(node: TreeNode): string {
  const children = node.children ?? [];
  const folder = node.name.endsWith("/") || children.length > 0;
  const name = `<span class="mdmark-tree-name">${escapeHtml(node.name)}</span>`;
  const nested = children.length
    ? `<ul>${children.map(renderNode).join("")}</ul>`
    : "";
  return `<li class="mdmark-tree-${folder ? "folder" : "file"}">${name}${nested}</li>`;
}

/** ファイルツリーの HTML を返す */
export function renderTree(options: {
  /** 項目 */
  nodes: TreeNode[];
}): string {
  return `<ul class="mdmark-tree" aria-label="ファイルツリー">${options.nodes.map(renderNode).join("")}</ul>`;
}
