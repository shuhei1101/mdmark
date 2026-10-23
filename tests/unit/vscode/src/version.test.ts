import { expect, test, vi } from "vitest";

/** 読むバージョンの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadVersion = () => import("../../../../vscode/src/version.ts");

/** 呼ばれたものを記録するログの出力先の代役 */
function createLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** タグ一覧の 1 ページ分の応答を作る */
function tagsResponse(
  names: string[],
  init: { link?: string; status?: number } = {},
): Response {
  const headers = new Headers();
  if (init.link !== undefined) {
    headers.set("Link", init.link);
  }
  return new Response(JSON.stringify(names.map((name) => ({ name }))), {
    status: init.status ?? 200,
    headers,
  });
}

const FIRST_URL = "https://api.github.com/repositories/1/tags?per_page=100";
const SECOND_URL = `${FIRST_URL}&page=2`;

// 文字の並びでなく数で比べ、拡張機能のタグを拾わない（正常系）
test("test_pick_latest_version", async () => {
  // 準備
  const { pickLatestVersion } = await loadVersion();
  // 実行
  const latest = pickLatestVersion([
    "v0.7.0",
    "v0.10.0",
    "v0.6.0",
    "vscode-v0.11.0",
  ]);
  // 検証
  expect(latest).toBe("v0.10.0");
});

// 合うタグが無ければ選ばない（正常系）
test("test_pick_latest_version_when_no_match", async () => {
  // 準備
  const { pickLatestVersion } = await loadVersion();
  // 実行
  const latest = pickLatestVersion(["vscode-v0.1.0", "v1.0", "v1.0.0-rc.1"]);
  // 検証
  expect(latest).toBeUndefined();
});

// `rel="next"` の URL を取る（正常系）
test("test_next_page_url", async () => {
  // 準備
  const { nextPageUrl } = await loadVersion();
  const link = `<${SECOND_URL}>; rel="next", <${FIRST_URL}&page=3>; rel="last"`;
  // 実行
  const next = nextPageUrl(link);
  // 検証
  expect(next).toBe(SECOND_URL);
});

// 最後のページでは次が無い（正常系）
test("test_next_page_url_when_last_page", async () => {
  // 準備
  const { nextPageUrl } = await loadVersion();
  const link = `<${FIRST_URL}&page=1>; rel="prev", <${FIRST_URL}&page=1>; rel="first"`;
  // 実行
  const results = [nextPageUrl(null), nextPageUrl(link)];
  // 検証
  expect(results).toEqual([undefined, undefined]);
});

// 全てのページを読んで最新を選ぶ（正常系）
test("test_fetch_latest_version", async () => {
  // 準備
  const { fetchLatestVersion } = await loadVersion();
  const log = createLog();
  const fetchMock = vi.fn(async (url: string | URL | Request) =>
    String(url) === FIRST_URL
      ? tagsResponse(["v0.7.0", "vscode-v0.11.0"], {
          link: `<${SECOND_URL}>; rel="next"`,
        })
      : tagsResponse(["v0.10.0"]),
  );
  // 実行
  const latest = await fetchLatestVersion({
    url: FIRST_URL,
    timeoutMs: 3000,
    fetch: fetchMock as unknown as typeof fetch,
    log,
  });
  // 検証
  expect(latest).toBe("v0.10.0");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

// 200 以外は取れなかったものとして扱う（正常系）
test("test_fetch_latest_version_when_rate_limited", async () => {
  // 準備
  const { fetchLatestVersion } = await loadVersion();
  const log = createLog();
  const fetchMock = vi.fn(async () => tagsResponse([], { status: 403 }));
  // 実行
  const latest = await fetchLatestVersion({
    url: FIRST_URL,
    timeoutMs: 3000,
    fetch: fetchMock as unknown as typeof fetch,
    log,
  });
  // 検証
  expect(latest).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(log.warn).toHaveBeenCalledTimes(1);
  const logged = JSON.stringify(log.warn.mock.calls[0]);
  expect(logged).toContain(FIRST_URL);
  expect(logged).toContain("403");
});

// 合計の待ちが上限を超えたら打ち切る（正常系）
test("test_fetch_latest_version_when_timeout", async () => {
  // 準備
  const { fetchLatestVersion } = await loadVersion();
  const log = createLog();
  // 中断の合図が来るまで応えず、合図が来たら reject する
  const fetchMock = vi.fn(
    (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        });
      }),
  );
  // 実行
  const latest = await fetchLatestVersion({
    url: FIRST_URL,
    timeoutMs: 50,
    fetch: fetchMock as unknown as typeof fetch,
    log,
  });
  // 検証
  expect(latest).toBeUndefined();
});

// 合うタグが 0 件なら取れなかったものとして扱う（正常系）
test("test_fetch_latest_version_when_no_tag", async () => {
  // 準備
  const { fetchLatestVersion } = await loadVersion();
  const log = createLog();
  const fetchMock = vi.fn(async () => tagsResponse(["vscode-v0.1.0"]));
  // 実行
  const latest = await fetchLatestVersion({
    url: FIRST_URL,
    timeoutMs: 3000,
    fetch: fetchMock as unknown as typeof fetch,
    log,
  });
  // 検証
  expect(latest).toBeUndefined();
});

// latest はタグ一覧の最新を使う（正常系）
test("test_decide_version", async () => {
  // 準備
  const { decideVersion } = await loadVersion();
  const fetchLatest = vi.fn(async () => "v0.10.0");
  // 実行
  const decision = await decideVersion({
    setting: "latest",
    lastVersion: undefined,
    fetchLatest,
    log: createLog(),
  });
  // 検証
  expect(decision).toEqual({
    kind: "decided",
    version: "v0.10.0",
    fetched: true,
  });
});

// 書いたバージョンはそのまま使い、タグ一覧を取らない（正常系）
test("test_decide_version_when_pinned", async () => {
  // 準備
  const { decideVersion } = await loadVersion();
  const fetchLatest = vi.fn(async () => "v0.10.0");
  // 実行
  const decision = await decideVersion({
    setting: "v0.6.0",
    lastVersion: "v0.7.0",
    fetchLatest,
    log: createLog(),
  });
  // 検証
  expect(decision).toEqual({
    kind: "decided",
    version: "v0.6.0",
    fetched: false,
  });
  expect(fetchLatest).not.toHaveBeenCalled();
});

// タグ一覧を取れなければ前回のバージョンを使う（正常系）
test("test_decide_version_when_fetch_failed", async () => {
  // 準備
  const { decideVersion } = await loadVersion();
  const fetchLatest = vi.fn(async () => undefined);
  // 実行
  const decision = await decideVersion({
    setting: "latest",
    lastVersion: "v0.7.0",
    fetchLatest,
    log: createLog(),
  });
  // 検証
  expect(decision).toEqual({
    kind: "decided",
    version: "v0.7.0",
    fetched: false,
  });
});

// タグ一覧も前回のバージョンも無ければ決められない（正常系）
test("test_decide_version_when_undecidable", async () => {
  // 準備
  const { decideVersion } = await loadVersion();
  const fetchLatest = vi.fn(async () => undefined);
  // 実行
  const decision = await decideVersion({
    setting: "latest",
    lastVersion: undefined,
    fetchLatest,
    log: createLog(),
  });
  // 検証
  expect(decision).toEqual({ kind: "undecidable" });
});
