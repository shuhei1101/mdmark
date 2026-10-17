import { attachSections } from "./sections.ts";
import { attachTables } from "./tables.ts";
import { attachTabs } from "./tabs.ts";
import { attachTermTips } from "./terms.ts";

/** 機能がオンの記法だけ操作を付け、`glossary` か `backlinks` がオンなら用語のツールチップの操作を付け、まとめて外す関数を返す */
export function attachInteractions(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 文書で決まった機能のオン・オフ */
  features: Record<string, boolean>;
}): () => void {
  const { root, features } = options;
  const detachers: Array<() => void> = [];
  if (features.table === true) {
    detachers.push(attachTables(root));
  }
  if (features.tabs === true) {
    detachers.push(attachTabs(root));
  }
  const sections = features.sections === true;
  const rowDetails = features["row-details"] === true;
  if (sections || rowDetails) {
    detachers.push(attachSections({ root, sections, rowDetails }));
  }
  if (features.glossary === true || features.backlinks === true) {
    detachers.push(attachTermTips(root));
  }
  return () => {
    for (const detach of detachers.reverse()) {
      detach();
    }
  };
}
