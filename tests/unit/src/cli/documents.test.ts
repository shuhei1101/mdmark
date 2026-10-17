import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 文書を集める処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDocuments = () => import("../../../../src/cli/documents.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

// glob の並びとパスの順に並べ、重なりを除く（正常系）
test("test_collect_build_documents", async () => {
  // 準備
  const { collectBuildDocuments } = await loadDocuments();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "README.md": "# R\n",
    "b/y.md": "# Y\n",
    "a/x.md": "# X\n",
    "a/x.txt": "x\n",
  });
  // 実行
  const paths = await collectBuildDocuments(dir, {
    include: ["README.md", "**/*.md"],
  });
  // 検証
  expect(paths).toEqual(["README.md", "a/x.md", "b/y.md"]);
});

// exclude に当たる文書を外す（正常系）
test("test_collect_build_documents_when_excluded", async () => {
  // 準備
  const { collectBuildDocuments } = await loadDocuments();
  const dir = await createTempDir();
  await writeFiles(dir, { "下書き/メモ.md": "# M\n", "a.md": "# A\n" });
  // 実行
  const paths = await collectBuildDocuments(dir, {
    include: ["**/*.md"],
    exclude: ["下書き/**"],
  });
  // 検証
  expect(paths).toEqual(["a.md"]);
});

// 索引と索引のフォルダの文書を読む（正常系）
test("test_read_index_with_documents", async () => {
  // 準備
  const { readIndexWithDocuments } = await loadDocuments();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "docs/index.yaml": "schema: 1\ndocs: []\n",
    "docs/a.md": "# A\n",
    "docs/sub/b.md": "# B\n",
    "docs/c.txt": "c\n",
  });
  const loaded = {
    path: join(dir, "mdmark.config.yaml"),
    dir,
    config: { index: "docs/index.yaml" },
  };
  // 実行
  const result = await readIndexWithDocuments(loaded);
  // 検証
  expect(result?.indexFile).toBe("docs/index.yaml");
  expect(Object.keys(result?.documents ?? {}).sort()).toEqual([
    "a.md",
    "sub/b.md",
  ]);
});

// 設定に index が無ければ undefined（正常系）
test("test_read_index_with_documents_when_no_index", async () => {
  // 準備
  const { readIndexWithDocuments } = await loadDocuments();
  const dir = await createTempDir();
  const loaded = { path: join(dir, "mdmark.config.yaml"), dir, config: {} };
  // 実行
  const result = await readIndexWithDocuments(loaded);
  // 検証
  expect(result).toBeUndefined();
});

// 索引のファイルが無いと CliError（異常系）
test("test_read_index_with_documents_when_missing", async () => {
  // 準備
  const { readIndexWithDocuments } = await loadDocuments();
  const { CliError } = await loadMain();
  const dir = await createTempDir();
  const loaded = {
    path: join(dir, "mdmark.config.yaml"),
    dir,
    config: { index: "docs/index.yaml" },
  };
  // 実行
  const result = readIndexWithDocuments(loaded);
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("docs/index.yaml");
});

// 索引の題を優先する（正常系）
test("test_document_title", async () => {
  // 準備
  const { documentTitle } = await loadDocuments();
  // 実行
  const title = documentTitle({
    path: "api.md",
    markdown: "# 公開関数\n",
    indexTitle: "API",
  });
  // 検証
  expect(title).toBe("API");
});

// 索引の題が無ければ最初の h1（正常系）
test("test_document_title_when_no_index", async () => {
  // 準備
  const { documentTitle } = await loadDocuments();
  // 実行
  const title = documentTitle({
    path: "使い方/guide.md",
    markdown: "# 使い方\n\n本文\n",
  });
  // 検証
  expect(title).toBe("使い方");
});

// h1 も無ければファイル名（正常系）
test("test_document_title_when_no_heading", async () => {
  // 準備
  const { documentTitle } = await loadDocuments();
  // 実行
  const title = documentTitle({
    path: "使い方/guide.md",
    markdown: "本文だけ\n",
  });
  // 検証
  expect(title).toBe("guide");
});
