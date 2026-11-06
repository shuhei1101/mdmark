import type { DiffSource } from "./diff-source.ts";

/** `mount` の戻り値 */
export type MountHandle = {
  update: (
    markdown: string,
    options?: { includes?: Record<string, string> },
  ) => void;
  destroy: () => void;
};

/** `import()` で読んだ mdmark の配布物のうち、Webview が使うもの。`diffModes` を持たない前のバージョンもある */
export type Mdmark = {
  mount: (
    element: HTMLElement,
    options: {
      markdown: string;
      config?: unknown;
      diffSource?: DiffSource;
      docId?: string;
      diffMode?: "blocks";
      /** 取り込む文書の表（前のバージョンは読まない） */
      includes?: Record<string, string>;
    },
  ) => MountHandle;
  diffModes?: unknown;
};

/** 配布物を実行時の `import()` で読む（React Compiler は `import()` を持つコンポーネントを変換しないため、コンポーネントの外に置く） */
export const loadMdmark = (url: string): Promise<Mdmark> =>
  import(/* @vite-ignore */ url);

/** 読めなかった `index.js` の URL を `fetch` の `HEAD` で確かめ、404 なら `versionMissing`、それ以外は `offline` を返す */
export const classifyLoadFailure = async (options: {
  /** 読めなかった URL */
  url: string;
  /** 要求に使う `fetch` */
  fetch: typeof fetch;
}): Promise<"offline" | "versionMissing"> => {
  try {
    const response = await options.fetch(options.url, { method: "HEAD" });
    return response.status === 404 ? "versionMissing" : "offline";
  } catch {
    return "offline";
  }
};

/** 読んだ配布物の `diffModes` が配列で `blocks` を含むとき、差分の色分けに対応する */
export const supportsDiffBlocks = (mdmark: { diffModes?: unknown }): boolean =>
  Array.isArray(mdmark.diffModes) && mdmark.diffModes.includes("blocks");
