import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:net";
import { afterEach, expect, test } from "vitest";

/** ポートの確かめを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPort = () => import("../../../../src/plugin/port.ts");

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
