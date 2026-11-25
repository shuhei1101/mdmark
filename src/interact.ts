import { attachCodeCopy } from "./code-block/code-block.interact.ts";
import { attachCodeFolds } from "./code-block/code-fold.interact.ts";
import type { TablePinMode, TooltipPlacement } from "./config.ts";
import type { MdmarkParamDefinition } from "./diagram/definition.ts";
import { attachDiagrams } from "./diagram/diagram.interact.ts";
import { attachDiagramTips } from "./diagram/diagram-tips.interact.ts";
import { attachParams } from "./diagram/param.interact.ts";
import { attachEmbeddedHtml } from "./embedded-html/embedded-html.interact.ts";
import { attachFootnotes } from "./footnote/footnote.interact.ts";
import { attachTermTips } from "./knowledge/term.interact.ts";
import { attachWideToggles } from "./layout/wide.interact.ts";
import { attachGifs } from "./media/gif.interact.ts";
import { attachLightbox } from "./media/lightbox.interact.ts";
import { attachMediaModal } from "./media/media-modal.interact.ts";
import { attachMediaResizes } from "./media/media-resize.interact.ts";
import type { MdmarkColumnsChange } from "./mount.ts";
import {
  attachSections,
  type SectionStates,
} from "./section/section.interact.ts";
import {
  attachDetailsStates,
  type PartStates,
} from "./shared/part-states.interact.ts";
import { attachCsvRaw } from "./table/csv.interact.ts";
import { attachTables } from "./table/table.interact.ts";
import { attachStickyRows } from "./table/table-sticky.interact.ts";
import { attachTabs } from "./tabs/tabs.interact.ts";
import { attachFileTrees } from "./tree/tree.interact.ts";

/** 操作を付ける要素と機能のオン・オフ、既定を適用した設定 */
type InteractionContext = {
  root: HTMLElement;
  features: Record<string, boolean>;
  placement: TooltipPlacement;
  diagramPlacement: TooltipPlacement;
  paramDefinitions: MdmarkParamDefinition[];
  pinMode: TablePinMode;
  pinDefault: boolean;
  longColumnMin: number | undefined;
  onColumnsChange: ((event: MdmarkColumnsChange) => void) | undefined;
  sectionStates: SectionStates | undefined;
  partStates: PartStates | undefined;
  revealHash: boolean | undefined;
  followHash: boolean;
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
        followHash: context.followHash,
      }),
    );
  }
  if (features.table === true) {
    detachers.push(
      attachTables(root, {
        onColumnsChange: context.onColumnsChange,
        pinMode: context.pinMode,
        pinDefault: context.pinDefault,
        longColumnMin: context.longColumnMin,
        partStates,
        followHash: context.followHash,
      }),
    );
  }
  // 見出し行は表の機能のオン・オフによらず、全ての表で留める
  detachers.push(attachStickyRows(root));
  // RAW のボタンは、表の操作の帯ができてからその帯に追加する
  if (features.csv === true) {
    detachers.push(attachCsvRaw(root));
  }
  if (features.wide === true) {
    detachers.push(attachWideToggles(root));
  }
  if (features.tabs === true) {
    detachers.push(attachTabs(root, { followHash: context.followHash }));
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

/** 動画の幅を保つ先（sessionStorage）。参照で例外になる環境では `null` */
const sessionStorageOrNull = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

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
  if (features.media === true) {
    detachers.push(attachMediaModal(root));
    if (features["media-resize"] === true) {
      detachers.push(
        attachMediaResizes({ root, storage: sessionStorageOrNull() }),
      );
    }
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

/** 機能がオンの記法だけ（セクションと行の詳細・表・タブの順に）操作を付け、`table` がオンなら表の見出し行と集計の行を留める処理を、`code` がオンならコードブロックのコピーを付け、`tree` がオンならファイルツリーの開閉とコピーを付け、`footnotes` がオンなら脚注のツールチップと一覧への移動を付け、`diagrams` がオンなら図と操作できる部品の操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、`html` がオンなら埋め込んだ HTML の幅の操作を（`hints` もオンならヒントの操作も）付け、`lightbox` がオンなら画像の拡大を、`gif` がオンならその後に GIF の止める・再生するボタンを付け、`media` がオンなら再生のボタンで開く再生のダイアログを付け、`csv` がオンなら CSV の表と元の CSV の切り替えを、`wide` がオンなら wide の範囲の幅の切り替えを付け、まとめて削除する関数を返却する */
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
  /** 既定を適用した設定の、描いた直後に既定の列を留めるか（既定 `false`） */
  pinDefault?: boolean;
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
  /** URL の `#ID` を追うか。`false` ならセクション・タブ・表の行を `#ID` で開かない（既定 `true`） */
  followHash?: boolean;
}): () => void {
  const context: InteractionContext = {
    root: options.root,
    features: options.features,
    placement: options.placement,
    diagramPlacement: options.diagramPlacement ?? "bottom",
    paramDefinitions: options.paramDefinitions ?? [],
    pinMode: options.pinMode ?? "each",
    pinDefault: options.pinDefault ?? false,
    longColumnMin: options.longColumnMin,
    onColumnsChange: options.onColumnsChange,
    sectionStates: options.sectionStates,
    partStates: options.partStates,
    revealHash: options.revealHash,
    followHash: options.followHash !== false,
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
