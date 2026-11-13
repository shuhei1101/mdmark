/** 見出し `フロントマター` の閉じた折りたたみに、中身の HTML を入れて返却する。`body` は `SLOT_MARKER` を指定できる */
export declare const renderFrontmatter: (options: {
    /** 中身の HTML */
    body: string;
    /** 開いた状態から始めるか */
    open?: boolean;
}) => string;
