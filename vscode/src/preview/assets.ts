import { isAbsolute, relative, resolve } from "node:path";

/** 書いたパスからクエリとフラグメントを外し、Markdown のフォルダ、`assetsRoot` があればその後に `assetsRoot` を基準にした、ワークスペースの配下の絶対パスを探す順に返す */
export function assetCandidates(
  path: string,
  options: {
    /** Markdown のフォルダの絶対パス */
    docDir: string;
    /** 設定ファイルの `assets.root` の絶対パス */
    assetsRoot?: string | undefined;
    /** ワークスペースのフォルダの絶対パス */
    workspaceDirs: string[];
  },
): { files: string[]; suffix: string } {
  const at = path.search(/[?#]/);
  const bare = at < 0 ? path : path.slice(0, at);
  const suffix = at < 0 ? "" : path.slice(at);
  let decoded = bare;
  try {
    decoded = decodeURI(bare);
  } catch {
    // 戻せないときは書いたまま探す
  }
  const roots =
    options.assetsRoot === undefined
      ? [options.docDir]
      : [options.docDir, options.assetsRoot];
  const files = roots
    .map((root) => resolve(root, decoded))
    .filter((file) =>
      options.workspaceDirs.some((dir) => {
        const inside = relative(dir, file);
        return inside !== "" && !inside.startsWith("..") && !isAbsolute(inside);
      }),
    );
  return { files, suffix };
}
