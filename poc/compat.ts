import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { ESLint } from "eslint";
import compat from "eslint-plugin-compat";
import { postcssStubPlugin } from "../scripts/bundle.ts";

// esbuild の target に渡すブラウザの版（scripts/build.ts の BROWSER_TARGETS と同じ値）
const BROWSER_TARGETS = ["chrome99", "firefox98", "safari16.4"];
// 使う側のブラウザが読む JS の入口と、配布ファイルの名前
const ENTRIES = [
  { in: "src/index.ts", out: "index" },
  { in: "src/views/index.ts", out: "view" },
  { in: "src/comments/index.ts", out: "comments" },
  { in: "src/viewer/index.ts", out: "viewer" },
];
// esbuild の target の書き方（chrome99）を browserslist の書き方（chrome 99）に直す
const TARGET_PATTERN = /^([a-z]+)([\d.]+)$/;

/** esbuild の target を browserslist の問い合わせに直す */
function toBrowserslist(targets: string[]): string[] {
  return targets.map((target) => {
    const match = TARGET_PATTERN.exec(target);
    if (!match) {
      throw new Error(`target の書式が違う: ${target}`);
    }
    return `${match[1]} ${match[2]}`;
  });
}

/** root のソースを、配布物と同じ target で束ねて outdir に書き、書いたファイルを返す */
async function bundle(options: {
  root: string;
  outdir: string;
  minify: boolean;
}): Promise<string[]> {
  const entryPoints = ENTRIES.filter((entry) =>
    existsSync(join(options.root, entry.in)),
  );
  await build({
    absWorkingDir: options.root,
    entryPoints,
    outdir: options.outdir,
    bundle: true,
    format: "esm",
    minify: options.minify,
    target: BROWSER_TARGETS,
    plugins: [postcssStubPlugin],
    define: { __MDMARK_VERSION__: JSON.stringify("v0.0.0") },
    logLevel: "silent",
  });
  return entryPoints.map((entry) => join(options.outdir, `${entry.out}.js`));
}

/** 束ねた JS を eslint-plugin-compat で下限の版と照らし、報告の数を返す */
async function check(options: {
  files: string[];
  cwd: string;
}): Promise<number> {
  const eslint = new ESLint({
    cwd: options.cwd,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.js"],
        plugins: { compat },
        languageOptions: { ecmaVersion: "latest", sourceType: "module" },
        // 束ねた依存が持つ eslint のコメント（他のプラグインの規則の無効化）を読まない
        linterOptions: {
          noInlineConfig: true,
          reportUnusedInlineConfigs: "off",
          reportUnusedDisableDirectives: "off",
        },
        settings: { browsers: toBrowserslist(BROWSER_TARGETS) },
        rules: { "compat/compat": "error" },
      },
    ],
    ignore: false,
  });
  const results = await eslint.lintFiles(options.files);
  let count = 0;
  for (const result of results) {
    // 読まなかった eslint のコメントの知らせ（ruleId が null）は数えない
    for (const message of result.messages.filter(
      (item) => item.ruleId === "compat/compat",
    )) {
      count += 1;
      console.log(
        `${result.filePath}:${message.line}:${message.column} ${message.message}`,
      );
    }
  }
  return count;
}

const rootIndex = process.argv.indexOf("--root");
const root = resolve(
  rootIndex >= 0 ? (process.argv[rootIndex + 1] ?? ".") : ".",
);
const minify = process.argv.includes("--minify");
const outdir = mkdtempSync(join(tmpdir(), "mdmark-compat-"));
const started = performance.now();
const files = await bundle({ root, outdir, minify });
const count = await check({ files, cwd: outdir });
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `root=${root} minify=${minify} files=${files.length} reports=${count} seconds=${seconds}`,
);
process.exitCode = count === 0 ? 0 : 1;
