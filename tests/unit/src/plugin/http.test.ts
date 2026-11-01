import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { McpHttpHandler } from "@modelcontextprotocol/server";
import { afterEach, expect, test, vi } from "vitest";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** HTTP の待ち受けを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHttp = () => import("../../../../src/plugin/http.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const createTempDir = useTempDirs();

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) =>
            server.close(() => resolve()).closeAllConnections(),
          ),
      ),
  );
});

/** 127.0.0.1 の空いているポートを 1 つ得る（得た後に閉じるため、すぐ使う） */
async function findFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

/** 要求を受ける関数で 127.0.0.1 の空いているポートを待ち受けるサーバーを立て、ポートを返す */
async function listen(
  onRequest: (
    req: IncomingMessage,
    res: ServerResponse,
    port: number,
  ) => void | Promise<void>,
): Promise<number> {
  let port = 0;
  const server = createServer((req, res) => {
    void onRequest(req, res, port);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  return port;
}

/** 呼ばれたかを記録し、200 を返す `fetch` を持つハンドラーを作る */
function createHandler(): {
  handler: McpHttpHandler;
  fetch: ReturnType<typeof vi.fn>;
} {
  const fetch = vi.fn(async () => new Response("ok", { status: 200 }));
  return { handler: { fetch } as unknown as McpHttpHandler, fetch };
}

/** 使い方集の索引を持つ、`mdmark serve` を起動したパッケージの直下を作る */
async function createPackageDir(): Promise<string> {
  const packageDir = await createTempDir();
  await writeFiles(packageDir, {
    "plugin/guide/index.json": JSON.stringify({
      schema: 1,
      guides: [
        {
          name: "a",
          when: "a を書くとき",
          summary: "a の概要",
          page: "docs/a.md",
        },
      ],
    }),
    "plugin/guide/docs/a.md": "# ページ A\n",
  });
  return packageDir;
}

// 環境変数が無ければ既定のポート（正常系）
test("test_read_port", async () => {
  // 準備
  const { readPort, DEFAULT_PORT } = await loadHttp();
  // 実行
  const port = readPort({ env: {} });
  // 検証
  expect(port).toBe(DEFAULT_PORT);
});

// 環境変数のポートを使う（正常系）
test("test_read_port_when_overridden", async () => {
  // 準備
  const { readPort } = await loadHttp();
  // 実行
  const port = readPort({ env: { MDMARK_PORT: "18782" } });
  // 検証
  expect(port).toBe(18782);
});

// 整数でない・範囲の外の値を拒む（異常系）
test("test_read_port_when_invalid", async () => {
  // 準備
  const { readPort } = await loadHttp();
  const { CliError } = await loadErrors();
  for (const value of ["abc", "0", "65536", "1.5"]) {
    // 実行・検証
    const read = () => readPort({ env: { MDMARK_PORT: value } });
    expect(read).toThrow(CliError);
    expect(read).toThrow(value);
  }
});

// localhost の /mcp はハンドラーへ渡す（正常系）
test("test_route_request", async () => {
  // 準備
  const { routeRequest } = await loadHttp();
  const { handler, fetch } = createHandler();
  const request = new Request("http://127.0.0.1:8782/mcp", {
    headers: { host: "127.0.0.1:8782" },
  });
  // 実行
  const response = await routeRequest({ request, handler });
  // 検証
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(1);
});

// /mcp 以外は 404（異常系）
test("test_route_request_when_path_unknown", async () => {
  // 準備
  const { routeRequest } = await loadHttp();
  const { handler, fetch } = createHandler();
  const request = new Request("http://127.0.0.1:8782/", {
    headers: { host: "127.0.0.1:8782" },
  });
  // 実行
  const response = await routeRequest({ request, handler });
  // 検証
  expect(response.status).toBe(404);
  expect(fetch).not.toHaveBeenCalled();
});

// localhost でない Host を拒む（異常系）
test("test_route_request_when_host_not_localhost", async () => {
  // 準備
  const { routeRequest } = await loadHttp();
  const { handler, fetch } = createHandler();
  const request = new Request("http://127.0.0.1:8782/mcp", {
    headers: { host: "evil.example:8782" },
  });
  // 実行
  const response = await routeRequest({ request, handler });
  // 検証
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

// localhost でない Origin を拒む（異常系）
test("test_route_request_when_origin_not_localhost", async () => {
  // 準備
  const { routeRequest } = await loadHttp();
  const { handler, fetch } = createHandler();
  const request = new Request("http://127.0.0.1:8782/mcp", {
    headers: { host: "127.0.0.1:8782", origin: "https://evil.example" },
  });
  // 実行
  const response = await routeRequest({ request, handler });
  // 検証
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

// メソッド・パス・ヘッダー・本文を移す（正常系）
test("test_to_request", async () => {
  // 準備
  const { toRequest } = await loadHttp();
  const port = await listen(async (req, res, listening) => {
    const request = toRequest({ req, port: listening });
    res.end(
      JSON.stringify({
        url: request.url,
        contentType: request.headers.get("content-type"),
        body: await request.json(),
      }),
    );
  });
  // 実行
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"a":1}',
  });
  // 検証
  expect(await response.json()).toEqual({
    url: `http://127.0.0.1:${port}/mcp`,
    contentType: "application/json",
    body: { a: 1 },
  });
});

// ステータス・ヘッダー・本文を流す（正常系）
test("test_write_response", async () => {
  // 準備
  const { writeResponse } = await loadHttp();
  const port = await listen(async (_req, res) => {
    await writeResponse({
      response: new Response("ok", { status: 202, headers: { "x-a": "1" } }),
      res,
    });
  });
  // 実行
  const response = await fetch(`http://127.0.0.1:${port}/`);
  // 検証
  expect(response.status).toBe(202);
  expect(response.headers.get("x-a")).toBe("1");
  expect(await response.text()).toBe("ok");
});

// 待ち受けの URL を書き、tools/list に答え、合図で止まる（正常系）
test("test_run_serve", async () => {
  // 準備
  const { runServe } = await loadHttp();
  const packageDir = await createPackageDir();
  const port = await findFreePort();
  const controller = new AbortController();
  const stdout: string[] = [];
  const serving = runServe({
    env: { MDMARK_PORT: String(port) },
    packageDir,
    version: "v0.0.0",
    signal: controller.signal,
    stdout: (line) => stdout.push(line),
    stderr: () => {},
  });
  const url = `http://127.0.0.1:${port}/mcp`;
  await vi.waitFor(() =>
    expect(stdout.some((line) => line.includes(url))).toBe(true),
  );
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  // 実行
  const { tools } = await client.listTools();
  await client.close();
  controller.abort();
  const code = await serving;
  // 検証
  expect(tools).toHaveLength(4);
  expect(code).toBe(0);
  await expect(fetch(url)).rejects.toThrow();
});

// ポートが使われていれば 1 を返す（異常系）
test("test_run_serve_when_port_in_use", async () => {
  // 準備
  const { runServe } = await loadHttp();
  const packageDir = await createPackageDir();
  const port = await listen((_req, res) => {
    res.end();
  });
  const stderr: string[] = [];
  // 実行
  const code = await runServe({
    env: { MDMARK_PORT: String(port) },
    packageDir,
    version: "v0.0.0",
    signal: new AbortController().signal,
    stdout: () => {},
    stderr: (line) => stderr.push(line),
  });
  // 検証
  expect(code).toBe(1);
  const text = stderr.join("\n");
  expect(text).toContain(String(port));
  expect(text).toContain("MDMARK_PORT");
});
