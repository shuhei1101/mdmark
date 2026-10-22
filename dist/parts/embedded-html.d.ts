/** 部品設計『埋め込んだHTML』: 描いた HTML を包む枠。列より広いときだけ `is-wide` と `tabindex="0"` を付けて中で横にスクロールさせる。`html` は許可の検査を通した後の HTML */
export declare function renderEmbeddedHtml(props: {
    /** 許可の検査を通した後の HTML */
    html: string;
    /** 列より広いか（既定 `false`） */
    wide?: boolean;
}): string;
