/** 描く先を包む要素の `data-*` に置かれた、パネルの始め方 */
export type PreviewBoot = {
  /** 描く先を包む要素。React の木を描く場所で、配色の class を付ける */
  root: HTMLElement;
  /** 読む配布物の `index.js` の URL。バージョンを決められないときは持たない */
  distJs: string | undefined;
  /** 読むバージョン（描けない理由に出す） */
  version: string | undefined;
  /** 配布物を読まずに出す状態 */
  status: "versionUndecidable" | undefined;
  /** `mdmark.configPath` の書いたままの値（帯に出す） */
  configPath: string;
  /** `inspect`・`axe` を受けるか */
  test: boolean;
};

/** 描く先を包む要素の `data-*` からパネルの始め方を読む */
export const readBoot = (root: HTMLElement): PreviewBoot => ({
  root,
  distJs: root.dataset.distJs,
  version: root.dataset.version,
  status:
    root.dataset.status === "versionUndecidable"
      ? "versionUndecidable"
      : undefined,
  configPath: root.dataset.configPath ?? "",
  test: root.dataset.test !== undefined,
});

/** `getState` で読んだ値が `PreviewState` なら、その行を返す */
export const savedLineFrom = (state: unknown): number | undefined => {
  if (typeof state !== "object" || state === null || !("line" in state)) {
    return undefined;
  }
  return typeof state.line === "number" ? state.line : undefined;
};
