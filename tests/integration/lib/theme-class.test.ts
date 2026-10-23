import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, expect, inject, test } from "vitest";

// ダークとライトの `--mdmark-color-bg` の値
const DARK_BG = "#0d1117";
const LIGHT_BG = "#ffffff";

const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

/** 配布物を配る手元の HTTP サーバーと、ブラウザ */
let server: Server;
let origin: string;
let browser: Browser;

beforeAll(async () => {
  const distDir = join(inject("builtRoot"), "dist");
  server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/") {
      response.writeHead(200, { "Content-Type": CONTENT_TYPES[".html"] });
      response.end(
        '<!doctype html><html><head><link rel="stylesheet" href="/index.css"></head><body><div id="wrap"><div id="el"></div></div></body></html>',
      );
      return;
    }
    const target = normalize(join(distDir, path));
    try {
      const body = await readFile(target);
      response.writeHead(200, {
        "Content-Type":
          CONTENT_TYPES[extname(target)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser.close();
  await new Promise<void>((done) => server.close(() => done()));
});

/** 見本の Markdown を描いたページを開く。`body` の class と OS の配色を先に決める */
async function openMounted(options: {
  bodyClass: string;
  colorScheme: "light" | "dark";
}): Promise<Page> {
  const page = await browser.newPage({ colorScheme: options.colorScheme });
  await page.goto(`${origin}/`);
  // 文字列で渡し、`import()` を Vite の変換に任せない
  await page.evaluate(`(async () => {
    document.body.className = ${JSON.stringify(options.bodyClass)};
    const { mount } = await import(${JSON.stringify(`${origin}/index.js`)});
    mount(document.getElementById("el"), {
      markdown: "# 見出し\\n\\n段落\\n\\n| a | b |\\n| --- | --- |\\n| 1 | 2 |\\n",
    });
  })()`);
  return page;
}

/** 描く先の要素の `--mdmark-color-bg` の計算値 */
function readBackground(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.getElementById("el") as Element)
      .getPropertyValue("--mdmark-color-bg")
      .trim(),
  );
}

// OS の配色がライトでも、祖先の `vscode-dark` でダークの値を当て、class を外すと戻す（正常系）
test("test_normal_when_parent_class_dark", async () => {
  // 準備・実行
  const page = await openMounted({
    bodyClass: "vscode-dark",
    colorScheme: "light",
  });
  try {
    // 検証
    expect(await readBackground(page)).toBe(DARK_BG);
    await page.evaluate(() => {
      document.body.className = "vscode-light";
    });
    expect(await readBackground(page)).toBe(LIGHT_BG);
    await page.evaluate(() => {
      document.body.className = "vscode-high-contrast";
    });
    expect(await readBackground(page)).toBe(DARK_BG);
    await page.evaluate(() => {
      document.body.className =
        "vscode-high-contrast vscode-high-contrast-light";
    });
    expect(await readBackground(page)).toBe(LIGHT_BG);
  } finally {
    await page.close();
  }
});

// OS の配色がダークでも、祖先の `vscode-light` でライトにし、`mdmark-theme-light` は `vscode-dark` に勝つ（正常系）
test("test_normal_when_parent_class_light", async () => {
  // 準備・実行
  const page = await openMounted({
    bodyClass: "vscode-light",
    colorScheme: "dark",
  });
  try {
    // 検証
    expect(await readBackground(page)).toBe(LIGHT_BG);
    await page.evaluate(() => {
      document.body.className = "vscode-dark";
      (document.getElementById("wrap") as Element).className =
        "mdmark-theme-light";
    });
    expect(await readBackground(page)).toBe(LIGHT_BG);
  } finally {
    await page.close();
  }
});

// 祖先の class でダークにしても、印刷では明るい配色にする（正常系）
test("test_normal_when_parent_class_dark_printed", async () => {
  // 準備・実行
  const page = await openMounted({
    bodyClass: "vscode-dark",
    colorScheme: "light",
  });
  try {
    await page.evaluate(() => {
      (document.getElementById("wrap") as Element).className =
        "mdmark-theme-dark";
    });
    expect(await readBackground(page)).toBe(DARK_BG);
    await page.emulateMedia({ media: "print" });
    // 検証
    expect(await readBackground(page)).toBe(LIGHT_BG);
  } finally {
    await page.close();
  }
});
