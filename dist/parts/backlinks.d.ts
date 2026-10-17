/** 描いた文書の末尾に置く、その文書を参照している文書の一覧の HTML を返す。文書が無ければ空文字 */
export declare function renderBacklinks(props: {
    /** 題の要素の `id`。一覧の `aria-labelledby` が指す */
    id: string;
    /** 並べる文書（並びの順に出す） */
    docs: Array<{
        title: string;
        href: string;
    }>;
}): string;
