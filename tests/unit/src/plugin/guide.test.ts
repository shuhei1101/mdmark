import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 使い方集の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadGuide = () => import("../../../../src/plugin/guide.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

/** 索引の行を作る（`page` は `docs/{名前}.md`） */
function createEntry(name: string, overrides: Record<string, string> = {}) {
  return {
    name,
    when: `${name} を書くとき`,
    summary: `${name} の概要`,
    page: `docs/${name}.md`,
    ...overrides,
  };
}

/** 使い方集のフォルダに索引（index.json）と、行が指すページを置く */
async function writeGuide(
  guideDir: string,
  entries: ReturnType<typeof createEntry>[],
  pages: Record<string, string>,
): Promise<void> {
  await writeFiles(guideDir, {
    "index.json": JSON.stringify({ schema: 1, guides: entries }),
    ...pages,
  });
}

// 合う索引の行を全て返す（正常系）
test("test_parse_guide_index", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  const entries = [createEntry("a"), createEntry("b")];
  // 実行
  const result = parseGuideIndex({ schema: 1, guides: entries });
  // 検証
  expect(result.entries).toEqual(entries);
  expect(result.problems).toEqual([]);
});

// 欠けたキーを場所つきで返す（正常系）
test("test_parse_guide_index_when_key_missing", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  const { page: _page, ...withoutPage } = createEntry("b");
  // 実行
  const result = parseGuideIndex({
    schema: 1,
    guides: [createEntry("a"), withoutPage],
  });
  // 検証
  expect(result.entries).toHaveLength(1);
  expect(result.problems.map((problem) => problem.where)).toContain(
    "guides[1].page",
  );
});

// 名前の重なりを返す（正常系）
test("test_parse_guide_index_when_name_duplicated", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  // 実行
  const result = parseGuideIndex({
    schema: 1,
    guides: [createEntry("a"), createEntry("a", { page: "docs/b.md" })],
  });
  // 検証
  expect(result.problems.map((problem) => problem.where)).toContain(
    "guides[1].name",
  );
});

// docs/ の外のページを返す（正常系）
test("test_parse_guide_index_when_page_outside_docs", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  // 実行
  const result = parseGuideIndex({
    schema: 1,
    guides: [createEntry("a", { page: "src/index.ts" })],
  });
  // 検証
  expect(result.problems.map((problem) => problem.where)).toContain(
    "guides[0].page",
  );
});

// オブジェクトでない値を返す（正常系）
test("test_parse_guide_index_when_not_object", async () => {
  // 準備
  const { parseGuideIndex } = await loadGuide();
  // 実行
  const result = parseGuideIndex([]);
  // 検証
  expect(result.entries).toEqual([]);
  expect(result.problems.map((problem) => problem.where)).toContain("");
});

// 同梱した索引の行を返す（正常系）
test("test_read_guide_index", async () => {
  // 準備
  const { readGuideIndex } = await loadGuide();
  const guideDir = await createTempDir();
  const entries = [createEntry("a"), createEntry("b")];
  await writeGuide(guideDir, entries, {});
  // 実行
  const result = await readGuideIndex(guideDir);
  // 検証
  expect(result).toEqual(entries);
});

// 索引が無ければ入れ直しを案内する CliError を投げる（異常系）
test("test_read_guide_index_when_missing", async () => {
  // 準備
  const { readGuideIndex } = await loadGuide();
  const { CliError } = await loadErrors();
  const guideDir = await createTempDir();
  // 実行
  const error = await readGuideIndex(guideDir).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("index.json");
  expect((error as Error).message).toContain("入れ直して");
});

// 形に合わない索引は CliError を投げる（異常系）
test("test_read_guide_index_when_invalid", async () => {
  // 準備
  const { readGuideIndex } = await loadGuide();
  const { CliError } = await loadErrors();
  const guideDir = await createTempDir();
  const { page: _page, ...withoutPage } = createEntry("a");
  await writeFiles(guideDir, {
    "index.json": JSON.stringify({ schema: 1, guides: [withoutPage] }),
  });
  // 実行
  const error = await readGuideIndex(guideDir).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
});

// 先頭の 1 文と全ての名前の表を作る（正常系）
test("test_format_guide_context", async () => {
  // 準備
  const { formatGuideContext, GUIDE_CONTEXT_LEAD } = await loadGuide();
  const entries = [createEntry("a"), createEntry("b")];
  // 実行
  const text = formatGuideContext(entries);
  // 検証
  const lines = text.split("\n");
  expect(lines[0]).toBe(GUIDE_CONTEXT_LEAD);
  const tableLines = lines.filter((line) => line.startsWith("|"));
  // 見出しの行と区切りの行に続けて、行ごとに 1 行
  expect(tableLines).toHaveLength(entries.length + 2);
  expect(tableLines).toContain("| a | a を書くとき | a の概要 |");
  expect(tableLines).toContain("| b | b を書くとき | b の概要 |");
  expect(text).not.toContain("docs/a.md");
  expect(text).not.toContain("docs/b.md");
});

// セルの縦棒を打ち消す（正常系）
test("test_format_guide_context_when_pipe", async () => {
  // 準備
  const { formatGuideContext } = await loadGuide();
  // 実行
  const text = formatGuideContext([createEntry("a", { summary: "a | b" })]);
  // 検証
  expect(text).toContain("a \\| b");
});

// 1 字違いの名前を先頭に返す（正常系）
test("test_nearest_names", async () => {
  // 準備
  const { nearestNames } = await loadGuide();
  // 実行
  const result = nearestNames({
    name: "notatoin",
    names: ["extension", "notation", "diagram"],
    count: 3,
  });
  // 検証
  expect(result[0]).toBe("notation");
});

// 最大の数で切る（正常系）
test("test_nearest_names_when_count_exceeds", async () => {
  // 準備
  const { nearestNames } = await loadGuide();
  // 実行
  const result = nearestNames({
    name: "x",
    names: ["a", "b", "c", "d", "e"],
    count: 3,
  });
  // 検証
  expect(result).toHaveLength(3);
});

// 渡した順に本文を返す（正常系）
test("test_read_guides", async () => {
  // 準備
  const { readGuides } = await loadGuide();
  const guideDir = await createTempDir();
  const entries = [createEntry("a"), createEntry("b")];
  await writeGuide(guideDir, entries, {
    "docs/a.md": "# ページ A\n\n本文 A\n",
    "docs/b.md": "# ページ B\n\n本文 B\n",
  });
  // 実行
  const pages = await readGuides({ guideDir, entries, names: ["b", "a"] });
  // 検証
  expect(pages.map((page) => page.name)).toEqual(["b", "a"]);
  const lines = (pages[0]?.text ?? "").split("\n");
  expect(lines[0]).toBe("# b");
  expect(lines.slice(2).join("\n")).toBe("# ページ B\n\n本文 B\n");
});

// 重なった名前を 1 つにする（正常系）
test("test_read_guides_when_duplicated", async () => {
  // 準備
  const { readGuides } = await loadGuide();
  const guideDir = await createTempDir();
  const entries = [createEntry("a")];
  await writeGuide(guideDir, entries, { "docs/a.md": "# ページ A\n" });
  // 実行
  const pages = await readGuides({ guideDir, entries, names: ["a", "a"] });
  // 検証
  expect(pages).toHaveLength(1);
});

// 索引に無い名前は本文を返さず、近い名前を添えた CliError を投げる（異常系）
test("test_read_guides_when_name_unknown", async () => {
  // 準備
  const { readGuides } = await loadGuide();
  const { CliError } = await loadErrors();
  const guideDir = await createTempDir();
  const entries = [createEntry("notation"), createEntry("extension")];
  await writeGuide(guideDir, entries, {
    "docs/notation.md": "# 記法\n",
    "docs/extension.md": "# 拡張\n",
  });
  // 実行
  const error = await readGuides({
    guideDir,
    entries,
    names: ["notatoin", "extension"],
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).toContain("notatoin");
  expect((error as Error).message).toContain("notation");
});

// 本文の合計が上限を超えると読まず、名前ごとの文字数を添えた CliError を投げる（異常系）
test("test_read_guides_when_too_large", async () => {
  // 準備
  const { readGuides } = await loadGuide();
  const { CliError } = await loadErrors();
  const guideDir = await createTempDir();
  const entries = [createEntry("large-a"), createEntry("large-b")];
  await writeGuide(guideDir, entries, {
    "docs/large-a.md": "あ".repeat(30_000),
    "docs/large-b.md": "あ".repeat(30_000),
  });
  // 実行
  const error = await readGuides({
    guideDir,
    entries,
    names: ["large-a", "large-b"],
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  const message = (error as Error).message;
  // 文字数は本文の分（見出しの数文字を足して数えてもよい）
  expect(message).toMatch(/large-a[\s\S]*30,?0\d{2}/);
  expect(message).toMatch(/large-b[\s\S]*30,?0\d{2}/);
});

// 使い方集のフォルダの外を指すページは読まず CliError を投げる（異常系）
test("test_read_guides_when_page_outside", async () => {
  // 準備
  const { readGuides } = await loadGuide();
  const { CliError } = await loadErrors();
  const dir = await createTempDir();
  const guideDir = join(dir, "guide");
  const entries = [createEntry("a", { page: "docs/../../secret.md" })];
  await writeGuide(guideDir, entries, {});
  await writeFiles(dir, { "secret.md": "秘密\n" });
  // 実行
  const error = await readGuides({
    guideDir,
    entries,
    names: ["a"],
  }).catch((e: unknown) => e);
  // 検証
  expect(error).toBeInstanceOf(CliError);
  expect((error as Error).message).not.toContain("秘密");
});
