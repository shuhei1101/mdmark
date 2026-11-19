import type { On } from "claude-code";
import { mock } from "claude-code/testing";

/** プラグインの名前 */
export const PLUGIN = "mdmark-style";

/** テストのホームのフォルダ */
export const HOME = "/home/u";

/** 既定の設定ファイルのパス */
export const CONFIG_PATH = `${HOME}/.config/mdmark-style/settings.yaml`;

/** 起動したプロジェクトのフォルダ */
export const PROJECT_ROOT = "/work/proj";

/** 用語集の `mdmark.config.yaml` の場所 */
export const GLOSSARY_CONFIG = "/g/mdmark.config.yaml";

/** 索引の `terms[]` に `WS`、`aliases` の行のファイルに `mdmark`、用語集の表に `エイリアス` を持つ用語集のファイル */
export const GLOSSARY_FILES: Record<string, string> = {
  [GLOSSARY_CONFIG]: [
    "index: index.yaml",
    "aliases:",
    "  - id: words",
    "    alias_type: term",
    "    paths:",
    "      - terms/*.yaml",
    "",
  ].join("\n"),
  "/g/index.yaml": [
    "schema: 2",
    "docs:",
    "  - id: guide",
    "    path: guide.md",
    "    title: ガイド",
    "terms:",
    "  - id: ws",
    "    term: WS",
    "    meaning: 話し合いの記録を配置するフォルダ",
    "",
  ].join("\n"),
  "/g/guide.md": [
    "# ガイド",
    "",
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| エイリアス | 文書を指す別の名前 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n"),
  "/g/terms/mdmark.yaml": [
    "id: mdmark",
    "name: mdmark",
    "description: Markdown 文書の表示を各アプリで共通に使用するライブラリ",
    "",
  ].join("\n"),
};

/** `global` に `yaml` の行を持つ設定ファイル */
export const settingsFile = (...lines: string[]): Record<string, string> => ({
  [CONFIG_PATH]: ["global:", ...lines.map((line) => `  ${line}`), ""].join(
    "\n",
  ),
});

/** `$.ui.log` と `$.ui.copy` で受け取った値 */
export type Recorded = {
  logs: { text: string; to: string }[];
  copies: string[];
};

/** パスの親のフォルダ */
const dirOf = (path: string): string =>
  path.slice(0, path.lastIndexOf("/")) || "/";

/** `files` の中で、フォルダの直下にあるファイルとフォルダ */
const listOf = (files: Record<string, string>, dir: string) => {
  const names = new Map<string, "file" | "dir">();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(`${dir}/`)) {
      continue;
    }
    const [name = "", ...rest] = path.slice(dir.length + 1).split("/");
    names.set(name, rest.length > 0 ? "dir" : "file");
  }
  return [...names].map(([name, kind]) => ({
    name,
    kind,
    size: kind === "file" ? (files[`${dir}/${name}`] ?? "").length : 0,
    mtimeMs: 0,
  }));
};

/** フォルダとして扱うパスか（`files` のどれかの親） */
const isDir = (files: Record<string, string>, path: string): boolean =>
  Object.keys(files).some((file) => dirOf(file).startsWith(path));

/**
 * Claude Code の代わりに、mod が呼ぶファイル・環境変数・プロジェクト・設定・ログ・コピーを回答する。
 * `files` に無いパスは無いファイルとして回答する
 */
export const installWorld = (
  on: On,
  options: { files: Record<string, string>; theme?: string },
): Recorded => {
  const { files, theme = "dark" } = options;
  const recorded: Recorded = { logs: [], copies: [] };
  mock.env(on, { HOME: HOME });
  on("fs.exists", (_, e) => ({
    value: e.path in files || isDir(files, e.path),
  }));
  on("fs.read", (_, e) => {
    const text = files[e.path];
    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`);
    }
    return { value: text };
  });
  on("fs.list", (_, e) => ({ value: listOf(files, e.path) }));
  on("session.root", () => ({ value: PROJECT_ROOT }));
  on("settings.read", () => ({ value: { theme } }));
  on("ui.log", (_, e) => {
    recorded.logs.push({ text: e.text, to: e.to });
    return { value: undefined };
  });
  on("ui.copy", (_, e) => {
    recorded.copies.push(e.text);
    return { value: { isCopied: true } };
  });
  return recorded;
};

/** `ui.drawn()` の部品の木の要素 */
export type DrawnNode = {
  type: string;
  props?: Record<string, unknown>;
  hover?: Record<string, unknown>;
  children?: unknown[];
};

/** `ui.drawn()` の部品の木から、条件に合う要素を文書の順に集める */
export const nodesOf = (
  node: unknown,
  match: (node: DrawnNode) => boolean,
): DrawnNode[] => {
  if (typeof node !== "object" || node === null || !("type" in node)) {
    return [];
  }
  const drawn = node as DrawnNode;
  return [
    ...(match(drawn) ? [drawn] : []),
    ...(drawn.children ?? []).flatMap((child) => nodesOf(child, match)),
  ];
};

/** 要素の中の文字を文書の順につないだもの */
export const textOf = (node: unknown): string => {
  if (typeof node === "string") {
    return node;
  }
  if (typeof node !== "object" || node === null) {
    return "";
  }
  return ((node as DrawnNode).children ?? []).map(textOf).join("");
};
