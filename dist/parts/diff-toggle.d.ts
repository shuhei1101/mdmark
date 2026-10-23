/** 部品設計『差分を開くボタン』: 題の後ろに置く「変更を見る」のボタンを、右に寄せる帯で包んだ HTML を返す */
export declare function renderDiffToggle(options: {
    /** 開閉する差分の場所の要素の `id` */
    controls: string;
    /** 差分を開いているか（既定 `false`） */
    expanded?: boolean;
}): string;
