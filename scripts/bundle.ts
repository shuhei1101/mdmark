import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metafile, Plugin } from "esbuild";

/** 利用側のブラウザが読み込む JS のまとめの target（esbuild に指定するブラウザのバージョン） */
export const BROWSER_TARGETS = ["chrome99", "firefox98", "safari16.4"];
/** Node で動くまとめの target */
export const NODE_TARGET = "node24";
/** Node で動くまとめの先頭に配置する行: 入口として実行できるようにし、まとめた CommonJS の依存の `require` を使用できるようにする */
export const NODE_BANNER = [
  "#!/usr/bin/env node",
  'import { createRequire as __createRequire } from "node:module";',
  "const require = __createRequire(import.meta.url);",
].join("\n");
/** まとめるときに `define` で埋める値: mdmark のバージョンと、まとめる lucide のバージョン（mdmark の `package.json` の `dependencies`。まとめる場所 `root` によらない） */
export function bundleDefines(version: string): Record<string, string> {
  const manifest = JSON.parse(
    readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  return {
    __MDMARK_VERSION__: JSON.stringify(version),
    __MDMARK_LUCIDE_VERSION__: JSON.stringify(
      manifest.dependencies?.lucide ?? "",
    ),
  };
}

/** まとめたパッケージの入力のパスにある、依存の配置場所 */
export const NODE_MODULES_SEGMENT = "node_modules/";
/** まとめたパッケージの配布物の中に取り込まれ、`node_modules` に無いパッケージのライセンスの本文を配置するフォルダ */
const EMBEDDED_LICENSES_DIR = "scripts/licenses";
// 差し替えた postcss を配置する esbuild の名前空間
const STUB_NAMESPACE = "stub";
// パッケージの直下にあるライセンスのファイル名
const LICENSE_FILE_PATTERN = /^licen[sc]e/i;

/** `node_modules/` の後ろから `@scope/name` か `name` を取り出す */
export function packageNameAfter(path: string): string {
  const [first, second] = path.split("/");
  return first?.startsWith("@") ? `${first}/${second}` : (first ?? "");
}

/** esbuild の `metafile` の入力からまとめたパッケージの名前を、名前の順に返却する */
export function listBundledPackages(metafile: Metafile): string[] {
  const names = new Set<string>();
  for (const path of Object.keys(metafile.inputs)) {
    const index = path.lastIndexOf(NODE_MODULES_SEGMENT);
    if (index < 0) {
      continue;
    }
    names.add(
      packageNameAfter(path.slice(index + NODE_MODULES_SEGMENT.length)),
    );
  }
  return [...names].sort();
}

/** `node_modules` のパッケージの名前・バージョン・ライセンスと、ライセンスのファイルの本文を並べた 1 ブロックを返却する */
export function readLicenseBlock(options: {
  /** 作業ツリーの場所 */
  root: string;
  /** パッケージの名前 */
  name: string;
}): string {
  const dir = join(options.root, "node_modules", options.name);
  const pkg: { version: string; license: string } = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  );
  const licenseFile = readdirSync(dir).find((file) =>
    LICENSE_FILE_PATTERN.test(file),
  );
  if (!licenseFile) {
    throw new Error(`ライセンスの本文が無い: ${options.name}`);
  }
  const text = readFileSync(join(dir, licenseFile), "utf8");
  return `${options.name} ${pkg.version} (${pkg.license})\n\n${text}`;
}

/** まとめたパッケージの配布物に取り込まれたパッケージの名前と、`EMBEDDED_LICENSES_DIR` のライセンスの本文を並べた 1 ブロックを返却する。本文のファイルが無ければ例外を投げる */
export function readEmbeddedLicenseBlock(options: {
  /** 作業ツリーの場所 */
  root: string;
  /** パッケージの名前 */
  name: string;
}): string {
  const { root, name } = options;
  const file = `${name.replace("/", "__")}.txt`;
  const path = join(root, EMBEDDED_LICENSES_DIR, file);
  if (!existsSync(path)) {
    throw new Error(
      `ライセンスの本文が無い: ${name}（${EMBEDDED_LICENSES_DIR}/${file} を配置する）`,
    );
  }
  return `${name}\n\n${readFileSync(path, "utf8")}`;
}

/** `postcss` の import を、`parse` を呼ぶと例外を投げる空の部品に差し替える esbuild のプラグイン */
export const postcssStubPlugin: Plugin = {
  name: "stub-postcss",
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^postcss$/ }, () => ({
      path: "postcss",
      namespace: STUB_NAMESPACE,
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: STUB_NAMESPACE }, () => ({
      contents:
        'module.exports = { parse() { throw new Error("postcss は配布物に含めない") } }',
      loader: "js",
    }));
  },
};
