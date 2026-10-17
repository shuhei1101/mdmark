import { join } from "node:path";
import { expect, test } from "vitest";
import {
  CLEAN_INDEX,
  createIo,
  useTempDirs,
  writeFiles,
} from "../../helpers/cli.ts";

/** 点検の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/cli/check.ts");

const createTempDir = useTempDirs();

/** build の設定を `lines` で書き換えられる、ずれの無いフォルダを作る */
async function createCleanDir(options?: {
  buildLines?: string[];
  extraDocs?: string;
}): Promise<string> {
  const dir = await createTempDir();
  const buildLines = options?.buildLines ?? [
    '  include: ["docs/*.md"]',
    "  out: dist/docs.html",
  ];
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "index: docs/index.yaml",
      "build:",
      ...buildLines,
      "",
    ].join("\n"),
    "docs/index.yaml": options?.extraDocs
      ? `${CLEAN_INDEX}${options.extraDocs}`
      : CLEAN_INDEX,
    "docs/a.md": "# A\n",
    "docs/b.md": "# B\n",
  });
  return dir;
}

// ずれの無いフォルダで 0 件（正常系）
test("test_run_check", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir();
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(0);
  expect(stdout).toEqual(["ずれ 0 件"]);
});

// 設定の schema と索引の missing_doc をこの順に出す（正常系）
test("test_run_check_when_drift", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: ['  include: ["docs/*.md"]'],
    extraDocs: "  - id: old\n    path: old.md\n    title: Old\n",
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(stdout).toHaveLength(3);
  expect(stdout[0]).toMatch(/^mdmark\.config\.yaml:build: schema: /);
  expect(stdout[0]).toContain("build.out");
  expect(stdout[1]).toMatch(
    /^docs\/index\.yaml:docs\[2\]\.path: missing_doc: /,
  );
  expect(stdout[1]).toContain("old.md");
  expect(stdout[2]).toBe("ずれ 2 件");
});

// build の対象が 0 件なら no_documents（正常系）
test("test_run_check_when_no_documents", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: ['  include: ["nothing/**/*.md"]', "  out: dist/docs.html"],
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(
    stdout.some((line) =>
      line.startsWith("mdmark.config.yaml:build.include: no_documents:"),
    ),
  ).toBe(true);
});

// まとめる文書に当たらない build.entry を schema のずれにする（正常系）
test("test_run_check_when_entry_outside", async () => {
  // 準備
  const { runCheck } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: [
      '  include: ["docs/*.md"]',
      "  entry: missing.md",
      "  out: dist/docs.html",
    ],
  });
  const { io, stdout } = createIo(dir);
  // 実行
  const code = await runCheck({}, io);
  // 検証
  expect(code).toBe(1);
  expect(
    stdout.some((line) =>
      line.startsWith("mdmark.config.yaml:build.entry: schema:"),
    ),
  ).toBe(true);
});

// 設定の schema と索引の missing_doc をこの順に返す（正常系）
test("test_collect_check_issues", async () => {
  // 準備
  const { collectCheckIssues } = await loadCheck();
  const dir = await createCleanDir({
    buildLines: ['  include: ["docs/*.md"]'],
    extraDocs: "  - id: old\n    path: old.md\n    title: Old\n",
  });
  // 実行
  const issues = await collectCheckIssues(join(dir, "mdmark.config.yaml"));
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual(["schema", "missing_doc"]);
});
