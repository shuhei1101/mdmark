import type { TooltipPlacement } from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import { attachDiagramTips } from "./diagram-tips.ts";
import { attachDiagrams } from "./diagrams.ts";
import { attachEmbeddedHtml } from "./embedded-html.ts";
import { attachParams } from "./params.ts";
import { attachSections } from "./sections.ts";
import { attachTables } from "./tables.ts";
import { attachTabs } from "./tabs.ts";
import { attachTermTips } from "./terms.ts";

/** 機能がオンの記法だけ（節と行の詳細・表・タブの順に）操作を付け、`diagrams` がオンなら図と操作できる部品の操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、`html` がオンなら埋め込んだ HTML の幅の操作を（`hints` もオンならヒントの操作も）付け、まとめて外す関数を返す */
export function attachInteractions(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 文書で決まった機能のオン・オフ */
  features: Record<string, boolean>;
  /** 既定を当てた設定のツールチップを出す場所 */
  placement: TooltipPlacement;
  /** 描いた操作できる部品の定義。`div.mdmark-param` の並びと同じ順（既定 `[]`） */
  paramDefinitions?: MdmarkParamDefinition[];
}): () => void {
  const { root, features, placement, paramDefinitions = [] } = options;
  const detachers: Array<() => void> = [];
  // 閉じた節の中の行へは、`attachTables` が行へ送る前に `attachSections` が節を開いておく
  const sections = features.sections === true;
  const rowDetails = features["row-details"] === true;
  if (sections || rowDetails) {
    detachers.push(attachSections({ root, sections, rowDetails }));
  }
  if (features.table === true) {
    detachers.push(attachTables(root));
  }
  if (features.tabs === true) {
    detachers.push(attachTabs(root));
  }
  if (features.diagrams === true) {
    detachers.push(attachDiagrams({ root, placement }));
    detachers.push(attachParams(root, paramDefinitions));
  }
  if (features.glossary === true || features.backlinks === true) {
    detachers.push(attachTermTips({ root, placement }));
  }
  if (features.html === true) {
    detachers.push(attachEmbeddedHtml(root));
    // ヒントの印と中身は、`hints` がオンのときだけ `render` が出す。操作もオンのときだけ付ける
    if (features.hints === true) {
      for (const embedded of root.querySelectorAll<HTMLElement>(
        "div.mdmark-html",
      )) {
        detachers.push(
          attachDiagramTips({ figure: embedded, placement }).detach,
        );
      }
    }
  }
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
