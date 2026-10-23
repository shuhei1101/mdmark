import { existsSync, readFileSync, rmSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, posix } from "node:path";
import { build, type Metafile } from "esbuild";
import { parse } from "yaml";
import {
  formatGuideContext,
  GUIDE_INDEX_FILE,
  type GuideEntry,
  parseGuideIndex,
} from "../src/plugin/guide.ts";
import {
  listBundledPackages,
  NODE_BANNER,
  NODE_MODULES_SEGMENT,
  NODE_TARGET,
  packageNameAfter,
  postcssStubPlugin,
  readLicenseBlock,
} from "./bundle.ts";

/** プラグインに束ねるソースと書く先 */
const PLUGIN_ENTRY_POINTS = [
  { in: "src/plugin/mcp.ts", out: "server/mcp" },
  { in: "src/plugin/session-start.ts", out: "scripts/session-start" },
];
/** 束ねず、`plugin/package.json` から Claude Code が入れる依存 */
const PLUGIN_EXTERNALS = ["esbuild"];
/** `dist/` から `plugin/dist/` へ写す、書き出しが埋めるファイル */
const PLUGIN_DIST_ASSETS = ["index.css", "viewer.js", "viewer.css", "view.js"];
/** ビルドの最初と失敗したときに消す、`plugin/` の中の生成物 */
const PLUGIN_OUTPUTS = [
  "plugin/server",
  "plugin/scripts",
  "plugin/dist",
  "plugin/guide",
  "plugin/THIRD_PARTY_LICENSES.txt",
];
/** リポジトリの直下からの使い方集の索引のパス */
const GUIDE_SOURCE = "guide/index.yaml";
/** バージョンを書くプラグインの定義のパス */
const PLUGIN_MANIFEST = "plugin/.claude-plugin/plugin.json";
/** 束ねたパッケージの配布物の中に取り込まれ、`node_modules` に無いパッケージのライセンスの本文を置くフォルダ */
const EMBEDDED_LICENSES_DIR = "scripts/licenses";
/** 索引に無いページへのリンクを書き換える GitHub の URL の頭 */
const GUIDE_LINK_BASE = "https://github.com/shuhei1101/mdmark/blob";
/** 束ねたプラグインのライセンスを書く、プラグインの直下のファイル名 */
const PLUGIN_LICENSES_FILE = "plugin/THIRD_PARTY_LICENSES.txt";
/** 使い方集の本文の相対リンクの拾い方: `[文字](リンク先)` と `![文字](リンク先)` */
const LINK_PATTERN = /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g;
/** リンク先が絶対 URL（`http:`・`mailto:` など）か */
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/** 使い方集の索引を読んで形・指すページの有無・セッションに渡す索引の文字数を検査する。合う行と、標準エラーに出す問題の行を返す */
export async function checkGuideSource(options: {
  /** 作業ツリーの場所 */
  root: string;
  /** 索引の文の文字数の上限 */
  contextLimit: number;
}): Promise<{ entries: GuideEntry[]; problems: string[] }> {
  const { root, contextLimit } = options;
  let raw: unknown;
  try {
    raw = parse(await readFile(join(root, GUIDE_SOURCE), "utf8"));
  } catch (error) {
    const reason =
      error instanceof Error
        ? (error.message.split("\n")[0] ?? error.message)
        : String(error);
    return {
      entries: [],
      problems: [`使い方集の索引を読めない: ${GUIDE_SOURCE}（${reason}）`],
    };
  }
  const { entries, problems: shapeProblems } = parseGuideIndex(raw);
  const problems = shapeProblems.map((problem) => {
    const place =
      problem.where === "" ? GUIDE_SOURCE : `${GUIDE_SOURCE}:${problem.where}`;
    return `${place}: ${problem.message}`;
  });
  // 行ごとに、指すページが作業ツリーにあるかを確かめる
  const guides = (raw as { guides?: unknown } | null)?.guides;
  if (Array.isArray(guides)) {
    guides.forEach((item: { page?: unknown } | null, position) => {
      const page = item?.page;
      if (typeof page === "string" && !existsSync(join(root, page))) {
        problems.push(
          `${GUIDE_SOURCE}:guides[${position}].page: ${page} が無い`,
        );
      }
    });
  }
  const length = formatGuideContext(entries).length;
  if (length > contextLimit) {
    problems.push(
      `使い方集の索引が ${length} 文字で、上限 ${contextLimit} 文字を超えた`,
    );
  }
  return { entries, problems };
}

/** `package.json` の `dependencies` を読む。ファイルが無ければ空 */
function readDependencies(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, "utf8")).dependencies ?? {};
}

/** `plugin/package.json` の束ねない依存のバージョンが作業ツリーの `package.json` と同じで、`plugin/package-lock.json` があるかを確かめる。問題の行を返す */
export async function checkPluginDependencies(root: string): Promise<string[]> {
  const problems: string[] = [];
  const own = readDependencies(join(root, "package.json"));
  const plugin = readDependencies(join(root, "plugin", "package.json"));
  for (const name of PLUGIN_EXTERNALS) {
    if (plugin[name] !== own[name]) {
      problems.push(
        `plugin/package.json の ${name} が ${plugin[name] ?? "なし"} で、package.json の ${own[name] ?? "なし"} と違う`,
      );
    }
  }
  if (!existsSync(join(root, "plugin", "package-lock.json"))) {
    problems.push(
      "plugin/package-lock.json が無い（plugin/ で npm install を流す）",
    );
  }
  return problems;
}

/** 束ねた入力のソースマップの `sources` から、パッケージの配布物に取り込まれた別のパッケージの名前を、名前の順に返す。束ねたパッケージ自身は含めない */
export function listEmbeddedPackages(options: {
  /** esbuild の出力 */
  metafile: Metafile;
  /** 作業ツリーの場所 */
  root: string;
}): string[] {
  const { metafile, root } = options;
  const bundled = new Set(listBundledPackages(metafile));
  const embedded = new Set<string>();
  for (const path of Object.keys(metafile.inputs)) {
    if (!path.includes(NODE_MODULES_SEGMENT)) {
      continue;
    }
    const mapPath = join(root, `${path}.map`);
    if (!existsSync(mapPath)) {
      continue;
    }
    const { sources = [] }: { sources?: string[] } = JSON.parse(
      readFileSync(mapPath, "utf8"),
    );
    for (const source of sources) {
      const index = source.lastIndexOf(NODE_MODULES_SEGMENT);
      if (index < 0) {
        continue;
      }
      const name = packageNameAfter(
        source.slice(index + NODE_MODULES_SEGMENT.length),
      );
      if (!bundled.has(name)) {
        embedded.add(name);
      }
    }
  }
  return [...embedded].sort();
}

/** 束ねたパッケージと、その中に取り込まれたパッケージのライセンスの本文を `plugin/THIRD_PARTY_LICENSES.txt` に書く */
export async function writePluginLicenses(options: {
  /** esbuild の出力 */
  metafile: Metafile;
  /** 作業ツリーの場所 */
  root: string;
}): Promise<void> {
  const { metafile, root } = options;
  const blocks = listBundledPackages(metafile).map((name) =>
    readLicenseBlock({ root, name }),
  );
  for (const name of listEmbeddedPackages({ metafile, root })) {
    const file = `${name.replace("/", "__")}.txt`;
    const path = join(root, EMBEDDED_LICENSES_DIR, file);
    if (!existsSync(path)) {
      throw new Error(
        `ライセンスの本文が無い: ${name}（${EMBEDDED_LICENSES_DIR}/${file} を置く）`,
      );
    }
    blocks.push(`${name}\n\n${readFileSync(path, "utf8")}`);
  }
  await mkdir(dirname(join(root, PLUGIN_LICENSES_FILE)), { recursive: true });
  await writeFile(join(root, PLUGIN_LICENSES_FILE), blocks.join("\n\n"));
}

/** `PLUGIN_MANIFEST` の `version` を埋めるバージョンにし、他のキーと並びは保つ */
export async function writePluginManifest(options: {
  /** 作業ツリーの場所 */
  root: string;
  /** 埋めるバージョン */
  version: string;
}): Promise<void> {
  const path = join(options.root, PLUGIN_MANIFEST);
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest.version = options.version;
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** 文字列を、インラインコードの内側とそれ以外の並びに分ける */
function splitInlineCode(line: string): { text: string; code: boolean }[] {
  const parts: { text: string; code: boolean }[] = [];
  let rest = line;
  while (rest.length > 0) {
    const open = /`+/.exec(rest);
    if (!open) {
      break;
    }
    const fence = open[0];
    const closeAt = rest.indexOf(fence, open.index + fence.length);
    if (closeAt < 0) {
      break;
    }
    parts.push({ text: rest.slice(0, open.index), code: false });
    parts.push({
      text: rest.slice(open.index, closeAt + fence.length),
      code: true,
    });
    rest = rest.slice(closeAt + fence.length);
  }
  parts.push({ text: rest, code: false });
  return parts;
}

/** 写すページの本文の相対リンクを、索引にあるページなら `read_guide` の名前、無いページならバージョンのタグの GitHub の URL に書き換える。コードの中、絶対 URL、ページ内のリンクは書き換えない */
export function rewriteGuideLinks(options: {
  /** ページの本文 */
  markdown: string;
  /** そのページのリポジトリの直下からのパス */
  page: string;
  /** 索引の行 */
  entries: GuideEntry[];
  /** 埋めるバージョン */
  version: string;
}): string {
  const { markdown, page, entries, version } = options;
  const rewrite = (text: string): string =>
    text.replace(
      LINK_PATTERN,
      (whole, bang: string, label: string, target: string, title: string) => {
        if (SCHEME_PATTERN.test(target) || target.startsWith("#")) {
          return whole;
        }
        const [pathPart = "", ...hashParts] = target.split("#");
        const hash = hashParts.length > 0 ? `#${hashParts.join("#")}` : "";
        const resolved = posix.normalize(
          posix.join(posix.dirname(page), pathPart),
        );
        if (resolved.startsWith("..")) {
          return whole;
        }
        const entry = entries.find((candidate) => candidate.page === resolved);
        if (entry && bang === "") {
          return `${label}（read_guide の ${entry.name}）`;
        }
        return `${bang}[${label}](${GUIDE_LINK_BASE}/${version}/${resolved}${hash}${title})`;
      },
    );
  let inFence = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^ {0,3}(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) {
        return line;
      }
      return splitInlineCode(line)
        .map((part) => (part.code ? part.text : rewrite(part.text)))
        .join("");
    })
    .join("\n");
}

/** 検査した索引を `plugin/guide/index.json` に書き、指すページを `plugin/guide/` の下に同じパスで写す */
export async function writePluginGuide(options: {
  /** 作業ツリーの場所 */
  root: string;
  /** 検査した索引の行 */
  entries: GuideEntry[];
  /** 埋めるバージョン */
  version: string;
}): Promise<void> {
  const { root, entries, version } = options;
  const guideDir = join(root, "plugin", "guide");
  await mkdir(guideDir, { recursive: true });
  await writeFile(
    join(guideDir, GUIDE_INDEX_FILE),
    `${JSON.stringify({ schema: 1, guides: entries })}\n`,
  );
  const written = new Set<string>();
  for (const entry of entries) {
    if (written.has(entry.page)) {
      continue;
    }
    written.add(entry.page);
    const markdown = await readFile(join(root, entry.page), "utf8");
    const target = join(guideDir, entry.page);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(
      target,
      rewriteGuideLinks({ markdown, page: entry.page, entries, version }),
    );
  }
}

/** `PLUGIN_OUTPUTS` を消す。無いものは飛ばす */
export function removePluginOutputs(root: string): void {
  for (const path of PLUGIN_OUTPUTS) {
    rmSync(join(root, path), { recursive: true, force: true });
  }
}

/** 使い方集の索引と依存を検査し、合えば MCP サーバーとフックを束ね、配布物・使い方集・バージョン・ライセンスを `plugin/` に書く。問題があれば `plugin/` に何も書かずに問題の行を返す。`src/plugin/mcp.ts` が無ければ何もしない */
export async function buildPlugin(options: {
  /** 埋めるバージョン */
  version: string;
  /** 作業ツリーの場所 */
  root: string;
  /** 索引の文の文字数の上限 */
  contextLimit: number;
}): Promise<string[]> {
  const { version, root, contextLimit } = options;
  if (!existsSync(join(root, "src", "plugin", "mcp.ts"))) {
    return [];
  }
  const guide = await checkGuideSource({ root, contextLimit });
  const problems = [
    ...guide.problems,
    ...(await checkPluginDependencies(root)),
  ];
  if (problems.length > 0) {
    return problems;
  }
  const result = await build({
    absWorkingDir: root,
    entryPoints: PLUGIN_ENTRY_POINTS,
    outdir: "plugin",
    bundle: true,
    format: "esm",
    platform: "node",
    target: NODE_TARGET,
    banner: { js: NODE_BANNER },
    external: PLUGIN_EXTERNALS,
    plugins: [postcssStubPlugin],
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    metafile: true,
    logLevel: "silent",
  });
  for (const asset of PLUGIN_DIST_ASSETS) {
    const source = join(root, "dist", asset);
    if (existsSync(source)) {
      await mkdir(join(root, "plugin", "dist"), { recursive: true });
      await copyFile(source, join(root, "plugin", "dist", asset));
    }
  }
  await writePluginGuide({ root, entries: guide.entries, version });
  await writePluginManifest({ root, version });
  await writePluginLicenses({ metafile: result.metafile, root });
  return [];
}
