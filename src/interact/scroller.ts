/** 要素をスクロールする場所 */
export type ScrollContainer = {
  /** スクロールする要素 */
  target: HTMLElement;
  /** スクロールする要素が画面全体か */
  page: boolean;
};

/** 要素の祖先をたどり、縦にスクロールして中身がはみ出す一番近い要素を返却する。無ければ画面をスクロールする要素 */
export function findScrollContainer(from: HTMLElement): ScrollContainer {
  for (
    let element = from.parentElement;
    element !== null && element !== document.body;
    element = element.parentElement
  ) {
    const { overflowY } = getComputedStyle(element);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight
    ) {
      return { target: element, page: false };
    }
  }
  return {
    target: (document.scrollingElement ??
      document.documentElement) as HTMLElement,
    page: true,
  };
}
