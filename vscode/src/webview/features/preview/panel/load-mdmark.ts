import type { DiffSource } from "./diff-source.ts";

/** `mount` の戻り値 */
export type MountHandle = {
  update: (
    markdown: string,
    options?: { includes?: Record<string, string> },
  ) => void;
  destroy: () => void;
};

/** `import()` で読み込んだ mdmark の配布物のうち、Webview が使用するもの。`diffModes` を持たない前のバージョンもある */
export type Mdmark = {
  mount: (
    element: HTMLElement,
    options: {
      markdown: string;
      config?: unknown;
      diffSource?: DiffSource;
      docId?: string;
      diffMode?: "blocks";
      /** 取り込む文書の表（前のバージョンは読み込まない） */
      includes?: Record<string, string>;
      /** 設定の `aliases` から作ったエイリアス（前のバージョンは読み込まない） */
      aliases?: unknown[];
    },
  ) => MountHandle;
  diffModes?: unknown;
  /** 拡張を登録する。配布物を読み込んだ後、`mount` の前に呼ぶ */
  registerExtension?: (extension: unknown) => void;
};

/** 配布物を実行時の `import()` で読み込む（React Compiler は `import()` を持つコンポーネントを変換しないため、コンポーネントの外に配置する） */
export const loadMdmark = (url: string): Promise<Mdmark> =>
  import(/* @vite-ignore */ url);

/** 拡張のモジュールを読み込む関数 */
export type ImportModule = (url: string) => Promise<{ default?: unknown }>;

/** 拡張を実行時の `import()` で読み込む */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** 拡張の URL を順に読み込み、`default` を読み込んだ配布物の `registerExtension` に指定する。読み込めない・登録できない拡張は飛ばして続ける */
export const registerExtensions = async (options: {
  /** 読み込んだ配布物 */
  mdmark: Mdmark;
  /** `boot.extensions` */
  urls: string[];
  /** 拡張を読み込む関数 */
  importModule?: ImportModule | undefined;
}): Promise<void> => {
  const importModule = options.importModule ?? importByUrl;
  for (const url of options.urls) {
    try {
      const module = await importModule(url);
      options.mdmark.registerExtension?.(module.default);
    } catch (error) {
      console.error("拡張を登録できません:", url, error);
    }
  }
};

/** 読み込めなかった `index.js` の URL を `fetch` の `HEAD` で確認し、404 なら `versionMissing`、それ以外は `offline` を返却する */
export const classifyLoadFailure = async (options: {
  /** 読み込めなかった URL */
  url: string;
  /** 要求に使用する `fetch` */
  fetch: typeof fetch;
}): Promise<"offline" | "versionMissing"> => {
  try {
    const response = await options.fetch(options.url, { method: "HEAD" });
    return response.status === 404 ? "versionMissing" : "offline";
  } catch {
    return "offline";
  }
};

/** 読み込んだ配布物の `diffModes` が配列で `blocks` を含むとき、差分の色分けに対応する */
export const supportsDiffBlocks = (mdmark: { diffModes?: unknown }): boolean =>
  Array.isArray(mdmark.diffModes) && mdmark.diffModes.includes("blocks");
