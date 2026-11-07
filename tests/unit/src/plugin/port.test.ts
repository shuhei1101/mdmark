import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:net";
import { afterEach, expect, test } from "vitest";

/** ポートの確かめを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPort = () => import("../../../../src/plugin/port.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
});

/** 127.0.0.1 の空いたポートで待ち受け、そのポートを返す */
async function listen(): Promise<number> {
  const server = createServer();
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return (server.address() as AddressInfo).port;
}

/** 空いたポートを取って閉じ、待ち受けていないポートを返す */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

// 待ち受けていれば真（正常系）
test("test_is_port_listening", async () => {
  // 準備
  const { isPortListening } = await loadPort();
  const port = await listen();
  // 実行・検証
  expect(await isPortListening({ port, timeoutMs: 1000 })).toBe(true);
});

// 待ち受けていなければ偽（正常系）
test("test_is_port_listening_when_closed", async () => {
  // 準備
  const { isPortListening } = await loadPort();
  const port = await closedPort();
  // 実行・検証
  expect(await isPortListening({ port, timeoutMs: 1000 })).toBe(false);
});

// 環境変数が無ければ既定のポート（正常系）
test("test_read_port", async () => {
  // 準備
  const { readPort, DEFAULT_PORT } = await loadPort();
  // 実行
  const port = readPort({ env: {} });
  // 検証
  expect(port).toBe(DEFAULT_PORT);
});

// 環境変数のポートを使う（正常系）
test("test_read_port_when_overridden", async () => {
  // 準備
  const { readPort } = await loadPort();
  // 実行
  const port = readPort({ env: { MDMARK_PORT: "18782" } });
  // 検証
  expect(port).toBe(18782);
});

// 整数でない・範囲の外の値を拒む（異常系）
test("test_read_port_when_invalid", async () => {
  // 準備
  const { readPort } = await loadPort();
  const { CliError } = await loadErrors();
  for (const value of ["abc", "0", "65536", "1.5"]) {
    // 実行・検証
    const read = () => readPort({ env: { MDMARK_PORT: value } });
    expect(read).toThrow(CliError);
    expect(read).toThrow(value);
  }
});
