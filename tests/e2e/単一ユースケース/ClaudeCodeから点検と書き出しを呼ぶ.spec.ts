import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  createChangeTogetherDir,
  expect,
  linesOf,
  runCli,
  test,
  writeFiles,
} from "../cli.ts";
import {
  CONFIG_WITH_BUILD,
  callTool,
  DOCUMENTS,
  type Issue,
  indexYaml,
  issueLine,
  withMcpClient,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** ずれの無い作業のフォルダ: 設定・索引と文書 2 つ。索引に 2 つとも載り、`build` が 2 つに当たる */
async function writeCleanProject(dir: string): Promise<void> {
  await writeFiles(dir, {
    "mdmark.config.yaml": CONFIG_WITH_BUILD,
    "index.yaml": indexYaml(["a", "b"]),
    ...DOCUMENTS,
  });
}

/** 設定・索引・文書のファイルの中身を並べて読む */
async function snapshot(dir: string): Promise<string[]> {
  return Promise.all(
    ["mdmark.config.yaml", "index.yaml", "a.md", "b.md"].map((file) =>
      readFile(join(dir, file), "utf8"),
    ),
  );
}

// check がずれ 0 件を返し、build_site が 1 枚の HTML を書く（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  const cliDir = await tempDir();
  await writeCleanProject(dir);
  await writeCleanProject(cliDir);
  // 実行
  const { checked, built } = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    async (client) => ({
      checked: await callTool(client, "check"),
      built: await callTool(client, "build_site"),
    }),
  );
  // 検証
  expect(checked.isError).toBe(false);
  expect(JSON.parse(checked.texts[0] ?? "")).toEqual({ issues: [] });
  expect(built.isError).toBe(false);
  const json = JSON.parse(built.texts[0] ?? "");
  expect(json.out).toBe(join(dir, "dist", "docs.html"));
  expect(json.docs).toBe(2);
  // 同じフォルダで mdmark build を流して書いた HTML と同じ
  expect((await runCli(builtRoot, ["build"], cliDir)).code).toBe(0);
  expect(await readFile(json.out, "utf8")).toBe(
    await readFile(join(cliDir, "dist", "docs.html"), "utf8"),
  );
});

// 文書 1 つを消して索引に残すと、missing_doc を含むずれが mdmark check と同じに返る（正常シナリオ）
test("test_normal_when_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeCleanProject(dir);
  await rm(join(dir, "b.md"));
  const before = [
    await readFile(join(dir, "mdmark.config.yaml"), "utf8"),
    await readFile(join(dir, "index.yaml"), "utf8"),
    await readFile(join(dir, "a.md"), "utf8"),
  ];
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "check"),
  );
  // 検証
  expect(result.isError).toBe(false);
  const issues = JSON.parse(result.texts[0] ?? "").issues as Issue[];
  const missing = issues.filter((issue) => issue.kind === "missing_doc");
  expect(missing).toHaveLength(1);
  expect(missing[0]?.file).toBe("index.yaml");
  for (const issue of issues) {
    expect(issue.file).not.toBe("");
    expect(issue.message).not.toBe("");
  }
  const cli = await runCli(builtRoot, ["check"], dir);
  expect(linesOf(cli.stdout).slice(0, -1)).toEqual(issues.map(issueLine));
  expect([
    await readFile(join(dir, "mdmark.config.yaml"), "utf8"),
    await readFile(join(dir, "index.yaml"), "utf8"),
    await readFile(join(dir, "a.md"), "utf8"),
  ]).toEqual(before);
});

// export_html が 1 枚の HTML を書き、mdmark export と同じ中身になる（正常シナリオ）
test("test_normal_when_single_document", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  const cliDir = await tempDir();
  await writeCleanProject(dir);
  await writeCleanProject(cliDir);
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "export_html", { file: "a.md" }),
  );
  // 検証
  expect(result.isError).toBe(false);
  const json = JSON.parse(result.texts[0] ?? "");
  expect(json.out).toBe(join(dir, "a.html"));
  expect(existsSync(json.out)).toBe(true);
  expect((await runCli(builtRoot, ["export", "a.md"], cliDir)).code).toBe(0);
  expect(await readFile(json.out, "utf8")).toBe(
    await readFile(join(cliDir, "a.html"), "utf8"),
  );
  expect((await snapshot(dir)).length).toBe(4);
});

// 設定ファイルが無いと、無いことと mdmark init で置けることを返す（異常シナリオ）
test("test_error_when_config_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, DOCUMENTS);
  // 実行
  const result = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "check"),
  );
  // 検証
  expect(result.isError).toBe(true);
  expect(result.texts[0]).toContain("mdmark.config.yaml");
  expect(result.texts[0]).toContain("mdmark init");
});

// 基準を渡すと、片方だけが変わった change_together の直し忘れが mdmark check --base と同じに返る（正常シナリオ（比べる基準を渡す））
test("test_normal_when_base_given", async ({ builtRoot, tempDir }) => {
  // 準備
  const { dir, base } = await createChangeTogetherDir(builtRoot, tempDir);
  const files = ["mdmark.config.yaml", "index.yaml", "a.md", "b.md"];
  const before = await Promise.all(
    files.map((file) => readFile(join(dir, file), "utf8")),
  );
  // 実行
  const checked = await withMcpClient(
    { pluginDir: join(builtRoot, "plugin"), projectDir: dir },
    (client) => callTool(client, "check", { base }),
  );
  const cli = await runCli(builtRoot, ["check", "--base", base], dir);
  // 検証
  expect(checked.isError).toBe(false);
  const issues = JSON.parse(checked.texts[0] ?? "").issues as Issue[];
  // 変わっていない 2 つ目の文書を指す直し忘れの行が 1 件
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    file: "b.md",
    where: "",
    kind: "missed_change_together",
  });
  // 同じフォルダ・同じ基準で mdmark check を流したときと同じずれ
  expect(linesOf(cli.stdout).slice(0, -1)).toEqual(issues.map(issueLine));
  expect(
    await Promise.all(files.map((file) => readFile(join(dir, file), "utf8"))),
  ).toEqual(before);
});
