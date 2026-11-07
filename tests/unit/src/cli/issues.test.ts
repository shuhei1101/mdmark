import { expect, test } from "vitest";

/** ずれを 1 行にする処理を読み込む（ファイルが無いと Vite の解決が失敗してテストファイルごと落ちるため、URL を組んで読む。実装が無い間は各テストが個別に失敗する） */
const loadIssues = (): Promise<
  typeof import("../../../../src/cli/issues.ts")
> =>
  import(
    /* @vite-ignore */ new URL("../../../../src/cli/issues.ts", import.meta.url)
      .href
  );

// where を持つずれは file と where を `:` でつなぐ（正常系）
test("test_format_check_issue", async () => {
  // 準備
  const { formatCheckIssue } = await loadIssues();
  // 実行
  const line = formatCheckIssue({
    file: "mdmark.config.yaml",
    where: "aliases[1].paths",
    kind: "alias_no_files",
    message: "m",
  });
  // 検証
  expect(line).toBe("mdmark.config.yaml:aliases[1].paths: alias_no_files: m");
});

// where が空のずれは file だけを置く（正常系）
test("test_format_check_issue_when_no_where", async () => {
  // 準備
  const { formatCheckIssue } = await loadIssues();
  // 実行
  const line = formatCheckIssue({
    file: "aliases/a.yaml",
    where: "",
    kind: "alias_unreadable",
    message: "m",
  });
  // 検証
  expect(line).toBe("aliases/a.yaml: alias_unreadable: m");
});
