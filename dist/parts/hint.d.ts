/** 印の付け方: ブロックの要素は右上の印、行内の要素は要素そのもの */
export type HintPlacement = "block" | "inline";
/** 要素に足す属性と、閉じタグの前と要素の後ろに置く HTML */
export type HintMarkup = {
    /** 印の付け方 */
    placement: HintPlacement;
    /** 要素の開きタグに足す属性 */
    attributes: Record<string, string>;
    /** 閉じタグの前（要素の最後の子）に置く HTML。ブロックの要素の印のボタン */
    inside: string;
    /** 要素の後ろに置く HTML。ツールチップの中身 */
    after: string;
};
/** `data-hint` を持つ要素の種類から印の付け方を決める */
export declare function placementOf(tag: string): HintPlacement;
/** ヒントの印と中身を作る。ブロックの要素には右上の印のボタンを、行内の要素には `tabindex` を付け、ツールチップの中身を要素の後ろに置く */
export declare function renderHintMarkup(hint: {
    /** 要素のタグ名 */
    tag: string;
    /** `data-hint` の値（文字として出す） */
    text: string;
    /** ツールチップの `id`（`mdmark-hint-{n}`） */
    id: string;
}): HintMarkup;
/** 部品設計『ヒント』: `data-hint` を持つ要素に印か下線とツールチップを付けた HTML（Storybook のストーリーが開く）。`open` のときはツールチップを開いて見せる */
export declare function renderHint(props: {
    /** `data-hint` の文 */
    text: string;
    /** 印の付け方 */
    placement: HintPlacement;
    /** ツールチップを開いているか（既定 `false`） */
    open?: boolean;
    /** 要素の中身（既定は見本の文字） */
    body?: string;
    /** 要素に足す `style`（書いた人が地の色を付けたブロックの要素を見せるときに使う） */
    style?: string;
}): string;
