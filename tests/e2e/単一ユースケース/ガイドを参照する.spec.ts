import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { expect, test } from "../cli.ts";
import {
  GUIDE_FILTER,
  REPO_ROOT,
  searchDocs,
  withDevDocs,
} from "../dev-docs.ts";
import { findFreePort, withMcpClient, withServe } from "../plugin.ts";

// ブラウザを使わないため、1 つのブラウザのプロジェクトだけで流す
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "ブラウザを使わないシナリオなので chromium のプロジェクトだけで流す",
);

/** 索引の行 */
type Guide = { name: string; page: string };

// 文書の書き方の使い方集の名前
const WRITING_GUIDE = "writing";

/** このリポジトリの `guide/index.yaml` の使い方集の索引の行を読む */
async function readGuides(): Promise<Guide[]> {
  const index = parse(
    await readFile(join(REPO_ROOT, "guide", "index.yaml"), "utf8"),
  ) as { guides: Guide[] };
  return index.guides;
}

// instructions の動線に沿って、dev-docs から使い方集の一覧と本文を受け取る（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir }) => {
  // 準備
  const guides = await readGuides();
  const writing = guides.find((guide) => guide.name === WRITING_GUIDE);
  // 実行
  const instructions = await withMcpClient({ builtRoot }, async (client) =>
    client.getInstructions(),
  );
  const found = await withDevDocs(await tempDir(), async (client) => ({
    list: await searchDocs(client, { filter: GUIDE_FILTER, fields: ["id"] }),
    page: await searchDocs(client, {
      filter: { field: "id", op: "eq", values: [writing?.page ?? ""] },
      view: "full",
    }),
  }));
  // 検証
  expect(instructions).toContain("search_docs");
  expect(instructions).toContain('source: "mdmark"');
  expect(instructions).toContain("topic:使い方集");
  expect(instructions).toContain("check");
  const ids = found.list.map((item) => item.id);
  for (const guide of guides) {
    expect(ids).toContain(guide.page);
  }
  expect(found.page).toHaveLength(1);
  expect(found.page[0]?.values.body).toBe(
    await readFile(join(REPO_ROOT, writing?.page ?? ""), "utf8"),
  );
});

// dev-docs が無いときは instructions の文で見つからないと分かり、dev-docs の端末の設定を作らない（異常シナリオ（dev-docs が無い））
test("test_error_when_dev_docs_missing", async ({ builtRoot, tempDir }) => {
  // 準備
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
      withMcpClient({ builtRoot, serverUrl: serve.url }, async (client) => ({
        instructions: client.getInstructions(),
        tools: (await client.listTools()).tools.map((tool) => tool.name),
      })),
  );
  // 検証
  expect(result.instructions).toContain("dev-docs が無いので見つかりません");
  expect(result.tools).not.toContain("read_guide");
  expect(existsSync(settings)).toBe(false);
});
