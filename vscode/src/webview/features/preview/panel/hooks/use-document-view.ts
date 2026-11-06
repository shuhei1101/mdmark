import { type RefCallback, useState } from "react";
import { createDocumentView, type DocumentView } from "../document-view.ts";

/** `DocumentView` と、描く先の要素の ref のコールバック（`attach`・後始末で `detach`）を 1 回だけ作る。ref が描画ごとに変わると React が後始末を呼び、描いた文書を消すため */
export const useDocumentView = (options: {
  /** 描く先を包む要素 */
  root: HTMLElement;
  /** 保存した行 */
  savedLine?: number;
}): { view: DocumentView; documentRef: RefCallback<HTMLDivElement> } => {
  const [handles] = useState(() => {
    const view = createDocumentView(options);
    const documentRef: RefCallback<HTMLDivElement> = (element) => {
      if (element === null) {
        return;
      }
      view.attach(element);
      return () => view.detach();
    };
    return { view, documentRef };
  });
  return handles;
};
