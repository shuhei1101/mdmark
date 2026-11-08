import { afterEach, expect, test, vi } from "vitest";
import { clearGitLocalEnv } from "../git-env.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("test_clear_git_local_env", () => {
  // 準備
  vi.stubEnv("GIT_DIR", "/repo/.git/worktrees/wt");
  vi.stubEnv("GIT_COMMON_DIR", "/repo/.git");
  vi.stubEnv("GIT_INDEX_FILE", "/repo/.git/worktrees/wt/index");
  vi.stubEnv("GIT_AUTHOR_NAME", "author");

  // 実行
  clearGitLocalEnv();

  // 検証
  expect(process.env.GIT_DIR).toBeUndefined();
  expect(process.env.GIT_COMMON_DIR).toBeUndefined();
  expect(process.env.GIT_INDEX_FILE).toBeUndefined();
  expect(process.env.GIT_AUTHOR_NAME).toBe("author");
});
