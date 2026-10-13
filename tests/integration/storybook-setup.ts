import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  interface ProvidedContext {
    /** 部品のストーリーを配る Storybook の開発サーバーの URL */
    storybookUrl: string;
  }
}

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");
// 待受の host
const HOST = "127.0.0.1";
// Storybook が応答するまで待つ上限（ミリ秒）と、確かめる間隔
const READY_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 1_000;
// 立てる試行の上限
const START_ATTEMPTS = 3;

/** 空いているポートを、互いに違うものとして count 個返す */
async function findFreePorts(count: number): Promise<number[]> {
  const servers = Array.from({ length: count }, () => createServer());
  // 全て待ち受けてから閉じ、同じポートを返さない
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

/** 子プロセスを自分のプロセスグループで起こし、出力を集める */
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

/** Storybook の索引が 200 を返すまで待つ。子プロセスが先に終わったら出力を添えて失敗する */
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

/** 部品の描画の口と Storybook を空きポートで立て、立った Storybook の URL と止める関数を返す */
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

/** 部品の描画の口と Storybook の開発サーバーを立て、閲覧 URL をテストへ渡す */
export default async function setup(project: TestProject) {
  // 起動に時間がかかる間に他のプロセスがポートを取ることがあるため、立たなければポートを選び直す
  for (let attempt = 1; ; attempt++) {
    try {
      const { url, stopAll } = await startOnce();
      project.provide("storybookUrl", url);
      return stopAll;
    } catch (error) {
      if (attempt >= START_ATTEMPTS) {
        throw error;
      }
    }
  }
}
