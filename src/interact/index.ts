import type { TablePinMode, TooltipPlacement } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkColumnsChange } from "../mount.ts";
import { attachCodeCopy } from "./code-blocks.ts";
import { attachCodeFolds } from "./code-folds.ts";
import { attachCsvRaw } from "./csv-raw.ts";
import { attachDiagramTips } from "./diagram-tips.ts";
import { attachDiagrams } from "./diagrams.ts";
import { attachEmbeddedHtml } from "./embedded-html.ts";
import { attachFootnotes } from "./footnotes.ts";
import { attachGifs } from "./gif.ts";
import { attachLightbox } from "./lightbox.ts";
import { attachParams } from "./params.ts";
import { attachDetailsStates, type PartStates } from "./part-states.ts";
import { attachSections, type SectionStates } from "./sections.ts";
import { attachStickyRows } from "./sticky.ts";
import { attachTables } from "./tables.ts";
import { attachTabs } from "./tabs.ts";
import { attachTermTips } from "./terms.ts";
import { attachFileTrees } from "./trees.ts";
import { attachWideToggles } from "./wide.ts";

/** 操作を付ける要素と機能のオン・オフ、既定を適用した設定 */
type InteractionContext = {
  root: HTMLElement;
  features: Record<string, boolean>;
  placement: TooltipPlacement;
  diagramPlacement: TooltipPlacement;
  paramDefinitions: MdmarkParamDefinition[];
  pinMode: TablePinMode;
  longColumnMin: number | undefined;
  onColumnsChange: ((event: MdmarkColumnsChange) => void) | undefined;
  sectionStates: SectionStates | undefined;
  partStates: PartStates | undefined;
  revealHash: boolean | undefined;
};

/** セクションと行の詳細・表・CSV・wide・タブの操作を付ける */
function attachLayouts(context: InteractionContext): Array<() => void> {
  const { root, features, partStates } = context;
  const detachers: Array<() => void> = [];
  // 閉じたセクションの中の行へは、`attachTables` が行へ送信する前に `attachSections` がセクションを開いておく
  const sections = features.sections === true;
  const rowDetails = features["row-details"] === true;
  if (sections || rowDetails) {
    detachers.push(
      attachSections({
        root,
        sections,
        rowDetails,
        states: context.sectionStates,
        partStates,
        revealHash: context.revealHash,
      }),
    );
  }
  if (features.table === true) {
    detachers.push(
      attachTables(root, {
        onColumnsChange: context.onColumnsChange,
        pinMode: context.pinMode,
        longColumnMin: context.longColumnMin,
        partStates,
      }),
    );
    detachers.push(attachStickyRows(root));
  }
  // RAW のボタンは、表の操作の帯ができてからその帯に追加する
  if (features.csv === true) {
    detachers.push(attachCsvRaw(root));
  }
  if (features.wide === true) {
    detachers.push(attachWideToggles(root));
  }
  if (features.tabs === true) {
    detachers.push(attachTabs(root));
  }
  return detachers;
}

/** コードブロック・ファイルツリー・図と操作できる部品・脚注と注記・用語の操作を付ける */
function attachBlocks(context: InteractionContext): Array<() => void> {
  const { root, features, placement, partStates } = context;
  const detachers: Array<() => void> = [];
  if (features.code === true) {
    detachers.push(attachCodeCopy(root));
    detachers.push(attachCodeFolds(root, partStates));
  }
  if (features.tree === true) {
    detachers.push(attachFileTrees(root, partStates));
  }
  if (features.diagrams === true) {
    detachers.push(
      attachDiagrams({
        root,
        placement: context.diagramPlacement,
        partStates,
      }),
    );
    detachers.push(attachParams(root, context.paramDefinitions));
  }
  if (features.footnotes === true || features.annotations === true) {
    detachers.push(attachFootnotes({ root, placement }));
  }
  if (features.glossary === true || features.backlinks === true) {
    detachers.push(attachTermTips({ root, placement }));
  }
  return detachers;
}

/** 埋め込んだ HTML の幅とヒント・画像の拡大・部品の開閉の記録・GIF の操作を付ける */
function attachMedia(context: InteractionContext): Array<() => void> {
  const { root, features, partStates } = context;
  const detachers: Array<() => void> = [];
  if (features.html === true) {
    detachers.push(attachEmbeddedHtml(root));
    // ヒントのマーカーと中身は、`hints` がオンのときだけ `render` が出す。操作もオンのときだけ付ける
    if (features.hints === true) {
      for (const embedded of root.querySelectorAll<HTMLElement>(
        "div.mdmark-html",
      )) {
        detachers.push(
          attachDiagramTips({
            figure: embedded,
            placement: context.diagramPlacement,
          }).detach,
        );
      }
    }
  }
  if (features.lightbox === true) {
    detachers.push(attachLightbox(root));
  }
  if (partStates !== undefined) {
    detachers.push(attachDetailsStates({ root, states: partStates }));
  }
  // GIF の包みは拡大のボタンごと包むため、拡大の後に付ける
  if (features.gif === true) {
    detachers.push(attachGifs(root));
  }
  return detachers;
}

/** 機能がオンの記法だけ（セクションと行の詳細・表・タブの順に）操作を付け、`table` がオンなら表の見出し行と集計の行を留める処理を、`code` がオンならコードブロックのコピーを付け、`tree` がオンならファイルツリーの開閉とコピーを付け、`footnotes` がオンなら脚注のツールチップと一覧への移動を付け、`diagrams` がオンなら図と操作できる部品の操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、`html` がオンなら埋め込んだ HTML の幅の操作を（`hints` もオンならヒントの操作も）付け、`lightbox` がオンなら画像の拡大を、`gif` がオンならその後に GIF の止める・再生するボタンを付け、`csv` がオンなら CSV の表と元の CSV の切り替えを、`wide` がオンなら wide の範囲の幅の切り替えを付け、まとめて削除する関数を返却する */
export function attachInteractions(options: {
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
}): () => void {
  const context: InteractionContext = {
    root: options.root,
    features: options.features,
    placement: options.placement,
    diagramPlacement: options.diagramPlacement ?? "bottom",
    paramDefinitions: options.paramDefinitions ?? [],
    pinMode: options.pinMode ?? "each",
    longColumnMin: options.longColumnMin,
    onColumnsChange: options.onColumnsChange,
    sectionStates: options.sectionStates,
    partStates: options.partStates,
    revealHash: options.revealHash,
  };
  const detachers = [
    ...attachLayouts(context),
    ...attachBlocks(context),
    ...attachMedia(context),
  ];
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
