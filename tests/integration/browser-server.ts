import { chromium } from "playwright";
import {
  BROWSER_READY_PREFIX,
  CONNECT_TIMEOUT_MS,
  LAUNCH_TIMEOUT_MS,
  WARM_UP_STORIES,
  WARM_UP_TIMEOUT_MS,
} from "./storybook-setup.ts";

// storybook-setup.ts の globalSetup が子プロセスで起動する。Chromium を 1 つ起動して温め、接続先を標準出力へ出し、SIGTERM で閉じる

const storybookUrl = process.argv[2];
if (storybookUrl === undefined) {
  throw new Error("Storybook の URL を引数に指定していない");
}

const server = await chromium.launchServer({
  timeout: LAUNCH_TIMEOUT_MS,
  handleSIGTERM: false,
});
const browser = await chromium.connect(server.wsEndpoint(), {
  timeout: CONNECT_TIMEOUT_MS,
});
try {
  // 最初のストーリーを開いて、Vite が依存をまとめ終えるまで待つ
  const page = await browser.newPage();
  for (const id of WARM_UP_STORIES) {
    await page.goto(`${storybookUrl}/iframe.html?id=${id}&viewMode=story`, {
      timeout: WARM_UP_TIMEOUT_MS,
    });
    await page.waitForFunction(
      () => document.body.classList.contains("sb-show-main"),
      undefined,
      { timeout: WARM_UP_TIMEOUT_MS },
    );
  }
} catch (error) {
  await server.close();
  throw error;
} finally {
  await browser.close();
}
process.stdout.write(`${BROWSER_READY_PREFIX}${server.wsEndpoint()}\n`);
process.on("SIGTERM", () => {
  void server.close().then(() => process.exit(0));
});
