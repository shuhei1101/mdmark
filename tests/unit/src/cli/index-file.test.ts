import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse, parseDocument } from "yaml";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 索引のファイルの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIndexFile = () => import("../../../../src/cli/index-file.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

/** 文書 `a` だけを載せた索引の中身 */
const INDEX_A = [
  "schema: 1",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: A",
  "",
].join("\n");

/** 読んだ設定を作る */
function createLoaded(dir: string, config: Record<string, unknown>) {
  return { path: join(dir, "mdmark.config.yaml"), dir, config };
}

/** 索引と設定ファイルを置いたフォルダを作り、読んだ設定を返す */
async function createIndexProject(index: string) {
  const dir = await createTempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": index,
  });
  return { dir, loaded: createLoaded(dir, { index: "index.yaml" }) };
}

/** フォルダの直下のファイル名を並べる */
async function listFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).sort();
}

// 索引と文書を返す（正常系）
test("test_require_index_with_documents", async () => {
  // 準備
  const { requireIndexWithDocuments } = await loadIndexFile();
  const { dir, loaded } = await createIndexProject(INDEX_A);
  await writeFiles(dir, { "a.md": "# A\n" });
  // 実行
  const result = await requireIndexWithDocuments(loaded);
  // 検証
  expect(result.indexFile).toBe("index.yaml");
  expect(Object.keys(result.documents)).toHaveLength(1);
});

// 設定に index が無ければ CliError（異常系）
test("test_require_index_with_documents_when_index_missing", async () => {
  // 準備
  const { requireIndexWithDocuments } = await loadIndexFile();
  const { CliError } = await loadErrors();
  const dir = await createTempDir();
  // 実行
  const result = requireIndexWithDocuments(createLoaded(dir, {}));
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("index");
});

// 無い ID を末尾に足す（正常系）
test("test_apply_index_update", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(INDEX_A);
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "doc",
    id: "b",
    item: { path: "b.md", title: "B" },
  });
  // 検証
  expect(result.action).toBe("added");
  expect(result.problems).toEqual([]);
  const docs = document.toJS().docs as { id: string }[];
  expect(docs.map((doc) => doc.id)).toEqual(["a", "b"]);
});

// ある ID を置き換え、他の要素のコメントを残す（正常系）
test("test_apply_index_update_when_replaced", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(
    [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "  # b の上のコメント",
      "  - id: b",
      "    path: b.md",
      "    title: B",
      "",
    ].join("\n"),
  );
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "doc",
    id: "a",
    item: { path: "a.md", title: "A2" },
  });
  // 検証
  expect(result.action).toBe("replaced");
  const docs = document.toJS().docs as { id: string; title: string }[];
  expect(docs[0]?.title).toBe("A2");
  expect(document.toString()).toContain("# b の上のコメント");
});

// item が null なら消す（正常系）
test("test_apply_index_update_when_removed", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(
    [
      "schema: 1",
      "docs:",
      "  - id: a",
      "    path: a.md",
      "    title: A",
      "  - id: old",
      "    path: old.md",
      "    title: Old",
      "",
    ].join("\n"),
  );
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "doc",
    id: "old",
    item: null,
  });
  // 検証
  expect(result.action).toBe("removed");
  const docs = document.toJS().docs as { id: string }[];
  expect(docs.map((doc) => doc.id)).toEqual(["a"]);
});

// terms が無い索引に用語を足す（正常系）
test("test_apply_index_update_when_terms_absent", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(INDEX_A);
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "term",
    id: "ws",
    item: { term: "ワークスペース", meaning: "話し合いの記録を置くフォルダ" },
  });
  // 検証
  expect(result.action).toBe("added");
  expect(document.toJS().terms).toHaveLength(1);
});

// tags が無い索引にタグを name を鍵にして足す（正常系）
test("test_apply_index_update_when_tag", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(INDEX_A);
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "tag",
    id: "topic:mcp",
    item: { group: "topic" },
  });
  // 検証
  expect(result.action).toBe("added");
  expect(result.problems).toEqual([]);
  expect(document.toJS().tags).toEqual([{ name: "topic:mcp", group: "topic" }]);
});

// 最後のタグを消すと tags のキーも消す（正常系）
test("test_apply_index_update_when_last_tag_removed", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(`${INDEX_A}tags:\n  - name: topic:mcp\n`);
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "tag",
    id: "topic:mcp",
    item: null,
  });
  // 検証
  expect(result.action).toBe("removed");
  expect("tags" in document.toJS()).toBe(false);
});

// 形に合わない項目は合わないところを返す（正常系）
test("test_apply_index_update_when_schema_invalid", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const document = parseDocument(INDEX_A);
  // 実行
  const result = applyIndexUpdate({
    document,
    kind: "doc",
    id: "b",
    item: { title: "文書 B" },
  });
  // 検証
  expect(result.problems.map((problem) => problem.where)).toContain(
    "docs[1].path",
  );
});

// 無い ID を消そうとすると CliError（異常系）
test("test_apply_index_update_when_item_missing", async () => {
  // 準備
  const { applyIndexUpdate } = await loadIndexFile();
  const { CliError } = await loadErrors();
  const document = parseDocument(INDEX_A);
  // 実行
  const run = () =>
    applyIndexUpdate({ document, kind: "doc", id: "z", item: null });
  // 検証
  expect(run).toThrow(CliError);
  expect(run).toThrow("z");
  expect(run).toThrow("docs");
});

// 足して置き換え、ロックと一時ファイルを残さない（正常系）
test("test_update_index_file", async () => {
  // 準備
  const { updateIndexFile } = await loadIndexFile();
  const { dir, loaded } = await createIndexProject(INDEX_A);
  // 実行
  const result = await updateIndexFile({
    loaded,
    kind: "doc",
    id: "b",
    item: { path: "b.md", title: "B" },
  });
  // 検証
  expect(result).toEqual({ action: "added", index: "index.yaml" });
  const index = parse(await readFile(join(dir, "index.yaml"), "utf8"));
  expect(index.docs.map((doc: { id: string }) => doc.id)).toEqual(["a", "b"]);
  expect(await listFiles(dir)).toEqual(["index.yaml", "mdmark.config.yaml"]);
});

// ロックが残っていると待ってから CliError（異常系）
test("test_update_index_file_when_locked", async () => {
  // 準備
  const { updateIndexFile } = await loadIndexFile();
  const { CliError } = await loadErrors();
  const { dir, loaded } = await createIndexProject(INDEX_A);
  await writeFile(join(dir, "index.yaml.lock"), "locked\n");
  // 実行
  const error = await updateIndexFile({
    loaded,
    kind: "doc",
    id: "b",
    item: { path: "b.md", title: "B" },
    lockTimeoutMs: 100,
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("index.yaml.lock");
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(INDEX_A);
  expect(await readFile(join(dir, "index.yaml.lock"), "utf8")).toBe("locked\n");
});

// 合わないときは書かずに CliError（異常系）
test("test_update_index_file_when_schema_invalid", async () => {
  // 準備
  const { updateIndexFile } = await loadIndexFile();
  const { CliError } = await loadErrors();
  const { dir, loaded } = await createIndexProject(INDEX_A);
  // 実行
  const error = await updateIndexFile({
    loaded,
    kind: "doc",
    id: "b",
    item: { title: "文書 B" },
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("docs[1].path");
  expect(await readFile(join(dir, "index.yaml"), "utf8")).toBe(INDEX_A);
  expect(await listFiles(dir)).toEqual(["index.yaml", "mdmark.config.yaml"]);
});

// YAML として読めない索引は CliError で、ロックを残さない（異常系）
test("test_update_index_file_when_unreadable", async () => {
  // 準備
  const { updateIndexFile } = await loadIndexFile();
  const { CliError } = await loadErrors();
  const { dir, loaded } = await createIndexProject(
    "docs:\n  - id: a\n   path: a.md\n",
  );
  // 実行
  const error = await updateIndexFile({
    loaded,
    kind: "doc",
    id: "b",
    item: { path: "b.md", title: "B" },
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect(await listFiles(dir)).toEqual(["index.yaml", "mdmark.config.yaml"]);
});

// 設定に index が無ければ CliError（異常系）
test("test_update_index_file_when_index_missing", async () => {
  // 準備
  const { updateIndexFile } = await loadIndexFile();
  const { CliError } = await loadErrors();
  const dir = await createTempDir();
  // 実行
  const error = await updateIndexFile({
    loaded: createLoaded(dir, {}),
    kind: "doc",
    id: "b",
    item: { path: "b.md", title: "B" },
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
});
