/** 部品設計『差分のブロック』: 描いた文書のブロックを、追加・変更は追加の色、削除は削除の色で示す HTML を返却する。`block` は `html` を `div` で包み、`item`・`row` は `html` の `li`・`tr` に class を追加する。削除したブロックは中の要素の `data-source-line` と `id` を削除する */
export declare function renderDiffBlock(options: {
    /** 追加・変更したブロックか、削除したブロックか */
    kind: "add" | "del";
    /** `block` は本文のブロック、`item` はリストの項目（`li`）、`row` は表の行（`tr`） */
    unit: "block" | "item" | "row";
    /** 色を適用するブロックの描いた HTML */
    html: string;
}): string;
