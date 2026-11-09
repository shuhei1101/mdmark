import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { type BrowserServer, chromium } from "playwright";
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
/** 最初のストーリーを開いて、Vite が依存をまとめ終えるまで待つ上限（ミリ秒。測った起動の直後の読み込み 56 秒の約 5 倍） */
const WARM_UP_TIMEOUT_MS = 300_000;
// 温めに開くストーリー（React の部品と、部品の HTML の描画のインターフェースの両方を経由する）
const WARM_UP_STORIES = [
  "vscode-previewstatus--offline",
  "parts-notice--block",
];

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

/** 共有する Chromium でストーリーを開き、Vite が依存をまとめ終えるまで待つ */
async function warmUp(server: BrowserServer, url: string): Promise<void> {
  const browser = await chromium.connect(server.wsEndpoint(), {
    timeout: CONNECT_TIMEOUT_MS,
  });
  try {
    const page = await browser.newPage();
    for (const id of WARM_UP_STORIES) {
      await page.goto(`${url}/iframe.html?id=${id}&viewMode=story`, {
        timeout: WARM_UP_TIMEOUT_MS,
      });
      await page.waitForFunction(
        () => document.body.classList.contains("sb-show-main"),
        undefined,
        { timeout: WARM_UP_TIMEOUT_MS },
      );
    }
  } finally {
    await browser.close();
  }
}

/** Storybook と、各ファイルが接続する Chromium を 1 つ起動して温め、閲覧 URL と接続先をテストへ指定する */
export default async function setup(project: TestProject) {
  const { url, stopAll } = await startStorybook();
  const server = await chromium.launchServer().catch((error: unknown) => {
    stopAll();
    throw error;
  });
  try {
    await warmUp(server, url);
  } catch (error) {
    await server.close();
    stopAll();
    throw error;
  }
  project.provide("storybookUrl", url);
  project.provide("browserWsEndpoint", server.wsEndpoint());
  return async () => {
    await server.close();
    stopAll();
  };
}
