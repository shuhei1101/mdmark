/** 印刷の前に要素の中の閉じた折り畳みを開き、印刷の後に開いたものだけを閉じ直す受け取りを `window` に付け、外す関数を返す */
export function attachPrint(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 印刷の機能がオンか（印刷のたびに読む） */
  isEnabled: () => boolean;
}): () => void {
  const { root, isEnabled } = options;
  // 印刷の前に開いた折り畳み
  let opened: HTMLDetailsElement[] = [];
  /** 印刷の前: 閉じた折り畳みを全て開く */
  const onBeforePrint = (): void => {
    if (!isEnabled()) {
      return;
    }
    opened = [...root.querySelectorAll("details")].filter(
      (details) => !details.open,
    );
    for (const details of opened) {
      details.open = true;
    }
  };
  /** 印刷の後: 印刷の前に開いたものだけを閉じ直す */
  const onAfterPrint = (): void => {
    for (const details of opened) {
      details.open = false;
    }
    opened = [];
  };
  window.addEventListener("beforeprint", onBeforePrint);
  window.addEventListener("afterprint", onAfterPrint);
  return () => {
    window.removeEventListener("beforeprint", onBeforePrint);
    window.removeEventListener("afterprint", onAfterPrint);
  };
}
