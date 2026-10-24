import { cp, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");

// `plugin/` の中の、ビルドが書く生成物と依存の置き場所（写さない）
const PLUGIN_GENERATED = [
  "server",
  "scripts",
  "dist",
  "guide",
  "THIRD_PARTY_LICENSES.txt",
  "node_modules",
];

/** 一時の作業ツリーの `package.json` を書く。プラグインのビルドが比べる `esbuild` のバージョンを、リポジトリの `package.json` から写す */
export async function writeRootPackageJson(root: string): Promise<void> {
  const own = JSON.parse(
    await readFile(join(REPO_ROOT, "package.json"), "utf8"),
  );
  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({
      type: "module",
      dependencies: { esbuild: own.dependencies.esbuild },
    })}\n`,
  );
}

/** プラグインのビルドが読む入力（使い方集の索引・指す `docs/` のページ・`plugin/` の定義・取り込まれたパッケージのライセンスの本文）を、一時の作業ツリーへ写す */
export async function copyPluginInputs(root: string): Promise<void> {
  await cp(join(REPO_ROOT, "guide"), join(root, "guide"), { recursive: true });
  await cp(join(REPO_ROOT, "docs"), join(root, "docs"), { recursive: true });
  await cp(
    join(REPO_ROOT, "scripts", "licenses"),
    join(root, "scripts", "licenses"),
    { recursive: true },
  );
  const source = join(REPO_ROOT, "plugin");
  await cp(source, join(root, "plugin"), {
    recursive: true,
    filter: (path) => {
      const first = relative(source, path).split(sep)[0] ?? "";
      return !PLUGIN_GENERATED.includes(first);
    },
  });
}
