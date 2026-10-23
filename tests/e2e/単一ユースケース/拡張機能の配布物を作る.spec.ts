import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { parse } from "yaml";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../../..");
// ワークフローの場所
const WORKFLOW = join(".github", "workflows", "vscode-release.yml");
// コマンドの出力が大きくなっても切れないようにする
const MAX_BUFFER = 64 * 1024 * 1024;
// クローンした直後には無い、複製しないもの
const NOT_IN_CLONE = [
  "node_modules/",
  "dist/",
  "test-results/",
  "playwright-report/",
  ".vitest/",
  "vscode/node_modules/",
  "vscode/dist/",
  "vscode/media/preview.js",
  "vscode/media/preview.css",
  "vscode/out/",
  "vscode/.vscode-test/",
];

/** ワークフローの YAML の、このスペックが使う部分 */
type Workflow = {
  on: { push: { tags: string[] } };
  jobs: {
    release: { steps: Array<{ name?: string; run?: string; uses?: string }> };
  };
};

// 作業ツリーのクローン、`GitHub CLI` の代役を置く場所（最初のテストが作り、後のテストが使う）
let clone = "";
let binDir = "";
let ghLog = "";

// ブラウザも VS Code も使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);
// クローンを使い回すため、定義した順に 1 つずつ流す
test.describe.configure({ mode: "serial" });

/** クローンした直後の作業ツリー（依存と生成物が無い）の複製を一時フォルダに作る */
async function createClone(): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: REPO_ROOT, maxBuffer: MAX_BUFFER },
  );
  const target = await mkdtemp(join(tmpdir(), "mdmark-e2e-release-"));
  const files = stdout
    .split("\0")
    .filter(
      (file) =>
        file !== "" &&
        !NOT_IN_CLONE.some((prefix) => file.startsWith(prefix)) &&
        existsSync(join(REPO_ROOT, file)),
    );
  for (const file of files) {
    await mkdir(dirname(join(target, file)), { recursive: true });
    await cp(join(REPO_ROOT, file), join(target, file));
  }
  return target;
}

/** `gh` の代役: 呼ばれた引数を 1 行ずつ記録する。`gh release view` は「Release が無い」として失敗させる */
async function createGhStub(): Promise<void> {
  binDir = join(clone, "..", `gh-stub-${Date.now()}`);
  ghLog = join(binDir, "gh.log");
  await mkdir(binDir, { recursive: true });
  const script = join(binDir, "gh");
  await writeFile(
    script,
    `#!/bin/sh\necho "$@" >> "${ghLog}"\nif [ "$1" = "release" ] && [ "$2" = "view" ]; then exit 1; fi\n`,
  );
  await chmod(script, 0o755);
}

/** ワークフローの `run` の手順を、GitHub Actions と同じ環境変数で順に流し、止まった手順までの結果を返す。`uses` の手順は流さない */
async function runWorkflow(tag: string): Promise<{
  code: number;
  stderr: string;
  ran: string[];
}> {
  const workflow = parse(
    await readFile(join(clone, WORKFLOW), "utf8"),
  ) as Workflow;
  const ran: string[] = [];
  for (const step of workflow.jobs.release.steps) {
    if (step.run === undefined) {
      continue;
    }
    ran.push(step.name ?? step.run);
    try {
      await execFileAsync("bash", ["-e", "-c", step.run], {
        cwd: clone,
        maxBuffer: MAX_BUFFER,
        env: {
          ...process.env,
          PATH: `${binDir}${delimiter}${process.env.PATH}`,
          GITHUB_REF_NAME: tag,
          GH_TOKEN: "dummy-token",
        },
      });
    } catch (error) {
      const failed = error as { code?: number; stderr?: string };
      return {
        code: typeof failed.code === "number" ? failed.code : -1,
        stderr: failed.stderr ?? "",
        ran,
      };
    }
  }
  return { code: 0, stderr: "", ran };
}

/** 記録した `gh` の呼び出し */
async function ghCalls(): Promise<string[]> {
  return existsSync(ghLog)
    ? (await readFile(ghLog, "utf8")).split("\n").filter(Boolean)
    : [];
}

test.beforeAll(async () => {
  clone = await createClone();
  await createGhStub();
});

test.afterAll(async () => {
  await rm(clone, { recursive: true, force: true });
  await rm(binDir, { recursive: true, force: true });
});

// バージョンが合うタグで、.vsix を作って Release に添え、mdmark 本体のタグでは起きない（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const manifest = JSON.parse(
    await readFile(join(clone, "vscode", "package.json"), "utf8"),
  ) as { version: string };
  expect(manifest.version).toBe("0.1.0");
  const workflow = parse(
    await readFile(join(clone, WORKFLOW), "utf8"),
  ) as Workflow;
  // 実行: `vscode-v0.1.0` のタグで、ワークフローの手順を順に流す
  const result = await runWorkflow("vscode-v0.1.0");
  // 検証
  expect(result.code, result.stderr).toBe(0);
  const vsix = join(clone, "vscode", "mdmark-0.1.0.vsix");
  expect(existsSync(vsix)).toBe(true);
  const calls = await ghCalls();
  expect(calls).toContain("release view vscode-v0.1.0");
  expect(calls).toContain(
    "release create vscode-v0.1.0 --title vscode-v0.1.0 --notes ",
  );
  expect(calls).toContain(
    "release upload vscode-v0.1.0 vscode/mdmark-0.1.0.vsix --clobber",
  );
  // mdmark 本体のタグ `v{版}` では、このワークフローは起きない
  const patterns = workflow.on.push.tags.map(
    (glob) => new RegExp(`^${glob.replaceAll("*", ".*")}$`),
  );
  expect(workflow.on.push.tags).toEqual(["vscode-v*"]);
  expect(patterns.some((pattern) => pattern.test("v0.7.0"))).toBe(false);
  expect(patterns.some((pattern) => pattern.test("vscode-v0.1.0"))).toBe(true);
});

// タグと `vscode/package.json` のバージョンが合わないとき、.vsix を作らず、Release に何も添えない（異常シナリオ（バージョンが合わない））
test("test_error_when_version_mismatch", async () => {
  // 準備
  const vsix = join(clone, "vscode", "mdmark-0.1.0.vsix");
  await rm(vsix, { force: true });
  await rm(ghLog, { force: true });
  // 実行
  const result = await runWorkflow("vscode-v0.2.0");
  // 検証
  expect(result.code).toBe(1);
  expect(result.stderr).toContain("0.2.0");
  expect(result.stderr).toContain("0.1.0");
  expect(result.ran).toHaveLength(1);
  expect(existsSync(vsix)).toBe(false);
  expect(
    (await readdir(join(clone, "vscode"))).filter((name) =>
      name.endsWith(".vsix"),
    ),
  ).toEqual([]);
  expect(await ghCalls()).toEqual([]);
});
