/** 描く先を包む要素の `data-*` に配置された、パネルの始め方 */
export type PreviewBoot = {
  /** 描く先を包む要素。React の木を描く場所で、配色の class を付ける */
  root: HTMLElement;
  /** 読み込む配布物の `index.js` の URL。バージョンを決められないときは持たない */
  distJs: string | undefined;
  /** 読み込むバージョン（描けない理由に出す） */
  version: string | undefined;
  /** 配布物を読み込まずに出す状態 */
  status: "versionUndecidable" | undefined;
  /** `mdmark.configPath` の記載したままの値（帯に出す） */
  configPath: string;
  /** まとめた `extensions` の Webview で読み込める URL（`data-extensions` の JSON の配列） */
  extensions: string[];
  /** `inspect`・`axe` を受けるか */
  test: boolean;
};

/** 描く先を包む要素の `data-*` からパネルの始め方を読み込む */
export const readBoot = (root: HTMLElement): PreviewBoot => ({
  root,
  distJs: root.dataset.distJs,
  version: root.dataset.version,
  status:
    root.dataset.status === "versionUndecidable"
      ? "versionUndecidable"
      : undefined,
  configPath: root.dataset.configPath ?? "",
  extensions: readExtensions(root.dataset.extensions),
  test: root.dataset.test !== undefined,
});

/** `data-extensions` を JSON の文字列の配列として読み込む。無い・読み込めない・文字列の配列でないときは空 */
const readExtensions = (value: string | undefined): string[] => {
  if (value === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((url) => typeof url === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
};

/** `getState` で読み込んだ値が `PreviewState` なら、その行を返却する */
export const savedLineFrom = (state: unknown): number | undefined => {
  if (typeof state !== "object" || state === null || !("line" in state)) {
    return undefined;
  }
  return typeof state.line === "number" ? state.line : undefined;
};
