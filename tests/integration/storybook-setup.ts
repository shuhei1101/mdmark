import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    /** 部品のストーリーを配る Storybook の開発サーバーの URL */
    storybookUrl: string;
    /** 各ファイルが接続する、プロジェクトで 1 つ起動した Chromium の WebSocket の URL */
    browserWsEndpoint: string;
  }
}

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");
// 待受の host
const HOST = "127.0.0.1";
// Storybook が応答するまで待つ上限（ミリ秒）と、確認する間隔
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1_000;
// 起動する試行の上限
const START_ATTEMPTS = 3;
/** 共有の Chromium への接続を待つ上限（ミリ秒。結合テストの全件の実行で測った接続 62 回の p99.9 の 33 ミリ秒に、その 50% の余裕を足した） */
export const CONNECT_TIMEOUT_MS = 50;
/** Chromium の起動を待つ上限（ミリ秒。測った起動 12 回（結合テストの全件の実行の中の 2 回を含む）の p99.9 の 46 ミリ秒に、その 50% の余裕を足した） */
export const LAUNCH_TIMEOUT_MS = 69;
/** 最初のストーリーを開いて、Vite が依存をまとめ終えるまで待つ上限（ミリ秒。測った起動の直後の読み込み 56 秒の約 5 倍） */
export const WARM_UP_TIMEOUT_MS = 300_000;
/** 温めに開くストーリー（React の部品と、部品の HTML の描画のインターフェースの両方を経由する） */
export const WARM_UP_STORIES = [
  "vscode-previewstatus--offline",
  "parts-notice--block",
];
/** browser-server.ts が温めを終えて標準出力へ出す、接続先の行の先頭 */
export const BROWSER_READY_PREFIX = "browser-ws-endpoint:";
// browser-server.ts が接続先を出すまで待つ上限（起動・接続と、温めのストーリーごとの読み込みと描画の待ちの合計に、その 50% の余裕を足した）
const BROWSER_READY_TIMEOUT_MS =
  (LAUNCH_TIMEOUT_MS +
    CONNECT_TIMEOUT_MS +
    WARM_UP_STORIES.length * 2 * WARM_UP_TIMEOUT_MS) *
  1.5;

/** 空いているポートを、互いに違うものとして count 個返す */
async function findFreePorts(count: number): Promise<number[]> {
  const servers = Array.from({ length: count }, () => createServer());
  // 全て待ち受けてから閉じ、同じポートを返却しない
  await Promise.all(
    servers.map(
      (server) => new Promise<void>((done) => server.listen(0, HOST, done)),
    ),
  );
  const ports = servers.map((server) => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("空いているポートを取れなかった");
    }
    return address.port;
  });
  await Promise.all(
    servers.map(
      (server) => new Promise<void>((done) => server.close(() => done())),
    ),
  );
  return ports;
}

/** 子プロセスを自分のプロセスグループで発生させ、出力を集める */
function start(
  command: string,
  args: string[],
  env: Record<string, string>,
): { child: ChildProcess; output: () => string } {
  const chunks: string[] = [];
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (data) => chunks.push(String(data)));
  child.stderr?.on("data", (data) => chunks.push(String(data)));
  return { child, output: () => chunks.join("") };
}

/** 子プロセスをプロセスグループごと止める */
function stop(child: ChildProcess): void {
  if (child.pid !== undefined && child.exitCode === null) {
    process.kill(-child.pid);
  }
}

/** Storybook の索引が 200 を返却するまで待つ。子プロセスが先に終わったら出力を添えて失敗する */
async function waitUntilReady(
  url: string,
  storybook: { child: ChildProcess; output: () => string },
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (storybook.child.exitCode !== null) {
      throw new Error(`Storybook が終了した:\n${storybook.output()}`);
    }
    const ready = await fetch(`${url}/index.json`).then(
      (response) => response.ok,
      () => false,
    );
    if (ready) {
      return;
    }
    await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  throw new Error(`Storybook が時間内に立たなかった:\n${storybook.output()}`);
}

/** 部品の描画のインターフェースと Storybook を空きポートで起動し、立った Storybook の URL と止める関数を返却する */
async function startOnce(): Promise<{ url: string; stopAll: () => void }> {
  const [renderPort, storybookPort] = await findFreePorts(2);
  const url = `http://${HOST}:${storybookPort}`;
  const render = start(process.execPath, ["scripts/storybook-render.ts"], {
    RENDER_PORT: String(renderPort),
  });
  const storybook = start(
    "npx",
    [
      "storybook",
      "dev",
      "--ci",
      "--no-open",
      "--host",
      HOST,
      "--exact-port",
      "-p",
      String(storybookPort),
    ],
    { RENDER_ORIGIN: `http://${HOST}:${renderPort}` },
  );
  const stopAll = () => {
    stop(storybook.child);
    stop(render.child);
  };
  try {
    await waitUntilReady(url, storybook);
  } catch (error) {
    stopAll();
    throw error;
  }
  return { url, stopAll };
}

/** 部品の描画のインターフェースと Storybook の開発サーバーを起動し、閲覧 URL と止める関数を返却する */
async function startStorybook(): Promise<{ url: string; stopAll: () => void }> {
  // 起動に時間がかかる間に他のプロセスがポートを取ることがあるため、立たなければポートをもう一度選ぶ
  for (let attempt = 1; ; attempt++) {
    try {
      return await startOnce();
    } catch (error) {
      if (attempt >= START_ATTEMPTS) {
        throw error;
      }
    }
  }
}

/** Chromium を 1 つ起動して温める子プロセスを起動し、接続先と止める関数を返却する。子プロセスが先に終わったら出力を添えて失敗する */
async function startBrowserServer(
  storybookUrl: string,
): Promise<{ wsEndpoint: string; stop: () => void }> {
  // Vitest が読み込んだ globalSetup の中で Playwright を呼ぶと、Playwright が取るスタックトレースを vite の module runner が読めずに失敗するため、別のプロセスで起動する
  const server = start(
    process.execPath,
    ["tests/integration/browser-server.ts", storybookUrl],
    {},
  );
  const deadline = Date.now() + BROWSER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const line = server
      .output()
      .split("\n")
      .find((text) => text.startsWith(BROWSER_READY_PREFIX));
    if (line !== undefined) {
      return {
        wsEndpoint: line.slice(BROWSER_READY_PREFIX.length),
        stop: () => stop(server.child),
      };
    }
    if (server.child.exitCode !== null) {
      throw new Error(`Chromium の起動が終了した:\n${server.output()}`);
    }
    await new Promise((done) => setTimeout(done, POLL_INTERVAL_MS));
  }
  stop(server.child);
  throw new Error(`Chromium が時間内に立たなかった:\n${server.output()}`);
}

/** Storybook と、各ファイルが接続する Chromium を 1 つ起動して温め、閲覧 URL と接続先をテストへ指定する */
export default async function setup(project: TestProject) {
  const { url, stopAll } = await startStorybook();
  const browser = await startBrowserServer(url).catch((error: unknown) => {
    stopAll();
    throw error;
  });
  project.provide("storybookUrl", url);
  project.provide("browserWsEndpoint", browser.wsEndpoint);
  return () => {
    browser.stop();
    stopAll();
  };
}
