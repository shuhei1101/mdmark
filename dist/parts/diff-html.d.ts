/** プレビューの片側（前か後）の説明と、スクリプトとイベントの属性を落とした範囲の HTML */
export type DiffHtmlSide = {
    label: string;
    html: string;
};
/** 部品設計『埋め込んだHTMLの差分』: 差分の中の `<!-- html -->` の範囲を、右端に「HTML」のラベルを持つ見出しで囲んだ HTML を返す。変えた範囲は「ソース」「プレビュー」で、行の色分けと前と後の描いた結果を切り替える */
export declare function renderDiffHtml(options: {
    /** 前か後で範囲を変えたか。false なら見方の切り替えを付けず、ラベルだけの見出しにする */
    changed: boolean;
    /** 今の見方（既定 `source`） */
    view?: "source" | "rendered";
    /** プレビューの前と後の並べ方（既定 `side`） */
    sides?: "side" | "stack";
    /** 範囲のソースの行の HTML */
    lines: string;
    /** 前のリビジョンの範囲。範囲が無ければ `null` */
    before?: DiffHtmlSide | null;
    /** 後のリビジョンの範囲。範囲が無ければ `null` */
    after?: DiffHtmlSide | null;
}): string;
