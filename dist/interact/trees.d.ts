import { type PartStates } from "./part-states.ts";
/** フォルダを開く・閉じる。閉じた入れ子の `ul` は `hidden="until-found"` にして、ページ内検索が中を見つけられるようにする */
export declare function setFolderOpen(toggle: Element, open: boolean): void;
/** `render` が出したファイルツリーの注釈の列の位置を測って入れる（Storybook が帯と開閉のボタンを描いたツリーに使用する） */
export declare function alignFileTreeNotes(tree: HTMLElement): void;
/** 描いた要素の中のファイルツリーに、帯とコピーのボタン・フォルダの開閉・注釈の列の位置を付け、まとめて削除して `render` の出した状態に戻す関数を返却する */
export declare function attachFileTrees(root: HTMLElement, states?: PartStates): () => void;
