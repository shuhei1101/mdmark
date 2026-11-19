// PoC の確認: VS Code の標準の Markdown のプレビューで、色のテーマと OS の配色を別々に切り替えて SVG の画像を撮る
// 使い方: xvfb-run -a node check-vscode.ts {VS Code の実行ファイル} {色のテーマ: light・dark} {OS の配色: light・dark}
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots");
const code = process.argv[2] as string;
await mkdir(shots, { recursive: true });

const waitFor = async <T>(probe: () => Promise<T | undefined>, timeoutMs: number): Promise<T> => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("timeout");
    await new Promise((done) => setTimeout(done, 500));
  }
};

const THEMES = { light: "Default Light Modern", dark: "Default Dark Modern" } as const;
const result: Record<string, unknown> = {};
let port = 9341 + Math.floor(Math.random() * 500);
for (const theme of [process.argv[3] as "light" | "dark"]) {
  for (const os of [process.argv[4] as "light" | "dark"]) {
    port += 1;
    const userData = await mkdtemp(join(tmpdir(), "poc-vscode-user-"));
    const extensions = await mkdtemp(join(tmpdir(), "poc-vscode-ext-"));
    await mkdir(join(userData, "User"), { recursive: true });
    await writeFile(
      join(userData, "User/settings.json"),
      JSON.stringify({ "workbench.colorTheme": THEMES[theme], "window.autoDetectColorScheme": false, "security.workspace.trust.enabled": false, "workbench.startupEditor": "none", "window.restoreWindows": "none", "chat.disableAIFeatures": true, "workbench.welcomePage.walkthroughs.openOnInstall": false }),
    );
    const child = spawn(
      code,
      [`--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, `--extensions-dir=${extensions}`, "--disable-gpu", "--no-sandbox", "--disable-workspace-trust", ...(os === "dark" ? ["--force-dark-mode"] : []), join(here, "out"), join(here, "out/README.md")],
      // OS の配色は Electron の --force-dark-mode で切り替える
      { stdio: "ignore" },
    );
    try {
      const browser = await waitFor(() => chromium.connectOverCDP(`http://127.0.0.1:${port}`), 60000);
      const page = await waitFor(async () => browser.contexts()[0]?.pages().find((p) => p.url().includes("workbench")), 60000);
      await page.waitForSelector(".monaco-workbench", { timeout: 60000 });
      await page.waitForTimeout(3000);
      const skip = page.getByRole("button", { name: "Continue without Signing In" });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      await page.keyboard.press("Escape");
      await page.keyboard.press("F1");
      await page.keyboard.type("Markdown: Open Preview");
      await page.waitForTimeout(1000);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(6000);
      // プレビューの中身は別のプロセスの iframe で CDP から触れないため、プレビューを送りながら撮る
      const shotsTaken: string[] = [];
      for (let step = 0; step < 6; step += 1) {
        const name = `vscode-${theme}-${os}-${step + 1}.png`;
        await page.screenshot({ path: join(shots, name) });
        shotsTaken.push(name);
        await page.mouse.move(740, 500);
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(800);
      }
      const workbench = await page.evaluate(() => ({ classes: document.body.className.slice(0, 80), osDark: matchMedia("(prefers-color-scheme: dark)").matches }));
      result[`theme=${theme} os=${os}`] = { workbench, shots: shotsTaken };
      await browser.close();
    } finally {
      child.kill();
    }
  }
}
console.log(JSON.stringify(result, null, 1));
