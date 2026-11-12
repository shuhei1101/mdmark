import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { migrationsDirOf } from "../../migrations-dir.ts";
import { greetSource } from "../cascade.ts";
import {
  test as base,
  expect,
  linesOf,
  openStandalone,
  runCli,
  writeFiles,
} from "../cli.ts";
import { buildDistRoot, removeDistRoot } from "../dist-page.ts";

/** 呼んだ CLI のバージョンを `v0.5.0` にしてビルドし、リポジトリの `migrations/next/` を `v0.5.0` の移行の手順にしたパッケージ（ワーカーごとに 1 回作る） */
const test = base.extend<object, { package050: string }>({
  package050: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright の道具は、第 1 引数の分割代入から依存を読み込む
    async ({}, use) => {
      const root = await buildDistRoot("v0.5.0");
      await rm(join(root, "migrations"), { recursive: true, force: true });
      const nextDir = migrationsDirOf("marker-json.mjs");
      const files: Record<string, string> = {};
      for (const name of await readdir(nextDir)) {
        files[`migrations/v0.5.0/${name}`] = await readFile(
          join(nextDir, name),
          "utf8",
        );
      }
      await writeFiles(root, files);
      await use(root);
      await removeDistRoot(root);
    },
    { scope: "worker" },
  ],
});

// ブラウザは書き出した HTML を開くときだけ使用するため、1 つのブラウザのプロジェクトだけで実行する
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "書き出しと点検のシナリオなので chromium のプロジェクトだけで流す",
);

/** 手元のバージョンを 1 つ前のマイナーバージョンにした設定（`extensions` の行を加えられる） */
const config = (extra = ""): string =>
  [
    "version: v0.4.0",
    "index: index.yaml",
    "build:",
    '  include: ["*.md"]',
    "  out: dist/docs.html",
    extra,
  ].join("\n");

/** 文書 2 つの索引 */
const INDEX = [
  "schema: 2",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: A",
  "  - id: b",
  "    path: b.md",
  "    title: B",
  "",
].join("\n");

/** 今の書き方のマーカーを持つ 1 つ目の文書（集計・絞り込み・隠す列を持つ表と、コードブロックの飾り） */
const LEGACY_A = [
  "# A",
  "",
  "<!-- table: data +total +columns total=数量:sum filter=名前 hide=備考 -->",
  "",
  "| 名前 | 数量 | 備考 |",
  "| --- | --- | --- |",
  "| a | 1 | x |",
  "| b | 2 | y |",
  "",
  "<!-- /table -->",
  "",
  "<!-- code: title=app.ts lines highlight=2-3 -->",
  "",
  "```ts",
  "const a = 1;",
  "const b = 2;",
  "const c = 3;",
  "```",
  "",
].join("\n");

/** 今の書き方のマーカーを持つ 2 つ目の文書（details の範囲・図の番号・取り込み） */
const LEGACY_B = [
  "# B",
  "",
  "<!-- details: 実行の例 open -->",
  "",
  "実行の段落",
  "",
  "<!-- /details -->",
  "",
  "<!-- fig: arch -->",
  "",
  '![構成](arch.png "全体の構成")',
  "",
  "[構成の図](#fig-arch)",
  "",
  "<!-- include: src/app.ts#L2-L3 -->",
  "",
].join("\n");

/** 取り込む `src/app.ts` */
const APP_TS = ["const v1 = 1;", "const v2 = 2;", "const v3 = 3;", ""].join(
  "\n",
);

/** 今の書き方の文書を持つフォルダを作る */
async function createLegacyDir(
  tempDir: () => Promise<string>,
  options: { extra?: string; a?: string } = {},
): Promise<string> {
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": config(options.extra),
    "index.yaml": INDEX,
    "a.md": options.a ?? LEGACY_A,
    "b.md": LEGACY_B,
    "arch.png": "",
    "src/app.ts": APP_TS,
  });
  return dir;
}

/** 文書を書き出した HTML を開き、描いた文書の HTML（記載の警告を除く）を返却する */
async function exportedBody(
  page: Page,
  options: {
    builtRoot: string;
    tempDir: () => Promise<string>;
    dir: string;
    doc: string;
    out: string;
  },
): Promise<string> {
  const exported = await runCli(
    options.builtRoot,
    ["export", options.doc, "--out", options.out],
    options.dir,
  );
  expect(exported.code, exported.stderr).toBe(0);
  await openStandalone(page, {
    tempDir: options.tempDir,
    htmlFile: join(options.dir, options.out),
  });
  await page.locator(".mdmark").first().waitFor();
  return page
    .locator(".mdmark")
    .first()
    .evaluate((article) => {
      const copy = article.cloneNode(true) as HTMLElement;
      for (const warning of copy.querySelectorAll(".mdmark-syntax-warning")) {
        warning.remove();
      }
      return copy.innerHTML;
    });
}

/** 文書の、名前の後ろが `{` で始まらない引数を持つマーカー */
function legacyMarks(markdown: string): string[] {
  return (
    markdown
      .split("```")
      .filter((_, index) => index % 2 === 0)
      .join("")
      .match(/<!-- [a-z][a-z0-9-]*: [^{][^>]*-->/g) ?? []
  );
}

// 点検の案内に従って移行の手順で JSON の記載へ書き換え、点検に合格し、移行の前と同じ描画で書き出す（正常シナリオ）
test("test_normal", async ({ package050, tempDir, page }) => {
  // 準備
  const dir = await createLegacyDir(tempDir);
  const beforeA = await exportedBody(page, {
    builtRoot: package050,
    tempDir,
    dir,
    doc: "a.md",
    out: "before/a.html",
  });
  const beforeB = await exportedBody(page, {
    builtRoot: package050,
    tempDir,
    dir,
    doc: "b.md",
    out: "before/b.html",
  });
  // 実行: 1 回目の点検
  const first = await runCli(package050, ["check"], dir);
  // 検証
  expect(first.code).not.toBe(0);
  const legacy = linesOf(first.stdout).filter((line) =>
    line.includes(": legacy_mark: "),
  );
  for (const head of [
    "a.md:3:",
    "a.md:12:",
    "b.md:3:",
    "b.md:9:",
    "b.md:15:",
  ]) {
    const found = legacy.filter((line) => line.startsWith(head));
    expect(found, head).toHaveLength(1);
    expect(found[0]).toContain("mdmark upgrade");
  }
  // 実行: 移行の手順を当てる
  const upgraded = await runCli(package050, ["upgrade", "--yes"], dir);
  // 検証
  expect(upgraded.code, upgraded.stderr).toBe(0);
  const a = await readFile(join(dir, "a.md"), "utf8");
  const b = await readFile(join(dir, "b.md"), "utf8");
  expect(legacyMarks(a)).toEqual([]);
  expect(legacyMarks(b)).toEqual([]);
  const strip = (text: string) => text.replace(/<!-- [a-z-]+: .*-->/g, "");
  expect(strip(a)).toBe(strip(LEGACY_A));
  expect(strip(b)).toBe(strip(LEGACY_B));
  expect(a).toContain("<!-- /table -->");
  // 実行: 2 回目の点検
  const second = await runCli(package050, ["check"], dir);
  // 検証
  expect(second.code, second.stdout).toBe(0);
  expect(linesOf(second.stdout)).toEqual(["ずれ 0 件"]);
  // 実行: 書き出す
  const afterA = await exportedBody(page, {
    builtRoot: package050,
    tempDir,
    dir,
    doc: "a.md",
    out: "after/a.html",
  });
  const afterB = await exportedBody(page, {
    builtRoot: package050,
    tempDir,
    dir,
    doc: "b.md",
    out: "after/b.html",
  });
  // 検証
  expect(afterA).toBe(beforeA);
  expect(afterB).toBe(beforeB);
  expect(afterA).toContain("mdmark-table-total");
  expect(afterB).toContain("図 1");
});

// 書き出さない記載と拡張のマーカーを移行の報告に挙げ、手で修正した後に点検に合格して描く（正常シナリオ（書き換えない記載を手で修正する））
test("test_normal_when_unconverted", async ({ package050, tempDir, page }) => {
  // 準備
  const dir = await createLegacyDir(tempDir, {
    extra: "extensions: [extensions/greet.js]\n",
    a: [
      "# A",
      "",
      "<!-- table: data total=数量:sum -->",
      "",
      "| 名前 | 数量 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "",
      "<!-- /table -->",
      "",
      "<!-- greet: 世界 -->",
      "",
    ].join("\n"),
  });
  await writeFiles(dir, { "extensions/greet.js": greetSource() });
  // 実行: 移行の手順を当てる
  const upgraded = await runCli(package050, ["upgrade", "--yes"], dir);
  // 検証
  expect(upgraded.code, upgraded.stderr).toBe(0);
  const report = linesOf(upgraded.stdout).map((line) => line.trim());
  expect(
    report.filter(
      (line) =>
        line.startsWith("a.md:3: table: ") && line.includes("total=数量:sum"),
    ),
  ).toHaveLength(1);
  expect(
    report.filter(
      (line) => line.startsWith("a.md:12: greet: ") && line.includes("世界"),
    ),
  ).toHaveLength(1);
  const a = await readFile(join(dir, "a.md"), "utf8");
  expect(a).toContain('<!-- table: {"kind": "data"} -->');
  expect(a).toContain("<!-- greet: 世界 -->");
  // 実行: 手で修正する前の点検
  const before = await runCli(package050, ["check"], dir);
  // 検証
  expect(before.code).not.toBe(0);
  const issues = linesOf(before.stdout).slice(0, -1);
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatch(/^a\.md:12: legacy_mark: /);
  // 実行: 移行の報告に挙がった記載を手で修正する
  await writeFiles(dir, {
    "a.md": a
      .replace(
        '<!-- table: {"kind": "data"} -->',
        '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}]}}} -->',
      )
      .replace("<!-- greet: 世界 -->", '<!-- greet: {"target": "世界"} -->'),
  });
  const after = await runCli(package050, ["check"], dir);
  // 検証
  expect(after.code, after.stdout).toBe(0);
  expect(linesOf(after.stdout)).toEqual(["ずれ 0 件"]);
  await exportedBody(page, {
    builtRoot: package050,
    tempDir,
    dir,
    doc: "a.md",
    out: "after/a.html",
  });
  await expect(page.locator(".mdmark-table-total")).toBeVisible();
  await expect(page.locator("[data-mdmark-slot]")).toHaveText("greet:世界");
});
