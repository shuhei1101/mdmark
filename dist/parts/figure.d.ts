/** 図表の番号の題で囲んだ HTML を返す。画像は題を下、表は題を上に置く。`id` を省くと `id` を付けない */
export declare function renderFigure(options: {
    /** 囲むものの種類 */
    kind: "image" | "table";
    /** 印に書いた ID */
    id?: string;
    /** 文書の頭から種類ごとに数えた番号 */
    number: number;
    /** 画像の title（番号の後ろに置く） */
    caption?: string;
    /** 囲む画像か表の HTML（`SLOT_MARKER` を渡せる） */
    body: string;
}): string;
