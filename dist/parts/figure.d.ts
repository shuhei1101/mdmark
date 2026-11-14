/** 図表の番号のタイトルで囲んだ HTML を返却する。画像はタイトルを下、表はタイトルを上に配置する。`id` を省くと `id` を付けない */
export declare function renderFigure(options: {
    /** 囲むものの種類 */
    kind: "image" | "table";
    /** マーカーに記載した ID */
    id?: string;
    /** 文書の頭から種類ごとに数えた番号 */
    number: number;
    /** 画像の title（番号の後ろに配置する） */
    caption?: string;
    /** 囲む画像か表の HTML（`SLOT_MARKER` を指定できる） */
    body: string;
}): string;
