import { setFolderOpen } from "./interact/trees.ts";

/** 印刷の前に開いた折り畳み・節・行の詳細・ファイルツリーのフォルダ・タブの中身 */
type Expanded = {
  details: HTMLDetailsElement[];
  sections: HTMLElement[];
  rows: HTMLElement[];
  panels: HTMLElement[];
  tabs: HTMLElement[];
  folders: Element[];
};

/** 何も開いていない状態 */
function nothingExpanded(): Expanded {
  return {
    details: [],
    sections: [],
    rows: [],
    panels: [],
    tabs: [],
    folders: [],
  };
}

/** 印刷の前に、要素の中の閉じた折り畳み・閉じた節・行の詳細・ファイルツリーの閉じたフォルダを開き、タブの全ての中身を出し、印刷の後に開いたものだけを戻す受け取りを `window` に付け、外す関数を返す */
export function attachPrint(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 印刷の機能がオンか（印刷のたびに読む） */
  isEnabled: () => boolean;
}): () => void {
  const { root, isEnabled } = options;
  let expanded = nothingExpanded();
  /** 印刷の前: 閉じたものを全て開き、開いた分を控える */
  const onBeforePrint = (): void => {
    if (!isEnabled()) {
      return;
    }
    expanded = {
      details: [...root.querySelectorAll("details")].filter(
        (details) => !details.open,
      ),
      sections: [
        ...root.querySelectorAll<HTMLElement>(".mdmark-section-body[hidden]"),
      ],
      rows: [
        ...root.querySelectorAll<HTMLElement>(".mdmark-row-detail[hidden]"),
      ],
      panels: [
        ...root.querySelectorAll<HTMLElement>('[role="tabpanel"][hidden]'),
      ],
      tabs: [...root.querySelectorAll<HTMLElement>(".mdmark-tabs")],
      folders: [
        ...root.querySelectorAll('.mdmark-tree-toggle[aria-expanded="false"]'),
      ],
    };
    for (const folder of expanded.folders) {
      setFolderOpen(folder, true);
    }
    for (const details of expanded.details) {
      details.open = true;
    }
    for (const element of [
      ...expanded.sections,
      ...expanded.rows,
      ...expanded.panels,
    ]) {
      element.removeAttribute("hidden");
    }
    // 印刷の CSS がタブの並びを隠し、タブ名を題にして中身を縦に並べる
    for (const tabs of expanded.tabs) {
      tabs.setAttribute("data-printing", "");
    }
  };
  /** 印刷の後: 印刷の前に開いたものだけを戻す */
  const onAfterPrint = (): void => {
    for (const details of expanded.details) {
      details.open = false;
    }
    for (const section of expanded.sections) {
      section.setAttribute("hidden", "until-found");
    }
    for (const element of [...expanded.rows, ...expanded.panels]) {
      element.setAttribute("hidden", "");
    }
    for (const tabs of expanded.tabs) {
      tabs.removeAttribute("data-printing");
    }
    for (const folder of expanded.folders) {
      setFolderOpen(folder, false);
    }
    expanded = nothingExpanded();
  };
  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  return () => {
    window.removeEventListener("beforeprint", onBeforePrint);
    window.removeEventListener("afterprint", onAfterPrint);
  };
}
