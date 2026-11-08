import { cp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Frame, Page } from "@playwright/test";

// mermaid の dist（開発の依存 `mermaid@12.3.0`）
export const MERMAID_DIST = resolve(
  import.meta.dirname,
  "../../node_modules/mermaid/dist",
);
// 設定の `mermaid.url` の既定と同じ、jsDelivr の mermaid の dist までの URL
export const MERMAID_CDN_DIST =
  "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/";
// 代役の配信が mermaid の dist を返却する経路（jsDelivr と同じパス）
export const MERMAID_STUB_PATH = "/npm/mermaid@12.3.0/dist/";
// mermaid の本体のファイル名
export const MERMAID_ENTRY = "mermaid.esm.min.mjs";
// mermaid の読み込みと描画を待つ上限（5MB の本体と chunk を読み込む）
export const MERMAID_WAIT_MS = 60_000;

// 描いた mermaid の図の枠
export const MERMAID_FIGURE = 'figure.mdmark-diagram[data-diagram="mermaid"]';
// 図の枠の中の、画面に出す mermaid の SVG（印刷のための SVG を除く）
export const MERMAID_SVG = `${MERMAID_FIGURE} .mdmark-mermaid > svg`;

/** front matter の `title` を持つ flowchart と、`actor` を持つ sequenceDiagram の mermaid のコードブロックを、段落で挟んだ文書 */
export const MERMAID_MARKDOWN = [
  "前の段落",
  "",
  "```mermaid",
  "---",
  "title: 問い合わせの受付",
  "---",
  "flowchart LR",
  "  A[問い合わせを受ける] --> B{担当がいるか}",
  "  B -->|いる| C[担当へ回す]",
  "```",
  "",
  "```mermaid",
  "sequenceDiagram",
  "  actor U as 読む人",
  "  participant M as mdmark",
  "  U->>M: ページを開く",
  "```",
  "",
  "後の段落",
  "",
].join("\n");

/** flowchart の mermaid のコードブロックを 1 つ持つ文書 */
export const MERMAID_FLOWCHART = [
  "# 図",
  "",
  "```mermaid",
  "flowchart LR",
  "  A[受付] --> B[回答]",
  "```",
  "",
].join("\n");

/** jsDelivr の mermaid への要求を手元の dist の応答に差し替え、受けた要求の dist からの相対パスを要求の順に返却する関数を返却する。`status` が 404 のときは本体に 404 を返却する */
export async function routeMermaid(
  page: Page,
  status: 200 | 404 = 200,
): Promise<() => string[]> {
  const requests: string[] = [];
  const escaped = MERMAID_CDN_DIST.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(new RegExp(`^${escaped}`), async (route) => {
    const file = route.request().url().slice(MERMAID_CDN_DIST.length);
    requests.push(file);
    const path = resolve(MERMAID_DIST, file);
    if (
      (status === 404 && file === MERMAID_ENTRY) ||
      !path.startsWith(`${MERMAID_DIST}/`)
    ) {
      await route.fulfill({ status: 404 });
      return;
    }
    await route.fulfill({
      body: await readFile(path),
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => [...requests];
}

/** `dir` の下の `vendor/mermaid/` に mermaid の本体と chunk をコピーし、設定に記載する相対パスを返却する */
export async function copyMermaidDist(dir: string): Promise<string> {
  const target = join(dir, "vendor", "mermaid");
  await cp(join(MERMAID_DIST, MERMAID_ENTRY), join(target, MERMAID_ENTRY));
  await cp(
    join(MERMAID_DIST, "chunks", "mermaid.esm.min"),
    join(target, "chunks", "mermaid.esm.min"),
    { recursive: true },
  );
  return `vendor/mermaid/${MERMAID_ENTRY}`;
}

/** flowchart の最初のノードの塗り・枠線・文字の色と書体、最初の線の色と、描く先の要素で解決した `--mdmark-color-*` の色と `--mdmark-font-body` の書体 */
export type MermaidColors = {
  fill: string;
  stroke: string;
  text: string;
  line: string;
  font: string;
  surface: string;
  border: string;
  textVar: string;
  lineVar: string;
  bodyFont: string;
};

/** `scope` の中の `index` 番目の mermaid の SVG（flowchart）の色と、描く先の要素で解決した CSS 変数の色を返却する */
export async function mermaidColors(
  page: Page | Frame,
  options: { scope: string; index?: number },
): Promise<MermaidColors> {
  return page.evaluate(
    ({ scope, index, svgSelector }) => {
      const root = document.querySelector<HTMLElement>(scope);
      const svg = root?.querySelectorAll<SVGSVGElement>(svgSelector)[index];
      const shape = svg?.querySelector<SVGElement>(
        "g.node rect.label-container, g.node path.label-container, g.node rect, g.node path",
      );
      const label = svg?.querySelector<Element>(".nodeLabel, text");
      const edge = svg?.querySelector<SVGElement>(".flowchart-link, path.edge");
      if (!root || !shape || !label || !edge) {
        throw new Error("flowchart のノード・文字・線が無い");
      }
      const resolveVar = (name: string): string => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        root.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      };
      return {
        fill: getComputedStyle(shape).fill,
        stroke: getComputedStyle(shape).stroke,
        text: getComputedStyle(label).color,
        line: getComputedStyle(edge).stroke,
        font: getComputedStyle(label).fontFamily,
        surface: resolveVar("--mdmark-color-surface"),
        border: resolveVar("--mdmark-color-border"),
        textVar: resolveVar("--mdmark-color-text"),
        lineVar: resolveVar("--mdmark-color-diagram-line"),
        bodyFont: (() => {
          const probe = document.createElement("span");
          probe.style.fontFamily = "var(--mdmark-font-body)";
          root.append(probe);
          const font = getComputedStyle(probe).fontFamily;
          probe.remove();
          return font;
        })(),
      };
    },
    {
      scope: options.scope,
      index: options.index ?? 0,
      svgSelector: MERMAID_SVG,
    },
  );
}

/** HTML の script 要素の中の動的 `import()` の呼び出しの数 */
export function countDynamicImports(html: string): number {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => (match[1] ?? "").match(/\bimport\s*\(/g)?.length ?? 0)
    .reduce((sum, count) => sum + count, 0);
}

// mermaid を埋めた書き出しが、mermaid を埋めない書き出しより大きくなる下限（mermaid の本体と chunk は約 5MB）
export const MERMAID_EMBED_MIN_BYTES = 1_000_000;
