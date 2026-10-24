import type { DiffBlock } from "../diff/compute.ts";
/** 部品設計『差分の行』: 比べた行を並べた HTML を返す。埋め込んだ HTML の範囲の塊は `renderDiffHtml` で描く */
export declare function renderDiffLines(options: {
    /** 上から順の塊。埋め込んだ HTML の範囲の `before`・`after` は、スクリプトとイベントの属性を落とした HTML */
    blocks: DiffBlock[];
    /** 埋め込んだ HTML のプレビューの並べ方 */
    sides: "side" | "stack";
    /** プレビューの前と後に出すリビジョンの説明 */
    labels?: {
        before: string;
        after: string;
    };
}): string;
