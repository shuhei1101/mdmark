import type { TablePinMode, TooltipPlacement } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
import { type PartStates } from "./part-states.ts";
import { type SectionStates } from "./sections.ts";
/** 機能がオンの記法だけ（セクションと行の詳細・表・タブの順に）操作を付け、`table` がオンなら表の見出し行と集計の行を留める処理を、`code` がオンならコードブロックのコピーを付け、`tree` がオンならファイルツリーの開閉とコピーを付け、`footnotes` がオンなら脚注のツールチップと一覧への移動を付け、`diagrams` がオンなら図と操作できる部品の操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、`html` がオンなら埋め込んだ HTML の幅の操作を（`hints` もオンならヒントの操作も）付け、`lightbox` がオンなら画像の拡大を、`gif` がオンならその後に GIF の止める・再生するボタンを付け、`csv` がオンなら CSV の表と元の CSV の切り替えを、`wide` がオンなら wide の範囲の幅の切り替えを付け、まとめて削除する関数を返却する */
export declare function attachInteractions(options: {
    /** 描いた要素 */
    root: HTMLElement;
    /** 文書で決まった機能のオン・オフ */
    features: Record<string, boolean>;
    /** 既定を適用した設定の、本文の用語・脚注のツールチップを出す場所 */
    placement: TooltipPlacement;
    /** 既定を適用した設定の、図・ヒント・グラフの項目のツールチップを出す場所（既定 `bottom`） */
    diagramPlacement?: TooltipPlacement;
    /** 描いた操作できる部品の定義。`div.mdmark-param` の並びと同じ順（既定 `[]`） */
    paramDefinitions?: MdmarkParamDefinition[];
    /** 既定を適用した設定の、表のピン止めの動き（既定 `each`） */
    pinMode?: TablePinMode;
    /** 既定を適用した設定の、長文の列の最小の幅（em） */
    longColumnMin?: number;
    /** 列の表示を切り替えたときに通知する */
    onColumnsChange?: (event: MdmarkColumnsChange) => void;
    /** セクションの開閉の記録（省くと記録しない） */
    sectionStates?: SectionStates;
    /** 部品の開閉の記録（省くと記録しない） */
    partStates?: PartStates;
    /** 付けたときに URL の `#ID` で開くか（既定 `true`） */
    revealHash?: boolean;
}): () => void;
