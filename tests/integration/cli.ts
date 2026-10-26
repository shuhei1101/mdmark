import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

const execFileAsync = promisify(execFile);

/** CLI を子プロセスで流した結果 */
export type CliResult = {
  /** 終了コード */
  code: number;
  /** 標準出力 */
  stdout: string;
  /** 標準エラー */
  stderr: string;
};

/** 画像の見本: 1 ピクセルの PNG */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** 外部ライブラリの代役: `draw` で印の場所の文字を `drawn:` と引数を `,` で結んだものにする */
export const TEST_LIB_SOURCE = `export function draw(slot, args) {
  slot.textContent = "drawn:" + args.join(",");
}
`;

/** 拡張の代役: `draw` で印の場所の文字を `greet:` と引数を `,` で結んだものにする */
export const GREET_SOURCE = `export default {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot, value) {
      slot.textContent = "greet:" + value.args.join(",");
    },
  }),
};
`;

/** 使う側の CSS の見本: 角丸の変数を上書きする */
export const THEME_SOURCE = ".mdmark { --mdmark-radius: 0px; }\n";

/** ビルドした `dist/cli.js` を、`cwd` で子プロセスとして流す。終了コードが 0 以外でも例外を投げず、結果を返す */
export async function runCli(args: string[], cwd: string): Promise<CliResult> {
  const cli = join(inject("builtRoot"), "dist", "cli.js");
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cli, ...args],
      { cwd },
    );
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failed = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: failed.code ?? -1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? "",
    };
  }
}

/** テストごとに作った一時フォルダを消す。一時フォルダを作る関数を返す */
export function useTempDirs(): () => Promise<string> {
  const created: string[] = [];
  afterEach(async () => {
    await Promise.all(
      created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });
  return async () => {
    const dir = await mkdtemp(join(tmpdir(), "mdmark-integration-cli-"));
    created.push(dir);
    return dir;
  };
}

/** フォルダの下にファイルを書く（親のフォルダは作る） */
export async function writeFiles(
  root: string,
  files: Record<string, string | Uint8Array>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}

/** フォルダで git を 1 回呼び、標準出力を返す */
export async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

/** 最初のコミットに付けるタグの名前 */
export const BASE_TAG = "base";

/** 文書 `a`・`b` が互いを `change_together` で記載した索引の中身 */
const CHANGE_TOGETHER_INDEX = [
  "schema: 1",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: A",
  "    related:",
  "      - to: b",
  "        type: change_together",
  "        when: 索引の Schema を変えるとき",
  "  - id: b",
  "    path: b.md",
  "    title: B",
  "    related:",
  "      - to: a",
  "        type: change_together",
  "        when: 索引の Schema を変えるとき",
  "",
].join("\n");

/**
 * `mdmark init` の雛形に、互いを `change_together` で記載した文書 `a`・`b` を足した git のフォルダを作る。
 * 全てをコミットしてタグ `base` を付け、その後 `a.md` だけを書き換えてコミットする
 */
export async function createChangeTogetherDir(
  createTempDir: () => Promise<string>,
): Promise<string> {
  const dir = await createTempDir();
  await runCli(["init", dir], dir);
  await writeFiles(dir, {
    "a.md": "# A\n",
    "b.md": "# B\n",
    "index.yaml": CHANGE_TOGETHER_INDEX,
  });
  await git(dir, "init", "-q");
  await git(dir, "config", "user.email", "test@example.com");
  await git(dir, "config", "user.name", "test");
  await git(dir, "config", "commit.gpgsign", "false");
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "最初のコミット");
  await git(dir, "tag", BASE_TAG);
  await writeFiles(dir, { "a.md": "# A\n\n書き換えた。\n" });
  await git(dir, "add", "-A");
  await git(dir, "commit", "-q", "-m", "a を書き換える");
  return dir;
}

/** 標準出力・標準エラーを行に分ける（空行は除く） */
export function linesOf(text: string): string[] {
  return text.split("\n").filter((line) => line !== "");
}

/** 書き出した HTML を、1 つだけ空のフォルダへ写して file:// で開いた結果 */
export type OpenedHtml = {
  /** 開いたページ */
  page: Page;
  /** 開いてから今までの、ページ自身（開いた HTML）と `blob:`・`data:` のほかへの要求の URL */
  externalRequests: () => string[];
};

/** テストファイルの間で使う、Chromium の起動と終了と、書き出した HTML を開く関数を返す */
export function useBrowser(createTempDir: () => Promise<string>): {
  openHtml: (
    htmlFile: string,
    size?: { width: number; height: number },
  ) => Promise<OpenedHtml>;
} {
  let browser: Browser | undefined;
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  afterAll(async () => {
    await browser?.close();
  });
  return {
    openHtml: async (htmlFile, size = { width: 1200, height: 800 }) => {
      if (!browser) {
        throw new Error("ブラウザを起動していない");
      }
      // 配布先と同じく、HTML だけを空のフォルダへ写して開く
      const dir = await createTempDir();
      const alone = join(dir, "alone.html");
      await copyFile(htmlFile, alone);
      const page = await browser.newPage({ viewport: size });
      const pageUrl = pathToFileURL(alone).href;
      const requests: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (url !== pageUrl && !/^(?:blob|data):/.test(url)) {
          requests.push(url);
        }
      });
      await page.goto(`file://${alone}`);
      return { page, externalRequests: () => requests };
    },
  };
}
