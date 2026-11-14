/** マーカーの付け方: ブロックの要素は右上のマーカー、行内の要素は要素そのもの */
export type HintPlacement = "block" | "inline";
/** 要素に追加する属性と、閉じタグの前と要素の後ろに配置する HTML */
export type HintMarkup = {
    /** マーカーの付け方 */
    placement: HintPlacement;
    /** 要素の開きタグに追加する属性 */
    attributes: Record<string, string>;
    /** 閉じタグの前（要素の最後の子）に配置する HTML。ブロックの要素のマーカーのボタン */
    inside: string;
    /** 要素の後ろに配置する HTML。ツールチップの中身 */
    after: string;
};
/** `data-hint` を持つ要素の種類からマーカーの付け方を決める */
export declare function placementOf(tag: string): HintPlacement;
/** ヒントのマーカーと中身を作る。ブロックの要素には右上のマーカーのボタンを、行内の要素には `tabindex` を付け、ツールチップの中身を要素の後ろに配置する */
export declare function renderHintMarkup(hint: {
    /** 要素のタグ名 */
    tag: string;
    /** `data-hint` の値（文字として出す） */
    text: string;
    /** ツールチップの `id`（`mdmark-hint-{n}`） */
    id: string;
}): HintMarkup;
/** 部品設計『ヒント』: `data-hint` を持つ要素にマーカーか下線とツールチップを付けた HTML（Storybook のストーリーが開く）。`open` のときはツールチップを開いて見せる */
export declare function renderHint(props: {
    /** `data-hint` の文 */
    text: string;
    /** マーカーの付け方 */
    placement: HintPlacement;
    /** ツールチップを開いているか（既定 `false`） */
    open?: boolean;
    /** 要素の中身（既定は見本の文字） */
    body?: string;
    /** 要素に追加する `style`（記載した人が地の色を付けたブロックの要素を見せるときに使用する） */
    style?: string;
}): string;
