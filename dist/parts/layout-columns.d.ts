/** 段組みの HTML を返却する。列ごとの中身は `SLOT_MARKER` を指定できる */
export declare const renderLayoutColumns: (options: {
    /** 列ごとの中身の HTML */
    columns: string[];
}) => string;
