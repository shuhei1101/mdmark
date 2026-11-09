/** sessionStorage のキーの頭。キーは `{頭}{履歴の項目の ID}` */
export const VIEW_STATE_KEY_PREFIX = "mdmark-bundle-view:";

/** `history.state` の中で、履歴の項目の ID を持つフィールドの名前 */
export const HISTORY_ENTRY_FIELD = "mdmarkEntry";

/** 戻す本文の開閉の要素のセレクタ。表のメニュー・ドロワー・絞り込み、右側の目次、差分のパネル、コメントの吹き出しの開閉は含めない */
export const RESTORABLE_FOLDS =
  "details, .mdmark-section-toggle, .mdmark-row-toggle, .mdmark-code-fold, .mdmark-diagram-er-fold, .mdmark-tree-toggle, .mdmark-tree-example-toggle";

/** スクロールしている間、表示の状態を保存する最短の間隔（ミリ秒） */
export const SCROLL_SAVE_INTERVAL_MS = 100;

/** 履歴の項目を離れたときの表示の状態。sessionStorage に JSON で保存する */
export type ViewState = {
  /** 状態を取り出した文書のパス */
  path: string;
  /** `scrollX` */
  x: number;
  /** `scrollY` */
  y: number;
  /** `RESTORABLE_FOLDS` に当たる要素の、文書の中の出現順の開閉 */
  folds: boolean[];
  /** `data-group` を持たない `.mdmark-tabs` の、文書の中の出現順の選んだタブの番号 */
  tabs: number[];
};

/** `data-group` を持たないタブ群 */
const PLAIN_TABS = ".mdmark-tabs:not([data-group])";

/** タブ群の直下のタブのボタン */
const TAB_BUTTONS = ":scope > .mdmark-tablist > .mdmark-tab";

/** 合わせ直しを止める、読む人のスクロールの操作 */
const USER_SCROLL_EVENTS = [
  "wheel",
  "touchstart",
  "keydown",
  "pointerdown",
] as const;

/** 新しい履歴の項目の ID を作る（時刻と乱数の 36 進の文字） */
const createEntryId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** 今の履歴の項目の ID を返却する。無ければ新しい ID を振って今の `history.state` に加え、URL を変えずに `replaceState` する */
export const ensureEntryId = (win: Window): string => {
  const state: unknown = win.history.state;
  const current =
    typeof state === "object" && state !== null
      ? (state as Record<string, unknown>)[HISTORY_ENTRY_FIELD]
      : undefined;
  if (typeof current === "string" && current !== "") {
    return current;
  }
  const id = createEntryId();
  const base =
    typeof state === "object" && state !== null
      ? (state as Record<string, unknown>)
      : {};
  win.history.replaceState({ ...base, [HISTORY_ENTRY_FIELD]: id }, "");
  return id;
};

/** 要素が開いているか（`details` は `open`、ボタンは `aria-expanded`） */
const isOpen = (element: Element): boolean =>
  element instanceof HTMLDetailsElement
    ? element.open
    : element.getAttribute("aria-expanded") === "true";

/** 描いた文書の要素から、位置・開閉・`group=` の無いタブの選択を取り出す */
export const captureViewState = (target: {
  view: HTMLElement;
  path: string;
}): ViewState => {
  const { view, path } = target;
  const win = view.ownerDocument.defaultView ?? window;
  const folds = [...view.querySelectorAll(RESTORABLE_FOLDS)].map(isOpen);
  const tabs = [...view.querySelectorAll<HTMLElement>(PLAIN_TABS)].map(
    (group) =>
      [...group.querySelectorAll(TAB_BUTTONS)].findIndex(
        (button) => button.getAttribute("aria-selected") === "true",
      ),
  );
  return { path, x: win.scrollX, y: win.scrollY, folds, tabs };
};

/** 開閉を、今の状態と違う要素だけ戻す（`details` は `open`、ボタンは `click()`） */
const applyFolds = (view: HTMLElement, folds: boolean[]): void => {
  const elements = [...view.querySelectorAll(RESTORABLE_FOLDS)];
  elements.forEach((element, index) => {
    const open = folds[index];
    if (open === undefined || isOpen(element) === open) {
      return;
    }
    if (element instanceof HTMLDetailsElement) {
      element.open = open;
    } else if (element instanceof HTMLElement) {
      element.click();
    }
  });
};

/** `group=` の無いタブ群の選んだタブを、番号のタブのボタンの `click()` で選び直す */
const applyTabs = (view: HTMLElement, tabs: number[]): void => {
  const groups = [...view.querySelectorAll<HTMLElement>(PLAIN_TABS)];
  groups.forEach((group, index) => {
    const selected = tabs[index];
    if (selected === undefined || selected < 0) {
      return;
    }
    const button = group.querySelectorAll<HTMLElement>(TAB_BUTTONS)[selected];
    if (button && button.getAttribute("aria-selected") !== "true") {
      button.click();
    }
  });
};

/** 開閉を戻し、タブを選び直してから位置へスクロールする。描いた後に高さが変わったら、読む人がスクロールの操作をするまで位置へ合わせ直す。合わせ直しを止める関数を返却する */
export const applyViewState = (target: {
  view: HTMLElement;
  state: ViewState;
  keepFocus: boolean;
}): (() => void) => {
  const { view, state, keepFocus } = target;
  const doc = view.ownerDocument;
  const win = doc.defaultView ?? window;
  const focused = doc.activeElement;
  applyFolds(view, state.folds);
  applyTabs(view, state.tabs);
  if (
    keepFocus &&
    focused instanceof HTMLElement &&
    focused !== doc.activeElement
  ) {
    focused.focus({ preventScroll: true });
  }
  const scroll = (): void => win.scrollTo(state.x, state.y);
  scroll();
  const observer = new ResizeObserver(scroll);
  observer.observe(view);
  const stop = (): void => {
    observer.disconnect();
    for (const type of USER_SCROLL_EVENTS) {
      win.removeEventListener(type, stop, true);
    }
  };
  for (const type of USER_SCROLL_EVENTS) {
    win.addEventListener(type, stop, { capture: true, passive: true });
  }
  return stop;
};

/** ページの sessionStorage を返却する。取り出せないときは `console.warn` に出して `null` を返却する */
const sessionStorageOf = (win: Window): Storage | null => {
  try {
    return win.sessionStorage;
  } catch (error) {
    console.warn("表示の状態を保存する sessionStorage を使用できません", error);
    return null;
  }
};

/** 値が `ViewState` の構造か */
const isViewState = (value: unknown): value is ViewState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.path === "string" &&
    typeof record.x === "number" &&
    typeof record.y === "number" &&
    Array.isArray(record.folds) &&
    record.folds.every((open) => typeof open === "boolean") &&
    Array.isArray(record.tabs) &&
    record.tabs.every((index) => Number.isInteger(index))
  );
};

/** sessionStorage の `{VIEW_STATE_KEY_PREFIX}{ID}` を読み込み、`ViewState` の構造なら返却する。無い・壊れている・読み込めないときは `undefined` */
export const readViewState = (entry: {
  win: Window;
  id: string;
}): ViewState | undefined => {
  const storage = sessionStorageOf(entry.win);
  if (storage === null) {
    return undefined;
  }
  let text: string | null;
  try {
    text = storage.getItem(`${VIEW_STATE_KEY_PREFIX}${entry.id}`);
  } catch (error) {
    console.warn("保存した表示の状態を読み込めません", error);
    return undefined;
  }
  if (text === null) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    return isViewState(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/** sessionStorage の `{VIEW_STATE_KEY_PREFIX}{ID}` へ JSON で保存する。取り出せない・書き込めないときは `console.warn` に出して続ける */
export const writeViewState = (entry: {
  win: Window;
  id: string;
  state: ViewState;
}): void => {
  const storage = sessionStorageOf(entry.win);
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(
      `${VIEW_STATE_KEY_PREFIX}${entry.id}`,
      JSON.stringify(entry.state),
    );
  } catch (error) {
    console.warn("表示の状態を保存できません", error);
  }
};
