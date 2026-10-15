/** 外部ライブラリか拡張を読めない印の場所に置く、知らせの枠の HTML を返す */
export declare function renderNotice(options: {
    /** 読めなかった印の名前 */
    name: string;
    /** 図の印か（既定 `true`） */
    figure?: boolean;
    /** 読めなかったもの（既定 `library`） */
    source?: "library" | "extension";
}): string;
