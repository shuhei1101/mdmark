/** ツールチップの「関連文書」に並べる文書 1 つ */
export type TermTipDoc = {
    /** 文書の題 */
    title: string;
    /** 描く文書から見た相対パス */
    href: string;
    /** 索引の `description` */
    description?: string;
};
/** 本文の語に破線の下線を引き、直後に「用語」の意味と「関連文書」のツールチップを置く HTML を返す。意味も関連文書も無ければ語をそのまま返す。`replacement` を渡すと、語に波線のマーカーを引き、「代わりの用語」だけのツールチップを置く（`meaning`・`docs` は使わない） */
export declare function renderTermTip(props: {
    /** 下線を引く本文の語 */
    text: string;
    /** ツールチップの要素の `id` */
    id: string;
    /** 「用語」に出す意味。空なら「用語」の区分を出さない */
    meaning?: string;
    /** 「関連文書」に並べる文書。空なら「関連文書」の区分を出さない */
    docs?: TermTipDoc[];
    /** `text` がやめた言い方のときの代わりの用語 */
    replacement?: {
        term: string;
        meaning: string;
    };
    /** 語の下に開いた見た目にするか。ストーリーが下に開いた状態を出すために使い、`render` は渡さない */
    below?: boolean;
}): string;
