import { writeFile } from "node:fs/promises";
import { build } from "esbuild";
import {
  listBundledPackages,
  NODE_BANNER,
  NODE_TARGET,
  readLicenseBlock,
} from "../../scripts/bundle.ts";

// 検証用のスクリプトをプラグインと同じ設定で 1 ファイルに束ね、束ねたパッケージのライセンスを書き出す
const result = await build({
  entryPoints: ["poc/aliases-schema/validate.ts"],
  outfile: "poc/aliases-schema/out/validate.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: NODE_TARGET,
  banner: { js: NODE_BANNER },
  metafile: true,
});
const names = listBundledPackages(result.metafile);
await writeFile(
  "poc/aliases-schema/out/THIRD_PARTY_LICENSES.txt",
  names.map((name) => readLicenseBlock({ root: ".", name })).join("\n\n"),
);
console.log(names.join("\n"));
