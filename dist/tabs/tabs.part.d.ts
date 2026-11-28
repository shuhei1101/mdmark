/** タブを描く。`group` を指定すると `data-group` に写し、`wrap` が真なら `data-wrap` を付ける。`selected` を指定するとタブの並びを付け、選んだもの以外の中身を `hidden` にする。`collapse` が `closed`・`open` なら、折り畳みに入れる */
export declare function renderTabs(options: {
    /** タブの id の頭 */
    id: string;
    /** タブ名の行内の HTML（エスケープ済み） */
    titles: string[];
    /** タブごとの中身の HTML（`SLOT_MARKER` を指定できる） */
    panels: string[];
    /** 選んだタブの位置（0 から） */
    selected?: number;
    /** タブの組の名前 */
    group?: string;
    /** タブ名の並びを折り返すか（既定 `false`） */
    wrap?: boolean;
    /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
    collapse?: "none" | "closed" | "open";
    /** 折り畳みの見出し（既定は `タブ（{タブ名を・で並べたもの}）`） */
    title?: string;
}): string;
