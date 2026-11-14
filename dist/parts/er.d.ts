import type { MdmarkErCardinality, MdmarkErTable } from "../diagram/definition.ts";
/** テーブルの色（`color`、無ければ種類の既定の色。どちらも無ければ `undefined`） */
export declare function erTableColor(table: MdmarkErTable): string | undefined;
/** 列の開閉のボタンのアイコン（畳んでいるときは開く、開いているときは畳む） */
export declare function erFoldIcon(folded: boolean): string;
/** 畳んだときの `非表示 {数} 列` の行の文字 */
export declare function erRestText(hidden: number): string;
/** 定義の文字から `{{`・`}}` を除く（スクリーンリーダー向けの名前とツールチップのタイトルに使用する） */
export declare function plainDefinitionText(value: string): string;
/** ER 図のテーブル（見出しと列の行）の HTML。全ての列の行を出し、畳んだテーブルは主キーでも外部キーでもない列の行を隠す。`text` は定義の文字を HTML にする関数 */
export declare function renderErTable(options: {
    table: MdmarkErTable;
    tipId: string | undefined;
    text: (value: string) => string;
}): string;
/** 関係の線の端の多重度の記号（`1` は縦線 2 本、`0..1` は縦線と丸、`1..n` は鳥の足と縦線、`0..n` は鳥の足と丸）。`dir` は線がテーブルから出る向き */
export declare function erEndSvg(options: {
    x: number;
    y: number;
    dir: 1 | -1;
    card: MdmarkErCardinality;
}): string;
