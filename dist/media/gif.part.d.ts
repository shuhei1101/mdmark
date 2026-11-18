/** GIF の止める・再生するボタンの HTML を返却する。アイコンは両方置き、出す側は CSS が `aria-pressed` で決める */
export declare function renderGifToggle(options: {
    /** 止めているか */
    paused: boolean;
}): string;
/** GIF の HTML を返却する（Storybook の外観。`mount` は描いた `img` を包んで同じ構造にする） */
export declare function renderGif(options: {
    /** 画像の URL */
    src: string;
    /** 画像の代わりの文字 */
    alt: string;
    /** 止めているか（既定 `false`） */
    paused?: boolean;
    /** 押すと拡大するか（既定 `true`） */
    lightbox?: boolean;
}): string;
