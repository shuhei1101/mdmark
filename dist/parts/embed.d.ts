/** 外部ライブラリの印の場所に置く、読み込み中の枠の HTML を返す */
export declare function renderEmbed(options: {
    /** 印の名前 */
    name: string;
    /** 印の引数（既定 `[]`） */
    args?: string[];
    /** 印の範囲から読んだ定義の番号。範囲で書いた印だけが持つ */
    definition?: number;
}): string;
