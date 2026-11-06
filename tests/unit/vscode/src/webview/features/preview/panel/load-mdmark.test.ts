import { expect, test, vi } from "vitest";

/** 配布物の読み込みを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLoadMdmark = () =>
  import(
    "../../../../../../../../vscode/src/webview/features/preview/panel/load-mdmark.ts"
  );

// 404 は指定したバージョンが無い（正常系）
test("test_classify_load_failure", async () => {
  // 準備
  const { classifyLoadFailure } = await loadLoadMdmark();
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(null, { status: 404 }),
  );
  // 実行
  const reason = await classifyLoadFailure({
    url: "https://cdn.jsdelivr.net/gh/x/mdmark@v9.9.9/dist/index.js",
    fetch: fetchMock as unknown as typeof fetch,
  });
  // 検証
  expect(reason).toBe("versionMissing");
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });
});

// ネットワークのエラーと 404 以外はオフライン（正常系）
test("test_classify_load_failure_when_network_error", async () => {
  // 準備
  const { classifyLoadFailure } = await loadLoadMdmark();
  const networkError = vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
  const unavailable = vi.fn(async () => new Response(null, { status: 503 }));
  const url = "https://cdn.jsdelivr.net/gh/x/mdmark@v0.10.0/dist/index.js";
  // 実行
  const reasons = [
    await classifyLoadFailure({
      url,
      fetch: networkError as unknown as typeof fetch,
    }),
    await classifyLoadFailure({
      url,
      fetch: unavailable as unknown as typeof fetch,
    }),
  ];
  // 検証
  expect(reasons).toEqual(["offline", "offline"]);
});

// diffModes に blocks があれば対応する（正常系）
test("test_supports_diff_blocks", async () => {
  // 準備
  const { supportsDiffBlocks } = await loadLoadMdmark();
  // 実行・検証
  expect(supportsDiffBlocks({ diffModes: ["button", "open", "blocks"] })).toBe(
    true,
  );
});

// diffModes が無いか blocks を含まなければ対応しない（正常系）
test("test_supports_diff_blocks_when_missing", async () => {
  // 準備
  const { supportsDiffBlocks } = await loadLoadMdmark();
  // 実行・検証
  expect(supportsDiffBlocks({})).toBe(false);
  expect(supportsDiffBlocks({ diffModes: ["button"] })).toBe(false);
  expect(supportsDiffBlocks({ diffModes: "blocks" })).toBe(false);
});
