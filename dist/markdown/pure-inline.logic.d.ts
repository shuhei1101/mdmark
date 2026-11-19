/** 1 行の中の mdmark だけの行内の書き方と生の HTML を、mdmark の無い表示で読める文字にする */
export declare function convertPureInline(options: {
    /** 1 行 */
    line: string;
    /** 番号を振った図・表の ID（`fig-` を含む）から、表示する番号（`図 1`・`表 1`）の表 */
    numbers: Map<string, string>;
    /** 機能のオン・オフ */
    features: Record<string, boolean>;
}): string;
