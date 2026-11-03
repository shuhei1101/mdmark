import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { expect, runCli, test, writeFiles } from "../cli.ts";
import {
  GUIDE_FILTER,
  REPO_ROOT,
  searchDocs,
  withDevDocs,
} from "../dev-docs.ts";
import {
  callTool,
  findFreePort,
  type Issue,
  indexYaml,
  withMcpClient,
  withServe,
} from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

// 文書の書き方の使い方集のページ
const WRITING_PAGE = "docs/使い方/書く/文書の書き方.md";
// 知らないマーカーを書いた文書
const DOCUMENT_WITH_UNKNOWN_MARK = "# A\n\n<!-- tabz -->\n\n段落\n";
// マーカーを修正した文書
const FIXED_DOCUMENT =
  "# A\n\n<!-- tabs -->\n\n### 1\n\n段落\n\n### 2\n\n段落\n\n<!-- /tabs -->\n";

/** 雛形を置いた後の設定・索引に文書 `a` を載せ、知らないマーカーを書いた `a.md` を書いた作業のフォルダを作る */
async function createProject(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  expect((await runCli(builtRoot, ["init"], dir)).code).toBe(0);
  await writeFiles(dir, {
    "index.yaml": indexYaml(["a"]),
    "a.md": DOCUMENT_WITH_UNKNOWN_MARK,
  });
  return dir;
}

/** このリポジトリの `guide/index.yaml` の使い方集の `page` を並べる */
async function readGuidePages(): Promise<string[]> {
  const index = parse(
    await readFile(join(REPO_ROOT, "guide", "index.yaml"), "utf8"),
  ) as { guides: { page: string }[] };
  return index.guides.map((guide) => guide.page);
}

/** `check` の結果のずれの一覧 */
function issuesOf(texts: string[]): Issue[] {
  return JSON.parse(texts[0] ?? "").issues;
}

// dev-docs で使い方集を参照し、書いた文書を check で点検してずれを 0 件にする（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createProject(builtRoot, tempDir);
  // 実行
  const mdmark = await withMcpClient(
    { builtRoot, projectDir: dir },
    async (client) => {
      const before = await callTool(client, "check");
      await writeFiles(dir, { "a.md": FIXED_DOCUMENT });
      return {
        instructions: client.getInstructions(),
        tools: (await client.listTools()).tools.map((tool) => tool.name),
        before,
        after: await callTool(client, "check"),
      };
    },
  );
  const found = await withDevDocs(await tempDir(), async (client) => ({
    list: await searchDocs(client, { filter: GUIDE_FILTER, fields: ["id"] }),
    page: await searchDocs(client, {
      filter: { field: "id", op: "eq", values: [WRITING_PAGE] },
      view: "full",
    }),
  }));
  // 検証
  expect(mdmark.instructions).toContain("search_docs");
  expect(mdmark.instructions).toContain("topic:使い方集");
  expect(mdmark.instructions).toContain("check");
  const ids = found.list.map((item) => item.id);
  for (const page of await readGuidePages()) {
    expect(ids).toContain(page);
  }
  expect(found.page[0]?.values.body).toBe(
    await readFile(join(REPO_ROOT, WRITING_PAGE), "utf8"),
  );
  expect(mdmark.before.isError).toBe(false);
  const marks = issuesOf(mdmark.before.texts);
  expect(marks).toHaveLength(1);
  expect(marks[0]?.kind).toBe("unknown_mark");
  expect(mdmark.after.isError).toBe(false);
  expect(issuesOf(mdmark.after.texts)).toEqual([]);
  expect(mdmark.tools).not.toContain("read_guide");
});

// dev-docs が無くても instructions から見つからないと分かり、書いた後の check でずれを見つける（異常シナリオ（dev-docs が無い））
test("test_error_when_dev_docs_missing", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await createProject(builtRoot, tempDir);
  const settings = join(await tempDir(), "dev-docs", "settings.yaml");
  // 実行
  const result = await withServe(
    {
      builtRoot,
      env: {
        MDMARK_PORT: String(await findFreePort()),
        DEV_DOCS_CONFIG: settings,
      },
    },
    (serve) =>
      withMcpClient(
        { builtRoot, projectDir: dir, serverUrl: serve.url },
        async (client) => ({
          instructions: client.getInstructions(),
          checked: await callTool(client, "check"),
        }),
      ),
  );
  // 検証
  expect(result.instructions).toContain("dev-docs が無いので見つかりません");
  expect(existsSync(settings)).toBe(false);
  const marks = issuesOf(result.checked.texts);
  expect(marks).toHaveLength(1);
  expect(marks[0]?.kind).toBe("unknown_mark");
});
