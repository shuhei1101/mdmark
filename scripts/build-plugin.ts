import { existsSync, readFileSync, rmSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build, type Metafile } from "esbuild";
import { parse } from "yaml";
import { type GuideEntry, parseGuideIndex } from "../src/plugin/guide.ts";
import {
  bundleDefines,
  listBundledPackages,
  NODE_BANNER,
  NODE_MODULES_SEGMENT,
  NODE_TARGET,
  packageNameAfter,
  readEmbeddedLicenseBlock,
  readLicenseBlock,
} from "./bundle.ts";

/** プラグインにまとめるソースと記載する先 */
const PLUGIN_ENTRY_POINTS = [
  { in: "src/plugin/pre-tool-use.ts", out: "scripts/pre-tool-use" },
  { in: "src/plugin/session-start.ts", out: "scripts/session-start" },
  { in: "src/plugin/setup/main.ts", out: "bin/setup" },
];
/** ビルドの最初と失敗したときに削除する、`plugin/` の中の生成物 */
const PLUGIN_OUTPUTS = [
  "plugin/scripts",
  "plugin/bin",
  "plugin/templates",
  "plugin/THIRD_PARTY_LICENSES.txt",
];
/** `setup` のスキルが使用する `mdmark.config.yaml` の雛形の原本と、プラグインに写す先 */
const CONFIG_TEMPLATE = {
  from: "templates/mdmark.config.yaml",
  to: "plugin/templates/mdmark.config.yaml",
};
/** リポジトリの直下からのガイドの索引のパス */
const GUIDE_SOURCE = "guide/index.yaml";
/** まとめたプラグインのライセンスを記載する、プラグインの直下のファイル名 */
const PLUGIN_LICENSES_FILE = "plugin/THIRD_PARTY_LICENSES.txt";

/** ガイドの索引を読み込んで構造と指すページの有無を検査する。合う行と、標準エラーに出す問題の行を返却する */
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
      problems: [`ガイドの索引を読み込めない: ${GUIDE_SOURCE}（${reason}）`],
    };
  }
  const { entries, problems: shapeProblems } = parseGuideIndex(raw);
  const problems = shapeProblems.map((problem) => {
    const place =
      problem.where === "" ? GUIDE_SOURCE : `${GUIDE_SOURCE}:${problem.where}`;
    return `${place}: ${problem.message}`;
  });
  // 行ごとに、指すページが作業ツリーにあるかを確認する
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

/** まとめた入力のソースマップの `sources` から、パッケージの配布物に取り込まれた別のパッケージの名前を、名前の順に返却する。まとめたパッケージ自身は含めない */
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

/** まとめたパッケージと、その中に取り込まれたパッケージのライセンスの本文を `plugin/THIRD_PARTY_LICENSES.txt` に書き込む */
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

/** `PLUGIN_OUTPUTS` を削除する。無いものは飛ばす */
export function removePluginOutputs(root: string): void {
  for (const path of PLUGIN_OUTPUTS) {
    rmSync(join(root, path), { recursive: true, force: true });
  }
}

/** ガイドの索引を検査し、合えばフックをまとめ、ライセンスを `plugin/` に書き込む。問題があれば `plugin/` に何も書き込まずに問題の行を返却する。`src/plugin/pre-tool-use.ts` が無ければ何もしない */
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
    define: bundleDefines(version),
    metafile: true,
    logLevel: "silent",
  });
  await mkdir(dirname(join(root, CONFIG_TEMPLATE.to)), { recursive: true });
  await copyFile(
    join(root, CONFIG_TEMPLATE.from),
    join(root, CONFIG_TEMPLATE.to),
  );
  await writePluginLicenses({ metafile: result.metafile, root });
  return [];
}
