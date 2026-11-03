import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build, type Metafile } from "esbuild";
import { parse } from "yaml";
import { type GuideEntry, parseGuideIndex } from "../src/plugin/guide.ts";
import {
  listBundledPackages,
  NODE_BANNER,
  NODE_MODULES_SEGMENT,
  NODE_TARGET,
  packageNameAfter,
  readEmbeddedLicenseBlock,
  readLicenseBlock,
} from "./bundle.ts";

/** プラグインに束ねるソースと書く先 */
const PLUGIN_ENTRY_POINTS = [
  { in: "src/plugin/pre-tool-use.ts", out: "scripts/pre-tool-use" },
];
/** ビルドの最初と失敗したときに消す、`plugin/` の中の生成物 */
const PLUGIN_OUTPUTS = ["plugin/scripts", "plugin/THIRD_PARTY_LICENSES.txt"];
/** リポジトリの直下からの使い方集の索引のパス */
const GUIDE_SOURCE = "guide/index.yaml";
/** バージョンを書くプラグインの定義のパス */
const PLUGIN_MANIFEST = "plugin/.claude-plugin/plugin.json";
/** 束ねたプラグインのライセンスを書く、プラグインの直下のファイル名 */
const PLUGIN_LICENSES_FILE = "plugin/THIRD_PARTY_LICENSES.txt";

/** 使い方集の索引を読んで形と指すページの有無を検査する。合う行と、標準エラーに出す問題の行を返す */
export async function checkGuideSource(options: {
  /** 作業ツリーの場所 */
  root: string;
}): Promise<{ entries: GuideEntry[]; problems: string[] }> {
  const { root } = options;
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
  return { entries, problems };
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
    blocks.push(readEmbeddedLicenseBlock({ root, name }));
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

/** `PLUGIN_OUTPUTS` を消す。無いものは飛ばす */
export function removePluginOutputs(root: string): void {
  for (const path of PLUGIN_OUTPUTS) {
    rmSync(join(root, path), { recursive: true, force: true });
  }
}

/** 使い方集の索引を検査し、合えばフックを束ね、バージョン・ライセンスを `plugin/` に書く。問題があれば `plugin/` に何も書かずに問題の行を返す。`src/plugin/pre-tool-use.ts` が無ければ何もしない */
export async function buildPlugin(options: {
  /** 埋めるバージョン */
  version: string;
  /** 作業ツリーの場所 */
  root: string;
}): Promise<string[]> {
  const { version, root } = options;
  if (!existsSync(join(root, "src", "plugin", "pre-tool-use.ts"))) {
    return [];
  }
  const guide = await checkGuideSource({ root });
  if (guide.problems.length > 0) {
    return guide.problems;
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
    define: { __MDMARK_VERSION__: JSON.stringify(version) },
    metafile: true,
    logLevel: "silent",
  });
  await writePluginManifest({ root, version });
  await writePluginLicenses({ metafile: result.metafile, root });
  return [];
}
