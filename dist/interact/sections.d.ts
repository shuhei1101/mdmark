import { type PartStates } from "./part-states.ts";
/** 読者が開閉したセクションの開閉を、セクションの中身の `id` から引く記録。`marker` は記録したときの中身の `data-section` の値 */
export type SectionStates = Map<string, {
    open: boolean;
    marker: string;
}>;
/** 要素を囲む閉じたセクションを外側から開き、要素がセクションの見出しなら見出し自身のセクションも開き、選ばれていないタブの中ならそのタブも選び、表の行（`tr`）でなければ `scrollIntoView` する。URL の `#ID` で移るときと右側の目次の項目で移るときに使用する */
export declare function revealTarget(target: HTMLElement): void;
/** 要素を囲む閉じたセクションとタブを開き、閉じた行の詳細の中なら、その行の開閉のボタンを押した状態にして詳細の行を出す。スクロールしない。コメントのマーカーへ移るときに使用する */
export declare function openEnclosing(target: HTMLElement): void;
/** `root` の中の、操作を付けた全てのセクションを、`open` が `true` なら開く。`false` なら、見出しが h1 のセクションを開き、h2〜h4 のセクションを閉じる */
export declare function foldAllSections(options: {
    /** 描いた本文 */
    root: HTMLElement;
    /** 開くか */
    open: boolean;
}): void;
/** `sections` がオンならセクションの見出しを開閉のボタンにして閉じたセクションの中身を隠し、`row-details` がオンなら詳細を持つ行に開閉のボタンを配置して詳細の行を閉じる。URL の `#ID` が閉じたセクションの中を指すとき（`revealHash` が `true` のときの付けたときと、`hashchange`）にそのセクションを開く */
export declare function attachSections(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** セクションの開閉の機能 */
    sections: boolean;
    /** 行の詳細の機能 */
    rowDetails: boolean;
    /** セクションの開閉の記録（省くと記録しない） */
    states?: SectionStates;
    /** 部品の開閉の記録（省くと記録しない） */
    partStates?: PartStates;
    /** 付けたときに URL の `#ID` で開くか（既定 `true`） */
    revealHash?: boolean;
}): () => void;
