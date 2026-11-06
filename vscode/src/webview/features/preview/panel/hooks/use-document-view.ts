import { type RefCallback, useState } from "react";
import { createDocumentView, type DocumentView } from "../document-view.ts";

/** `DocumentView` を 1 回だけ作り、描く先の要素の ref のコールバックで `attach`・後始末で `detach` を呼ぶ */
export const useDocumentView = (options: {
  /** 描く先を包む要素 */
  root: HTMLElement;
  /** 保存した行 */
  savedLine?: number;
}): { view: DocumentView; documentRef: RefCallback<HTMLDivElement> } => {
  const [view] = useState(() => createDocumentView(options));
  const documentRef: RefCallback<HTMLDivElement> = (element) => {
    if (element === null) {
      return;
    }
    view.attach(element);
    return () => view.detach();
  };
  return { view, documentRef };
};
