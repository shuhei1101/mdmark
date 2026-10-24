/** タブを描く。`group` を渡すと `data-group` に写す。`selected` を渡すとタブの並びを付け、選んだもの以外の中身を `hidden` にする */
export declare function renderTabs(options: {
    /** タブの id の頭 */
    id: string;
    /** タブ名 */
    titles: string[];
    /** タブごとの中身の HTML（`SLOT_MARKER` を渡せる） */
    panels: string[];
    /** 選んだタブの位置（0 から） */
    selected?: number;
    /** タブの組の名前 */
    group?: string;
}): string;
