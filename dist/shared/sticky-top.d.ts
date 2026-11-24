/** 要素に効いている `--mdmark-sticky-top` を px に換算して返却する（指定が無いときは 0）。`@property` で登録していない変数は指定した文字列のまま返るため、測るための要素の高さで `calc()`・`rem`・`em`・`vh` を換算する */
export declare function readStickyTop(el: HTMLElement): number;
