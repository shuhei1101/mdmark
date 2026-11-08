/** 段組みの HTML を返す。列ごとの中身は `SLOT_MARKER` を渡せる */
export declare const renderLayoutColumns: (options: {
    /** 列ごとの中身の HTML */
    columns: string[];
}) => string;
