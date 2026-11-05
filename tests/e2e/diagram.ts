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

// 使い方『図を描く』（判定フローチャートの定義の例を持つ）
const GUIDE_PATH = join(REPO_ROOT, "docs", "使い方", "図を描く", "図を描く.md");

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

/** 使い方『図を描く』の判定フローチャートの定義を書いた文書 */
export async function judgementMarkdown(): Promise<string> {
  const guide = await readFile(GUIDE_PATH, "utf8");
  const text = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)]
    .map((match) => match[1] ?? "")
    .find((block) => block.includes('"kind": "question"'));
  if (text === undefined) {
    throw new Error("使い方『図を描く』に判定フローチャートの定義が無い");
  }
  return wrapDirective("flow", text);
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

/** 座標を省いた判定フローチャートの定義（開始 1・質問 2・アクション 1・結果 2 のノードと 6 本の線。ノードの座標・線の `points`・図の `width`・`height` を書かない） */
export const JUDGEMENT_AUTO_TEXT: string = JSON.stringify({
  title: "問い合わせの返信の判定",
  scope: "問い合わせを受け取ったとき",
  updated: "2026-11-04",
  nodes: [
    { id: "start", kind: "start", name: "問い合わせを受け取る" },
    { id: "q1", kind: "question", name: "よくある質問で答えられるか" },
    { id: "a1", kind: "action", name: "よくある質問のリンクを添える" },
    { id: "q2", kind: "question", name: "担当者が答えられるか" },
    { id: "r1", kind: "result", name: "返信を送信する" },
    { id: "r2", kind: "result", name: "開発に起票する" },
  ],
  wires: [
    { id: "j-start", from: "start", to: "q1", line: "flow" },
    { id: "j-q1-yes", from: "q1", to: "a1", line: "flow", label: "YES" },
    { id: "j-q1-no", from: "q1", to: "q2", line: "flow", label: "NO" },
    { id: "j-a1", from: "a1", to: "r1", line: "flow" },
    { id: "j-q2-yes", from: "q2", to: "r1", line: "flow", label: "YES" },
    { id: "j-q2-no", from: "q2", to: "r2", line: "flow", label: "NO" },
  ],
});

/** リンク先を持つノードのフロー図の定義。`hrefs` はノード `a`・`b` のリンク先で、ノード `c` はリンク先を持たない。`io` を渡すとノード `a` に入力・処理・出力を持たせる */
export function linkedFlowText(options: {
  hrefs: [string, string];
  io?: boolean;
}): string {
  const node = (id: string, x: number, href?: string) => ({
    id,
    kind: "script",
    x,
    y: 40,
    w: 200,
    h: 72,
    name: `ノード ${id}`,
    ...(href === undefined ? {} : { href }),
  });
  const [first, second] = options.hrefs;
  return JSON.stringify({
    title: "リンク",
    scope: "点検",
    updated: "2026-11-05",
    width: 760,
    height: 152,
    nodes: [
      {
        ...node("a", 20, first),
        ...(options.io
          ? { io: { in: "本文", do: "種類を 1 つ選ぶ", out: "種類" } }
          : {}),
      },
      node("b", 280, second),
      node("c", 540),
    ],
    wires: [],
  });
}

/** ページの中のリンク先への遷移を手元の応答で受け、開いた URL を返す関数を返す（`urls` に当たる要求だけを受ける） */
export async function routeLinkTargets(
  page: Page,
  urls: string[],
): Promise<() => string[]> {
  const opened: string[] = [];
  for (const url of urls) {
    await page.route(url, (route) => {
      opened.push(route.request().url());
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>開いた</title>",
      });
    });
  }
  return () => [...opened];
}

/** 見本のフロー図のシステムの枠の `hint` */
export const FRAME_HINT = "メールの受け取りから返信までを受け持つ範囲";

/** 見本のフロー図の LLM の層の `hint` */
export const LANE_HINT = "返信の種類を選び、下書きを書く";

/** 見本のフロー図に、システムの枠と LLM の層の `hint` を足した定義の JSON。`stickyTitles` を渡すとその値も書く */
export async function groupFlowText(
  options: { stickyTitles?: boolean } = {},
): Promise<string> {
  const definition = JSON.parse(await sampleBlock("inquiry")) as {
    frame: Record<string, unknown>;
    lanes: Array<Record<string, unknown>>;
    stickyTitles?: boolean;
  };
  definition.frame = { ...definition.frame, hint: FRAME_HINT };
  definition.lanes = definition.lanes.map((lane) =>
    lane.kind === "llm" ? { ...lane, hint: LANE_HINT } : lane,
  );
  if (options.stickyTitles !== undefined) {
    definition.stickyTitles = options.stickyTitles;
  }
  return JSON.stringify(definition, null, 2);
}
