import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { stringify } from "yaml";
import {
  DIFF_CONTENTS,
  DIFF_DOC_ID,
  DIFF_PAGE_MARKDOWN,
  DIFF_REVISIONS,
} from "../diff-samples.ts";
import {
  afterSelect,
  beforeSelect,
  diffLines,
  toggleOf,
  waitForDiff,
} from "../diff-ui.ts";
import {
  buildDistRoot,
  mountDiffDocument,
  mountDiffFactory,
  mountDocument,
  openPage,
  readDiffCalls,
  removeDistRoot,
} from "../dist-page.ts";

const execFileAsync = promisify(execFile);

// ページを返す架空のオリジン
const PAGE_ORIGIN = "https://app.example.test";
// YAML の取り出し元のサンプルが読む、jsDelivr の `yaml` の URL
const YAML_URL = "https://cdn.jsdelivr.net/npm/yaml@2.9.1/+esm";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 取り出し元を渡して描くと、差分を開いたときに一覧と 2 つの本文を取り出して差分を出す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: { revisions: DIFF_REVISIONS, contents: DIFF_CONTENTS },
  });
  // 実行
  await toggleOf(page).click();
  await waitForDiff(page);
  // 検証
  const calls = await readDiffCalls(page);
  expect(calls.revisions).toEqual(["guide"]);
  expect(calls.content).toHaveLength(2);
  expect(calls.content).toContainEqual({ docId: "guide", revisionId: "r3" });
  expect(calls.content).toContainEqual({ docId: "guide", revisionId: "r2" });
  const options = await beforeSelect(page).locator("option").allInnerTexts();
  expect(options).toEqual([
    "2026/10/20 11:05 件数を直す（田中）",
    "2026/10/19 16:40 語を直す（鈴木）",
    "2026/10/18 09:12 初版（佐藤）",
  ]);
  await expect(beforeSelect(page)).toHaveValue("r2");
  await expect(afterSelect(page)).toHaveValue("r3");
  await expect(diffLines(page, "del")).toHaveCount(1);
  await expect(diffLines(page, "add")).toHaveCount(1);
});

// 取り出し元を渡さずに描くと、差分を開く UI を付けず、文書を今までどおり描く（正常シナリオ（取り出し元を渡さない））
test("test_normal_when_no_source", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: DIFF_PAGE_MARKDOWN });
  // 検証
  await expect(page.locator("#doc h1")).toBeVisible();
  await expect(page.locator("#doc p")).toHaveText("本文の段落。");
  await expect(toggleOf(page)).toHaveCount(0);
});

/** 文書のファイルを 3 回コミットした Git のリポジトリを作り、その場所を返す */
async function createGitRepo(): Promise<string> {
  const repo = await mkdtemp(join(tmpdir(), "mdmark-e2e-git-"));
  const git = (...args: string[]) =>
    execFileAsync(
      "git",
      ["-c", "user.name=佐藤", "-c", "user.email=sato@example.test", ...args],
      { cwd: repo },
    );
  await git("init", "-q");
  for (const id of ["r1", "r2", "r3"]) {
    await writeFile(join(repo, "guide.md"), DIFF_CONTENTS[id] ?? "");
    await git("add", "guide.md");
    await git("commit", "-q", "-m", `${id} の本文`);
  }
  return repo;
}

// Git のサンプルの取り出し元で、直近の 2 つのコミットの差分を出す（正常シナリオ（Git のサンプル））
test("test_normal_when_git_sample", async ({ page }) => {
  // 準備: 手元のサーバー（Git を呼んで返す）の代わりに、要求を Git の出力で答える
  const repo = await createGitRepo();
  try {
    await openPage(page, builtRoot);
    await page.route(`${PAGE_ORIGIN}/api/history*`, async (route) => {
      const { stdout } = await execFileAsync(
        "git",
        ["log", "--format=%H%x1f%aI%x1f%an%x1f%s", "--", "guide.md"],
        { cwd: repo },
      );
      const revisions = stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [id, at, author, label] = line.split("\x1f");
          return { id, at, author, label };
        });
      await route.fulfill({ json: revisions });
    });
    await page.route(`${PAGE_ORIGIN}/api/file*`, async (route) => {
      const rev = new URL(route.request().url()).searchParams.get("rev") ?? "";
      const { stdout } = await execFileAsync(
        "git",
        ["show", `${rev}:guide.md`],
        {
          cwd: repo,
        },
      );
      await route.fulfill({
        body: stdout,
        contentType: "text/markdown; charset=utf-8",
      });
    });
    await mountDiffFactory(page, {
      markdown: DIFF_PAGE_MARKDOWN,
      docId: DIFF_DOC_ID,
      factory: `{
        async revisions(docId) {
          const res = await fetch("/api/history?doc=" + encodeURIComponent(docId));
          if (!res.ok) throw new Error("履歴を取り出せません (" + res.status + ")");
          return res.json();
        },
        async content({ docId, revisionId }) {
          const res = await fetch("/api/file?doc=" + encodeURIComponent(docId) + "&rev=" + revisionId);
          if (!res.ok) throw new Error("本文を取り出せません (" + res.status + ")");
          return res.text();
        },
      }`,
    });
    // 実行
    await toggleOf(page).click();
    await waitForDiff(page);
    // 検証: 3 つのコミットが新しい順に並び、各項目がコミットの件名と書いた人を持つ
    const options = await beforeSelect(page).locator("option").allInnerTexts();
    expect(options).toHaveLength(3);
    expect(options[0]).toContain("r3 の本文（佐藤）");
    expect(options[2]).toContain("r1 の本文（佐藤）");
    const ids = await beforeSelect(page)
      .locator("option")
      .evaluateAll((all) =>
        all.map((option) => (option as HTMLOptionElement).value),
      );
    expect(ids.every((id) => /^[0-9a-f]{40,64}$/.test(id))).toBe(true);
    // 直近の 2 つのコミット（r2 と r3）の差分: 表のセルの件数
    await expect(diffLines(page, "del")).toHaveCount(1);
    await expect(diffLines(page, "del")).toContainText("120");
    await expect(diffLines(page, "add")).toContainText("150");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

// YAML のサンプルの取り出し元で、項目の変更履歴から差分を出す（正常シナリオ（YAML のサンプル））
test("test_normal_when_yaml_sample", async ({ page }) => {
  // 準備: 変更履歴の YAML と、サンプルが読む `yaml` のモジュールを手元の応答にする
  const yamlText = stringify({
    guide: DIFF_REVISIONS.map((revision) => ({
      ...revision,
      content: DIFF_CONTENTS[revision.id],
    })),
  });
  const bundled = await build({
    entryPoints: ["yaml"],
    bundle: true,
    format: "esm",
    write: false,
    absWorkingDir: process.cwd(),
  });
  await openPage(page, builtRoot);
  await page.route(`${PAGE_ORIGIN}/history.yaml`, (route) =>
    route.fulfill({ body: yamlText, contentType: "text/yaml; charset=utf-8" }),
  );
  await page.route(YAML_URL, (route) =>
    route.fulfill({
      body: bundled.outputFiles[0]?.text ?? "",
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await mountDiffFactory(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    factory: `(() => {
      const importModule = new Function("u", "return import(u)");
      async function history(docId) {
        const { parse } = await importModule(${JSON.stringify(YAML_URL)});
        const res = await fetch("/history.yaml");
        if (!res.ok) throw new Error("変更履歴を取り出せません (" + res.status + ")");
        const items = parse(await res.text())[docId];
        if (!items) throw new Error(docId + " の変更履歴がありません");
        return items;
      }
      return {
        async revisions(docId) {
          return (await history(docId))
            .map(({ id, at, label, author }) => ({ id, at, label, author }))
            .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        },
        async content({ docId, revisionId }) {
          const item = (await history(docId)).find((r) => r.id === revisionId);
          if (!item) throw new Error(revisionId + " がありません");
          return item.content;
        },
      };
    })()`,
  });
  // 実行
  await toggleOf(page).click();
  await waitForDiff(page);
  // 検証: 変更履歴の 3 つが新しい順に並び、一番新しい 2 つの差分に件数の行が出る
  await expect(beforeSelect(page).locator("option")).toHaveCount(3);
  await expect(beforeSelect(page)).toHaveValue("r2");
  await expect(afterSelect(page)).toHaveValue("r3");
  await expect(diffLines(page, "del")).toContainText("120");
  await expect(diffLines(page, "add")).toContainText("150");
});

// リビジョンが 1 つなら本文を取り出さず、比較対象が無いことを知らせる（正常シナリオ（リビジョンが 1 つ））
test("test_normal_when_single_revision", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: { revisions: [DIFF_REVISIONS[2]], contents: DIFF_CONTENTS },
  });
  // 実行
  await toggleOf(page).click();
  // 検証
  await expect(page.locator("#doc")).toContainText(
    "この文書のリビジョンは 1 つだけのため、比較対象のリビジョンがありません。",
  );
  expect((await readDiffCalls(page)).content).toEqual([]);
  await toggleOf(page).click();
  await expect(page.locator("#doc p")).toBeVisible();
});

// `revisions` を返せないときは、差分の場所に知らせの枠を出し、文書は描いたまま残す（異常シナリオ（一覧を取り出せない））
test("test_error_when_revisions_unavailable", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS,
      contents: DIFF_CONTENTS,
      failRevisions: true,
    },
  });
  // 実行
  await toggleOf(page).click();
  // 検証
  const notice = page.locator("#doc .mdmark-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("リビジョンの一覧を取り出せませんでした");
  expect((await readDiffCalls(page)).content).toEqual([]);
  await expect(page.locator("#doc h1")).toBeVisible();
  await toggleOf(page).click();
  await expect(page.locator("#doc p")).toHaveText("本文の段落。");
});

// `content` を返せないリビジョンを選ぶと知らせの枠が出て、選び直すと差分が出る（異常シナリオ（本文を取り出せない））
test("test_error_when_content_unavailable", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDiffDocument(page, {
    markdown: DIFF_PAGE_MARKDOWN,
    docId: DIFF_DOC_ID,
    source: {
      revisions: DIFF_REVISIONS,
      contents: DIFF_CONTENTS,
      failContent: ["r1"],
    },
  });
  await toggleOf(page).click();
  await waitForDiff(page);
  // 実行: 本文を返せない r1 を前に選ぶ
  await beforeSelect(page).selectOption("r1");
  // 検証
  const notice = page.locator("#doc .mdmark-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("初版（佐藤）");
  await expect(page.locator("#doc h1")).toBeVisible();
  // 実行: r2 を選び直す
  await beforeSelect(page).selectOption("r2");
  // 検証
  await expect(notice).toHaveCount(0);
  await waitForDiff(page);
  await expect(diffLines(page, "add")).toHaveCount(1);
});
