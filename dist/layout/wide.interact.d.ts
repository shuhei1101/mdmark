/** `div.mdmark-wide-range` の直前に切り替えのボタンの帯を配置し、押すたびに `data-state` と `aria-pressed` を入れ替える。描く先の要素の幅が本文の幅以下なら帯を隠す */
export declare const attachWideToggles: (root: HTMLElement) => (() => void);
