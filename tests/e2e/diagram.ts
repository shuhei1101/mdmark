import { execFile } from "node:child_process";
import { cp, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import type { MdmarkExtension, MdmarkIndex } from "../../src/index.ts";

const execFileAsync = promisify(execFile);

// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");
// 見本の文書（見本のページはこの文書を描く）
const SAMPLE_PATH = join(REPO_ROOT, "docs", "使い方", "図を描く", "見本.md");

// 固有の部品のモジュールを返す架空の URL
export const CARD_URL = "https://libs.example.test/card.js";

/** 見本の文書の `json` のコードブロックの並び（書いた順）: フロー図・シーケンス図・グラフ・操作できる部品 */
const SAMPLE_BLOCKS = ["inquiry", "inquiry-seq", "reply-time", "strength"];

/** 見本の文書の中身 */
export async function sampleMarkdown(): Promise<string> {
  return readFile(SAMPLE_PATH, "utf8");
}

/** 見本の文書の `json` のコードブロックの中身を、名前（`inquiry`・`inquiry-seq`・`reply-time`・`strength`）で返す */
export async function sampleBlock(name: string): Promise<string> {
  const blocks = [
    ...(await sampleMarkdown()).matchAll(/```json\n([\s\S]*?)\n```/g),
  ];
  const text = blocks[SAMPLE_BLOCKS.indexOf(name)]?.[1];
  if (text === undefined) {
    throw new Error(`見本の定義が無い: ${name}`);
  }
  return text;
}

/** 部品の印で囲んだ文書にする */
export function wrapDirective(directive: string, json: string): string {
  return [
    `<!-- ${directive} -->`,
    "",
    "```json",
    json,
    "```",
    "",
    `<!-- /${directive} -->`,
    "",
  ].join("\n");
}

/** 見本のフロー図の部品の定義を書いた文書 */
export async function flowMarkdown(): Promise<string> {
  return wrapDirective("flow", await sampleBlock("inquiry"));
}

/** 用語 `意思決定モデル` を持つ索引（見本のフロー図の箱の `{{意思決定モデル}}` の意味になる） */
export const TERM_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [],
  terms: [
    {
      id: "dm",
      term: "意思決定モデル",
      meaning: "選択肢から選ぶだけの、速く安い判断用の AI",
    },
  ],
};

/** 固有の部品の見本: `// @ts-check` と JSDoc で型を付けた JavaScript。受けた定義の題を要素に書く */
export const CARD_SOURCE = `// @ts-check
// 型は、使う版の dist/ の index.d.ts を ../mdmark/ に置いて読む

/**
 * \`<!-- card -->\` の範囲の部品の定義の題を描く拡張
 * @type {import("../mdmark/index.js").MdmarkExtension}
 */
const extension = {
  name: "card",
  directive: "card",
  load: async () => ({
    draw(slot, value) {
      const definition = /** @type {{ title: string }} */ (value.definition);
      slot.className = "host-card";
      slot.textContent = definition.title;
    },
  }),
};

export default extension;
`;

/** 固有の部品の定義を書いた文書 */
export const CARD_MARKDOWN = wrapDirective("card", '{"title": "固有の題"}');

/** 固有の CSS: 固有の部品の文字の色と、フロー図の LLM の色を変える */
export const HOST_CSS =
  ".host-card { color: rgb(0, 0, 255) } .mdmark { --mdmark-color-diagram-llm: rgb(255, 0, 0) }";

/** 固有の部品のモジュール（`export default` の拡張）を、ページが読む形にした代役 */
const CARD_MODULE_SOURCE =
  'export default { name: "card", directive: "card", load: async () => ({ draw(slot, value) { slot.className = "host-card"; slot.textContent = value.definition.title; } }) };\n';

/** 固有の部品のモジュールを返す応答に差し替える（`source` を省くと代役）。受けた要求の件数を返す関数を返す */
export async function routeCard(
  page: Page,
  source: string = CARD_MODULE_SOURCE,
): Promise<() => number> {
  let requests = 0;
  await page.route(CARD_URL, (route) => {
    requests += 1;
    return route.fulfill({
      body: source,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => requests;
}

/** ページから、固有の部品のモジュールを読んで、その拡張を登録する */
export async function registerCard(page: Page): Promise<void> {
  await page.evaluate(async (url) => {
    const w = window as unknown as {
      mdmark?: { registerExtension: (extension: MdmarkExtension) => void };
    };
    if (!w.mdmark) {
      throw new Error("mdmark が無い");
    }
    // モジュールの URL は手元の応答が返すため、バンドラーに解決させない
    const importModule = new Function("u", "return import(u)") as (
      u: string,
    ) => Promise<{ default: MdmarkExtension }>;
    w.mdmark.registerExtension((await importModule(url)).default);
  }, CARD_URL);
}

/** クリップボードの書き込みを、書いた文字を `window.__written` に控える関数（`allow`）か、`NotAllowedError` で拒む関数（`deny`）に差し替える。ページを開く前に呼ぶ */
export async function stubClipboard(
  page: Page,
  mode: "allow" | "deny",
): Promise<void> {
  await page.addInitScript((stubMode) => {
    const written: string[] = [];
    (window as unknown as { __written: string[] }).__written = written;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (stubMode === "deny") {
            throw new DOMException("denied", "NotAllowedError");
          }
          written.push(text);
        },
      },
    });
  }, mode);
}

/** `stubClipboard` が控えた、書いた文字の並び */
export async function writtenTexts(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __written: string[] }).__written,
  );
}

/** ビルドした配布物の型定義（`.d.ts`）を、使う側のフォルダの `mdmark/` に置く */
export async function placeDeclarations(
  builtRoot: string,
  dir: string,
): Promise<void> {
  await cp(join(builtRoot, "dist"), join(dir, "mdmark"), {
    recursive: true,
    filter: async (source) =>
      source.endsWith(".d.ts") || (await isDirectory(source)),
  });
}

/** パスがフォルダか */
async function isDirectory(path: string): Promise<boolean> {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
  }
}

/** フォルダの下の全てのファイルの相対パスを、並べて返す */
export async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();
}

/** 使う側のフォルダで `tsc --noEmit` を流した結果 */
export type TscResult = {
  /** 終了コード */
  code: number;
  /** 標準出力（誤りの一覧） */
  stdout: string;
};

/** フォルダで、作業ツリーの `tsc --noEmit` を流す。誤りがあっても例外を投げず、結果を返す */
export async function runTsc(dir: string): Promise<TscResult> {
  try {
    const { stdout } = await execFileAsync(
      join(REPO_ROOT, "node_modules", ".bin", "tsc"),
      ["--noEmit", "--pretty", "false"],
      { cwd: dir },
    );
    return { code: 0, stdout };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string };
    return { code: failed.code ?? -1, stdout: failed.stdout ?? "" };
  }
}

/** ブラウザで、全体が収まる倍率に操作を付けた図の表示する枠まで、Tab で進む。進めなければ例外を投げる */
export async function tabToViewport(page: Page): Promise<void> {
  await page.locator("#doc").evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  for (let count = 0; count < 20; count += 1) {
    await page.keyboard.press("Tab");
    const reached = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("aria-roledescription") === "図",
    );
    if (reached) {
      return;
    }
  }
  throw new Error("Tab で図の表示する枠へ進めない");
}

/** 倍率の表示（`67%` など）を数にする */
export async function zoomPercent(page: Page): Promise<number> {
  const text = await page
    .locator("#doc figure.mdmark-diagram .mdmark-diagram-zoom")
    .first()
    .innerText();
  return Number.parseInt(text, 10);
}
