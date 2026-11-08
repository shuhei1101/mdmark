import type { TooltipPlacement } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
/** 機能がオンの記法だけ（節と行の詳細・表・タブの順に）操作を付け、`table` がオンなら表の見出し行と集計の行を留める処理を、`code` がオンならコードブロックのコピーを付け、`tree` がオンならファイルツリーの開閉とコピーを付け、`footnotes` がオンなら脚注のツールチップと一覧への移動を付け、`diagrams` がオンなら図と操作できる部品の操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、`html` がオンなら埋め込んだ HTML の幅の操作を（`hints` もオンならヒントの操作も）付け、`lightbox` がオンなら画像の拡大を、`gif` がオンならその後に GIF の止める・再生するボタンを付け、`csv` がオンなら CSV の表と元の CSV の切り替えを、`wide` がオンなら wide の範囲の幅の切り替えを付け、まとめて外す関数を返す */
export declare function attachInteractions(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** 既定を当てた設定の、本文の用語・脚注のツールチップを出す場所 */
    placement: TooltipPlacement;
    /** 既定を当てた設定の、図・ヒント・グラフの項目のツールチップを出す場所（既定 `bottom`） */
    diagramPlacement?: TooltipPlacement;
    /** 描いた操作できる部品の定義。`div.mdmark-param` の並びと同じ順（既定 `[]`） */
    paramDefinitions?: MdmarkParamDefinition[];
    /** 列の表示を切り替えたときに知らせる */
    onColumnsChange?: (event: MdmarkColumnsChange) => void;
}): () => void;
