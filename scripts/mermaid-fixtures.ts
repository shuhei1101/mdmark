// mermaid の見本の SVG を書く: Playwright の Chromium で、mermaid の図のモックと同じソースを mermaid で描き、`tests/fixtures/mermaid-svg/` に書く。
// mermaid のバージョンを変えたときに `npm run fixtures:mermaid` で流し、書いたファイルを commit する。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

/** リポジトリの直下 */
const REPO_ROOT = resolve(import.meta.dirname, "..");

/** 見本の SVG を書くフォルダ（リポジトリの直下から） */
const FIXTURES_DIR = "tests/fixtures/mermaid-svg";

/** ソースを取るモック（リポジトリの直下から） */
const MOCK_FILE = "dev/mock/components/mermaid-diagram/index.html";

/** ページを開く名前（`page.route` が中身を返す） */
const ORIGIN = "http://mermaid-fixtures.local";

/** モックの `pre[data-mock-mermaid]` の順番から、見本の名前を引く（案 B のシーケンス図と解釈できないソースは使わない） */
const FIXTURE_NAMES: Record<number, string> = {
  0: "flowchart",
  1: "sequence",
  3: "class",
  4: "state",
  5: "er",
  6: "gantt",
  7: "pie",
};

/** 暗い配色で描き、印刷のための明るい配色の SVG も書く見本の名前 */
const DARK_FIXTURE = "flowchart";

/** HTML の文字参照を戻す */
const unescapeHtml = (text: string): string =>
  text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

/** モックの `pre[data-mock-mermaid]` のソースを書いた順に読む */
const readMockSources = async (root: string): Promise<string[]> => {
  const html = await readFile(join(root, MOCK_FILE), "utf8");
  return [
    ...html.matchAll(/<pre data-mock-mermaid[^>]*>\n?([\s\S]*?)<\/pre>/g),
  ].map((match) => unescapeHtml(match[1] ?? ""));
};

/** ページで描く処理（`drawMermaidDiagram`）を 1 つの IIFE に束ねる */
const bundleDrawer = async (root: string): Promise<string> => {
  const result = await build({
    stdin: {
      contents:
        'import { drawMermaidDiagram } from "./src/mermaid.ts";\nimport { resolveConfig } from "./src/config.ts";\nObject.assign(window, { drawMermaidDiagram, resolveConfig });\n',
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0]?.text ?? "";
};

/** Playwright の Chromium で見本の SVG を描き、`tests/fixtures/mermaid-svg/{名前}.svg` に書いて、書いたファイルのパスを返す */
export const writeMermaidFixtures = async (options: {
  root: string;
}): Promise<string[]> => {
  const { root } = options;
  const sources = await readMockSources(root);
  const drawer = await bundleDrawer(root);
  const css = await readFile(join(root, "src", "index.css"), "utf8");
  const mermaidDir = join(root, "node_modules", "mermaid", "dist");
  const browser = await chromium.launch();
  const written: string[] = [];
  try {
    const page = await browser.newPage();
    await page.route(`${ORIGIN}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/") {
        await route.fulfill({
          contentType: "text/html; charset=utf-8",
          body: `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="mdmark" id="root" style="width: 720px"></div><script>${drawer}</script></body></html>`,
        });
        return;
      }
      // mermaid の dist の中だけを返す
      const file = resolve(mermaidDir, `.${path}`);
      if (!file.startsWith(`${mermaidDir}/`)) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }
      await route.fulfill({
        contentType: "text/javascript; charset=utf-8",
        body: await readFile(file, "utf8"),
      });
    });
    await page.goto(`${ORIGIN}/`);
    /** 1 つのソースを描き、今の配色と印刷のための SVG を返す */
    const draw = (source: string, dark: boolean) =>
      page.evaluate(
        async ({ source, dark }) => {
          const root = document.getElementById("root") as HTMLElement;
          root.classList.toggle("mdmark-theme-dark", dark);
          const moduleUrl = "/mermaid.esm.min.mjs";
          const mermaid = ((await import(moduleUrl)) as { default: unknown })
            .default;
          const page = window as unknown as {
            drawMermaidDiagram: (
              options: Record<string, unknown>,
            ) => Promise<{ html?: string; error?: string }>;
            resolveConfig: (options: Record<string, unknown>) => {
              mermaid: unknown;
            };
          };
          const result = await page.drawMermaidDiagram({
            mermaid,
            source,
            root,
            scope: root,
            config: page.resolveConfig({}).mermaid,
            id: `fixture-${Math.random().toString(36).slice(2)}`,
            frameId: "fixture",
          });
          if (result.html === undefined) {
            throw new Error(`描けません: ${result.error}`);
          }
          const holder = document.createElement("div");
          holder.innerHTML = result.html;
          return {
            screen:
              holder.querySelector(".mdmark-mermaid > svg")?.outerHTML ?? "",
            print:
              holder.querySelector(".mdmark-mermaid-print > svg")?.outerHTML ??
              "",
          };
        },
        { source, dark },
      );
    await mkdir(join(root, FIXTURES_DIR), { recursive: true });
    const write = async (name: string, svg: string): Promise<void> => {
      const file = join(root, FIXTURES_DIR, `${name}.svg`);
      await writeFile(file, `${svg}\n`);
      written.push(file);
    };
    for (const [position, name] of Object.entries(FIXTURE_NAMES)) {
      const source = sources[Number(position)];
      if (source === undefined) {
        throw new Error(
          `モックに ${Number(position) + 1} 番目の mermaid のソースがありません`,
        );
      }
      const { screen } = await draw(source, false);
      await write(name, screen);
      if (name === DARK_FIXTURE) {
        const darkDrawn = await draw(source, true);
        await write(`${name}-dark`, darkDrawn.screen);
        await write(`${name}-print`, darkDrawn.print);
      }
    }
  } finally {
    await browser.close();
  }
  return written;
};

// 入口として実行されたときだけ書く
if (import.meta.main) {
  const written = await writeMermaidFixtures({ root: REPO_ROOT });
  for (const file of written) {
    console.log(file);
  }
}
