import { execFile } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import type {
  MdmarkAlias,
  MdmarkComment,
  MdmarkConfig,
  MdmarkExtension,
  MdmarkIndex,
  MdmarkIndexIssue,
  MdmarkMatches,
  MdmarkReferences,
} from "../../src/index.ts";
import {
  copyPluginInputs,
  writeRootPackageJson,
} from "../integration/plugin-inputs.ts";

const execFileAsync = promisify(execFile);

// jsDelivr の GitHub エンドポイントの、バージョンのタグまでの URL
const CDN_BASE = "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark";
// ページを返却する架空のオリジン
export const PAGE_URL = "https://app.example.test/";
// 外部ライブラリの代役のモジュールを返却する架空の URL
export const LIB_URL = "https://libs.example.test/test-lib.js";
// 拡張の代役のモジュールを返却する架空の URL
export const EXTENSION_URL = "https://libs.example.test/greet.js";
// 色分けのライブラリ（highlight.js）を配る jsDelivr の npm の URL。`syntax.url` の既定と同じ
export const SYNTAX_URL =
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";
// 色分けのライブラリの `es/` を配置した場所（開発の依存 `@highlightjs/cdn-assets`）
export const SYNTAX_ES_ROOT = resolve(
  import.meta.dirname,
  "../../node_modules/@highlightjs/cdn-assets/es",
);
// 配布物を埋めてビルドするバージョン
const BUILT_VERSION = "v0.0.1";
// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "../..");
// 外部ライブラリの代役: `draw` でマーカーの場所の文字を、受けた `options` の `label` にする
const TEST_LIB_SOURCE =
  "export function draw(slot, options) { slot.textContent = options.label; }\n";

// 拡張の代役: `draw` でマーカーの場所の文字を `greet:` と受けた `options` の `target` にし、受けた値のキーを `data-keys` に記録する
const EXTENSION_SOURCE =
  'export function draw(slot, value) { slot.textContent = "greet:" + value.options.target; slot.dataset.keys = Object.keys(value).sort().join(","); }\n';

/** 見本の Markdown: 見出し・段落・リスト・表・コードブロック・リンク・折り畳み・機能のマーカー・スクリプト */
export const SAMPLE_MARKDOWN = [
  '<!-- features: {"a": true, "b": false} -->',
  "",
  "# 見出し",
  "",
  "段落",
  "",
  "- 項目",
  "",
  "| 列A | 列B |",
  "| --- | ---: |",
  "| 1 | 2 |",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
  "[リンク](https://example.com/page)",
  "",
  "<details><summary>折り畳み</summary>中身</details>",
  "",
  "<script>window.__ran = true</script>",
  "",
].join("\n");

/** 描く先の要素の id */
export const DOC_SELECTOR = "#doc";

/** 索引を指定して描くときの引数 */
export type IndexOptions = {
  /** 索引 */
  index?: MdmarkIndex;
  /** 描く文書の索引の `id` */
  docId?: string;
  /** 参照の表 */
  references?: MdmarkReferences;
  /** 読み込んだエイリアス */
  aliases?: MdmarkAlias[];
  /** 取り込む文書の表 */
  includes?: Record<string, string>;
};

/** 使用できないエイリアス（`env` を含む）を、型の検査にかけずに `aliases` へ指定できる構造にする */
export function rawAliases(aliases: unknown[]): MdmarkAlias[] {
  return aliases as MdmarkAlias[];
}

/** ページの中に作るコメントの読み込みと保存の関数の仕様 */
export type CommentStoreSpec = {
  /** `load` が返却するコメント */
  loaded?: MdmarkComment[];
  /** `save` が reject する */
  failSave?: boolean;
  /** 呼ばれた回ごとに `load` が返却するコメント（`loaded` より先に使用し、尽きたら最後のものを返却する） */
  loadedByCall?: MdmarkComment[][];
  /** 2 回目以降の `load` が reject する */
  failReload?: boolean;
  /** `update`・`remove` を持たせる */
  editable?: boolean;
  /** `update` が reject する */
  failUpdate?: boolean;
  /** `remove` が reject する */
  failRemove?: boolean;
};

/** コメントの読み込みと保存の関数が受けた呼び出し */
export type CommentCalls = {
  load: Array<{ docId: string }>;
  save: Array<{
    docId: string;
    comment: { quote: string; prefix: string; suffix: string; body: string };
  }>;
  update: Array<{ docId: string; id: string; body: string }>;
  remove: Array<{ docId: string; id: string }>;
};

/** `mount` の戻り値 */
type PageHandle = {
  update: (markdown: string, options?: { baseMarkdown?: unknown }) => void;
  destroy: () => void;
  reloadComments: () => Promise<void>;
  focusComment: (id: string) => void;
};

type MdmarkWindow = Window & {
  commentStore?: unknown;
  commentCalls?: CommentCalls;
  viewHandle?: { destroy: () => void };
  commentsHandle?: { destroy: () => void };
  mdmark?: {
    mount: (
      el: HTMLElement,
      opts: {
        markdown: string;
        config?: MdmarkConfig;
        diffSource?: unknown;
        diffMode?: string;
        commentStore?: unknown;
        baseMarkdown?: unknown;
        onColumnsChange?: (event: unknown) => void;
      } & IndexOptions,
    ) => PageHandle;
    mountView: (
      el: HTMLElement,
      opts: unknown,
    ) => Promise<{ destroy: () => void }>;
    mountComments: (
      el: HTMLElement,
      opts: { store: unknown; docId: string },
    ) => Promise<{ destroy: () => void }>;
    render: (
      markdown: string,
      opts?: { config?: MdmarkConfig } & IndexOptions,
    ) => string;
    registerExtension: (extension: MdmarkExtension) => void;
    collectReferences: (input: {
      index: MdmarkIndex;
      documents: Record<string, string>;
    }) => MdmarkReferences;
  };
  handle?: PageHandle;
  columnsCalls?: unknown[];
  diffCalls?: { revisions: string[]; content: DiffContentCall[] };
  releaseRevisions?: () => void;
};

/** 取り出し元の `content` が受けた引数 */
export type DiffContentCall = { docId: string; revisionId: string };

/** 取り出し元のリビジョン 1 つ分 */
export type DiffRevisionSpec = {
  id: string;
  at: string;
  label?: string;
  author?: string;
};

/** ページの中に作る取り出し元（`DiffSource`）の仕様 */
export type DiffSourceSpec = {
  /** `revisions` が返却する値。構造を壊した値も指定できる */
  revisions: unknown;
  /** リビジョンの `id` から本文を参照する表 */
  contents: Record<string, string>;
  /** `revisions` が reject する */
  failRevisions?: boolean;
  /** `content` が reject するリビジョンの `id` */
  failContent?: string[];
  /** `revisions` が `releaseRevisions` を呼ぶまで返らない */
  pendingRevisions?: boolean;
};

/** `version`（既定は `v0.0.1`）を埋めてビルドした作業ツリーを作り、その場所を返却する。ビルドは入口 `node scripts/build.ts --version {バージョン}` を実行し、配布ファイルの上限は既定のままにする */
export async function buildDistRoot(
  version: string = BUILT_VERSION,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-e2e-dist-"));
  await cp(join(REPO_ROOT, "scripts"), join(root, "scripts"), {
    recursive: true,
  });
  await cp(join(REPO_ROOT, "src"), join(root, "src"), { recursive: true });
  // CLI がまとめる設定の Schema と取り込んだ alias-inject の Schema
  await cp(join(REPO_ROOT, "schemas"), join(root, "schemas"), {
    recursive: true,
  });
  // CLI の `init` が写す雛形の原本
  await cp(join(REPO_ROOT, "templates"), join(root, "templates"), {
    recursive: true,
  });
  for (const name of ["tsconfig.json", "tsconfig.dist.json"]) {
    await cp(join(REPO_ROOT, name), join(root, name));
  }
  await writeRootPackageJson(root);
  // プラグインのビルドが読み込む入力
  await copyPluginInputs(root);
  await writeFile(join(root, "version.ini"), `${BUILT_VERSION}\n`);
  await symlink(
    join(REPO_ROOT, "node_modules"),
    join(root, "node_modules"),
    "dir",
  );
  // 失敗（上限の超過を含む）すると例外になる
  await execFileAsync(
    process.execPath,
    ["scripts/build.ts", "--version", version],
    { cwd: root },
  );
  return root;
}

/** ビルドした作業ツリーを削除する */
export async function removeDistRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

/** 配布物を読み込むページの HTML を返却する。利用側の CSS は mdmark の CSS の後に配置する */
function pageHtml(hostCss: string): string {
  return `<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="${CDN_BASE}@${BUILT_VERSION}/dist/index.css">
    <style>${hostCss}</style>
    <script type="module">
      import { mount, render, registerExtension, collectReferences, mountView, mountComments } from "${CDN_BASE}@${BUILT_VERSION}/dist/index.js";
      window.mdmark = { mount, render, registerExtension, collectReferences, mountView, mountComments };
    </script>
  </head>
  <body><div id="doc"></div></body>
</html>`;
}

/** ページの HTML と、jsDelivr への要求を、手元の応答に差し替えてページを開き、公開関数が使用できるまで待つ */
export async function openPage(
  page: Page,
  root: string,
  options: { hostCss?: string; hash?: string } = {},
): Promise<void> {
  await page.route(PAGE_URL, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: pageHtml(options.hostCss ?? ""),
    }),
  );
  await page.route(`${CDN_BASE}@*/dist/*`, async (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    await route.fulfill({
      body: await readFile(join(root, "dist", file)),
      contentType: file.endsWith(".css") ? "text/css" : "text/javascript",
      // 別のオリジンのページが module を読み込むため
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`${PAGE_URL}${options.hash ?? ""}`);
  await page.waitForFunction(() => "mdmark" in window);
}

/** jsDelivr の Lucide のアイコンのモジュールの代役（構造を 1 つ持つ） */
export const LUCIDE_MODULE = 'export default [["path",{"d":"M3 12h18"}]];';

/** jsDelivr の Lucide のアイコンへの要求を差し替え、受けた要求の「メソッド URL」を記録する配列を返却する。`respond` は名前（`sailboat` など）から応答の状態か、通信の失敗（`"fail"`）を返却する */
export async function routeLucide(
  page: Page,
  respond: (name: string) => 200 | 404 | "fail" = () => 200,
): Promise<string[]> {
  const requests: string[] = [];
  await page.route(
    "https://cdn.jsdelivr.net/npm/lucide@*/**",
    async (route) => {
      const request = route.request();
      requests.push(`${request.method()} ${request.url()}`);
      const name =
        new URL(request.url()).pathname
          .split("/")
          .pop()
          ?.replace(/\.mjs$/, "") ?? "";
      const answer = respond(name);
      if (answer === "fail") {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: answer,
        body: answer === 200 ? LUCIDE_MODULE : "",
        contentType: "text/javascript",
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
  return requests;
}

/** 外部ライブラリの代役のモジュールを返却する応答に差し替え、受けた要求の件数を返却する関数を返却する。status が 404 のときは中身を返却しない */
export async function routeLibrary(
  page: Page,
  status: 200 | 404,
): Promise<() => number> {
  let requests = 0;
  await page.route(LIB_URL, (route) => {
    requests += 1;
    return route.fulfill({
      status,
      body: status === 200 ? TEST_LIB_SOURCE : undefined,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => requests;
}

/** 色分けのライブラリの本体と言語のモジュールを、jsDelivr と同じパスの手元の応答に差し替え、受けた要求を `es/` からの相対パス（`core.min.js`・`languages/yaml.min.js`）の名前の順に返却する関数を返却する。`missing` に挙げた相対パスには 404 を返却する */
export async function routeSyntax(
  page: Page,
  options: { missing?: string[] } = {},
): Promise<() => string[]> {
  const requests: string[] = [];
  const escaped = SYNTAX_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.route(new RegExp(`^${escaped}`), async (route) => {
    const file = route.request().url().slice(SYNTAX_URL.length);
    requests.push(file);
    if (options.missing?.includes(file)) {
      await route.fulfill({ status: 404 });
      return;
    }
    await route.fulfill({
      body: await readFile(join(SYNTAX_ES_ROOT, file)),
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => [...requests].sort();
}

/** 拡張の代役のモジュールを返却する応答に差し替え、受けた要求の件数を返却する関数を返却する。status が 404 のときは中身を返却しない。`source` を指定するとその中身を返却する */
export async function routeExtension(
  page: Page,
  status: 200 | 404,
  source: string = EXTENSION_SOURCE,
): Promise<() => number> {
  let requests = 0;
  await page.route(EXTENSION_URL, (route) => {
    requests += 1;
    return route.fulfill({
      status,
      body: status === 200 ? source : undefined,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => requests;
}

/** ページから、`greet` のマーカーの拡張を登録する。`strict` が真なら `options.target` を英小文字の文字列だけで許す schema を付ける */
export async function registerGreet(
  page: Page,
  options: { strict?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ({ url, strict }) => {
      const w = window as MdmarkWindow;
      if (!w.mdmark) {
        throw new Error("mdmark が無い");
      }
      // モジュールの URL は手元の応答が返却するため、バンドラーに解決させない
      const importModule = new Function("u", "return import(u)") as (
        u: string,
      ) => Promise<{ draw: (slot: HTMLElement, value: unknown) => void }>;
      w.mdmark.registerExtension({
        name: "greet",
        directive: "greet",
        load: () => importModule(url),
        schema: strict
          ? {
              "~standard": {
                version: 1,
                vendor: "e2e",
                validate: (value) => {
                  const { options } = value as {
                    options: Record<string, unknown>;
                  };
                  const target = options.target;
                  return typeof target === "string" && /^[a-z]+$/.test(target)
                    ? { value }
                    : {
                        issues: [
                          {
                            message: "英小文字の文字列で書いてください",
                            path: ["options", "target"],
                          },
                        ],
                      };
                },
              },
            }
          : undefined,
      } as MdmarkExtension);
    },
    { url: EXTENSION_URL, strict: options.strict ?? false },
  );
}

/** ページから、描く先の要素に文書を描かせる（戻り値はページの `window.handle` に記録する）。`documents` を指定すると、ページで `collectReferences` を呼んで参照の表を作って指定する */
export async function mountDocument(
  page: Page,
  options: {
    markdown: string;
    config?: MdmarkConfig;
    documents?: Record<string, string>;
    /** `installCommentStore` で作った読み込みと保存の関数を `mount` に指定する */
    useCommentStore?: boolean;
    /** 比較元の Markdown */
    baseMarkdown?: string | null;
    /** 受けた引数を `window.columnsCalls` に記録する `onColumnsChange` を指定する */
    recordColumns?: boolean;
    /** 取り込む文書の表（`opts.includes`） */
    includes?: Record<string, string>;
    /** まとめていない名前のアイコンの形状の表（`opts.icons`） */
    icons?: Record<string, Array<[string, Record<string, string>]>>;
  } & IndexOptions,
): Promise<void> {
  await page.evaluate(
    ({
      markdown,
      config,
      index,
      docId,
      documents,
      references,
      aliases,
      useCommentStore,
      baseMarkdown,
      recordColumns,
      includes,
      icons,
    }) => {
      const w = window as MdmarkWindow;
      const el = document.querySelector<HTMLElement>("#doc");
      if (!w.mdmark || !el) {
        throw new Error("mdmark か描く先の要素が無い");
      }
      w.columnsCalls = [];
      const refs =
        references ??
        (index && documents
          ? w.mdmark.collectReferences({ index, documents })
          : undefined);
      w.handle = w.mdmark.mount(el, {
        markdown,
        config,
        index,
        docId,
        references: refs,
        aliases,
        commentStore: useCommentStore ? w.commentStore : undefined,
        ...(baseMarkdown === undefined ? {} : { baseMarkdown }),
        ...(includes === undefined ? {} : { includes }),
        ...(icons === undefined ? {} : { icons }),
        ...(recordColumns
          ? {
              onColumnsChange: (event: unknown) => {
                w.columnsCalls?.push(JSON.parse(JSON.stringify(event)));
              },
            }
          : {}),
      });
    },
    options,
  );
}

/** ページの中に、仕様どおりのコメントの読み込みと保存の関数を作る。受けた呼び出しは `window.commentCalls` に記録する。`save` は指定された下書きに `id` を付けて返却する */
export async function installCommentStore(
  page: Page,
  spec: CommentStoreSpec = {},
): Promise<void> {
  await page.evaluate((storeSpec) => {
    const w = window as MdmarkWindow;
    const calls: CommentCalls = { load: [], save: [], update: [], remove: [] };
    w.commentCalls = calls;
    const byCall = storeSpec.loadedByCall;
    const store: Record<string, unknown> = {
      load: (target: { docId: string }) => {
        calls.load.push({ docId: target.docId });
        if (storeSpec.failReload && calls.load.length > 1) {
          return Promise.reject(new Error("network"));
        }
        if (byCall && byCall.length > 0) {
          return Promise.resolve(
            byCall[Math.min(calls.load.length, byCall.length) - 1],
          );
        }
        return Promise.resolve(storeSpec.loaded ?? []);
      },
      save: (target: {
        docId: string;
        comment: CommentCalls["save"][number]["comment"];
      }) => {
        calls.save.push(JSON.parse(JSON.stringify(target)));
        if (storeSpec.failSave) {
          return Promise.reject(new Error("network"));
        }
        return Promise.resolve({
          id: `c${calls.save.length}`,
          ...target.comment,
        });
      },
    };
    if (storeSpec.editable) {
      store.update = (target: { docId: string; id: string; body: string }) => {
        calls.update.push({ ...target });
        return storeSpec.failUpdate
          ? Promise.reject(new Error("network"))
          : Promise.resolve();
      };
      store.remove = (target: { docId: string; id: string }) => {
        calls.remove.push({ ...target });
        return storeSpec.failRemove
          ? Promise.reject(new Error("network"))
          : Promise.resolve();
      };
    }
    w.commentStore = store;
  }, spec);
}

/** コメントの読み込みと保存の関数が受けた呼び出しを返却する */
export async function readCommentCalls(page: Page): Promise<CommentCalls> {
  return page.evaluate(() => {
    const calls = (window as MdmarkWindow).commentCalls;
    if (!calls) {
      throw new Error("コメントの読み書きの関数を作っていない");
    }
    return JSON.parse(JSON.stringify(calls));
  });
}

/** ページから、`#doc` の中にビューを描かせる。TypeError は同期で投げられるため、`error` に記録して返却する */
export async function mountViewInPage(
  page: Page,
  options: unknown,
): Promise<{ error: string | null }> {
  return page.evaluate(async (opts) => {
    const w = window as MdmarkWindow;
    const el = document.querySelector<HTMLElement>("#doc");
    if (!w.mdmark || !el) {
      throw new Error("mdmark か描く先の要素が無い");
    }
    try {
      w.viewHandle = await w.mdmark.mountView(el, opts);
      return { error: null };
    } catch (error) {
      return { error: `${(error as Error).name}: ${(error as Error).message}` };
    }
  }, options);
}

/** ページから、`tasks` のマーカーの拡張を登録する。拡張の `draw` は、マーカーの範囲の `json` の定義を、`mountView` でマーカーの場所の要素に描いて待つ */
export async function registerTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as MdmarkWindow;
    const mdmark = w.mdmark;
    if (!mdmark) {
      throw new Error("mdmark が無い");
    }
    mdmark.registerExtension({
      name: "tasks",
      directive: "tasks",
      load: async () => ({
        draw: async (slot: HTMLElement, value: { definition?: unknown }) => {
          await mdmark.mountView(slot, value.definition);
        },
      }),
    } as MdmarkExtension);
  });
}

/** ページから、`#doc` の中の選んだ箇所にコメントを付けられるようにさせる */
export async function mountCommentsInPage(
  page: Page,
  docId: string,
): Promise<void> {
  await page.evaluate(async (id) => {
    const w = window as MdmarkWindow;
    const el = document.querySelector<HTMLElement>("#doc");
    if (!w.mdmark || !el) {
      throw new Error("mdmark か描く先の要素が無い");
    }
    w.commentsHandle = await w.mdmark.mountComments(el, {
      store: w.commentStore,
      docId: id,
    });
  }, docId);
}

/** ページから、`mountView`・`mountComments` が返却した片付けの関数を呼ぶ */
export async function destroyHandles(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as MdmarkWindow;
    w.viewHandle?.destroy();
    w.commentsHandle?.destroy();
  });
}

/** セレクターに該当する要素の最初の文字のセクションの、始まりと終わりの位置の間を選ぶ（選択を解除するときは `null`） */
export async function selectText(
  page: Page,
  target: { selector: string; start: number; end: number } | null,
): Promise<void> {
  await page.evaluate((range) => {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (range === null) {
      return;
    }
    const text = document.querySelector(range.selector)?.firstChild;
    if (!text) {
      throw new Error("選ぶ文字が無い");
    }
    const selected = document.createRange();
    selected.setStart(text, range.start);
    selected.setEnd(text, range.end);
    selection?.addRange(selected);
  }, target);
}

/** ページから、描いた文書の本文を差し替えさせる */
export async function updateDocument(
  page: Page,
  markdown: string,
  options?: { baseMarkdown?: string | null },
): Promise<void> {
  await page.evaluate(
    ({ next, opts }) => {
      const handle = (window as MdmarkWindow).handle;
      if (opts === undefined) {
        handle?.update(next);
      } else {
        handle?.update(next, opts);
      }
    },
    { next: markdown, opts: options },
  );
}

/** `onColumnsChange` が受けた引数を返却する */
export async function readColumnsCalls(page: Page): Promise<unknown[]> {
  return page.evaluate(() => (window as MdmarkWindow).columnsCalls ?? []);
}

/** ページから `reloadComments` を呼ばせ、解決した値か reject の理由のメッセージを返却する */
export async function reloadComments(
  page: Page,
): Promise<{ resolved: unknown } | { rejected: string }> {
  return page.evaluate(async () => {
    try {
      const value = await (window as MdmarkWindow).handle?.reloadComments();
      return { resolved: value ?? null };
    } catch (error) {
      return {
        rejected: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

/** ページから `focusComment` を呼ばせる */
export async function focusComment(page: Page, id: string): Promise<void> {
  await page.evaluate((target) => {
    (window as MdmarkWindow).handle?.focusComment(target);
  }, id);
}

/** ページから、描いた文書を片付けさせる */
export async function destroyDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as MdmarkWindow).handle?.destroy();
  });
}

/** ページから、Markdown を HTML 文字列にさせ、描く先の要素に触れずに文字列だけを返却する */
export async function renderInPage(
  page: Page,
  markdown: string,
  options: IndexOptions = {},
): Promise<string> {
  return page.evaluate(
    ({ source, opts }) => {
      const w = window as MdmarkWindow;
      if (!w.mdmark) {
        throw new Error("mdmark が無い");
      }
      return w.mdmark.render(source, opts);
    },
    { source: markdown, opts: options },
  );
}

/** 配布物を Node で読み込み（DOM を持たない別のプロセス）、Markdown を HTML 文字列にして返却する */
export async function renderInNode(
  root: string,
  markdown: string,
  options: IndexOptions = {},
): Promise<string> {
  const url = pathToFileURL(join(root, "dist", "index.js")).href;
  const script = `import(${JSON.stringify(url)}).then((m) => process.stdout.write(m.render(process.env.MARKDOWN, JSON.parse(process.env.OPTIONS))))`;
  const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
    env: {
      ...process.env,
      MARKDOWN: markdown,
      OPTIONS: JSON.stringify(options),
    },
  });
  return stdout;
}

/** 配布物を Node で読み込み（DOM を持たない別のプロセス）、索引と文書の本文から点検のずれの一覧を返却する */
export async function checkInNode(
  root: string,
  input: {
    index: unknown;
    documents: Record<string, string>;
    indexFile?: string;
    changedPaths?: string[];
  },
): Promise<MdmarkIndexIssue[]> {
  const url = pathToFileURL(join(root, "dist", "index.js")).href;
  const script = `import(${JSON.stringify(url)}).then((m) => process.stdout.write(JSON.stringify(m.checkIndex(JSON.parse(process.env.INPUT)))))`;
  const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
    env: { ...process.env, INPUT: JSON.stringify(input) },
  });
  return JSON.parse(stdout);
}

/** 配布物を Node で読み込み（DOM を持たない別のプロセス）、索引と文書の本文から本文の一致と参照先を返却する */
export async function collectMatchesInNode(
  root: string,
  input: {
    index: unknown;
    documents: Record<string, string>;
    aliases?: MdmarkAlias[];
  },
): Promise<MdmarkMatches> {
  const url = pathToFileURL(join(root, "dist", "index.js")).href;
  const script = `import(${JSON.stringify(url)}).then((m) => process.stdout.write(JSON.stringify(m.collectMatches(JSON.parse(process.env.INPUT)))))`;
  const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
    env: { ...process.env, INPUT: JSON.stringify(input) },
  });
  return JSON.parse(stdout);
}

/** 印刷の前後のイベントを送信する */
export async function sendPrintEvent(
  page: Page,
  type: "beforeprint" | "afterprint",
): Promise<void> {
  await page.evaluate((eventType) => {
    window.dispatchEvent(new Event(eventType));
  }, type);
}

/** ページの中に、仕様どおりの取り出し元を作って文書を描かせる。取り出し元が受けた呼び出しは `window.diffCalls` に記録する。`docId` を省くと指定しない */
export async function mountDiffDocument(
  page: Page,
  options: {
    markdown: string;
    docId?: string;
    source: DiffSourceSpec;
    /** 差分の出し方。省くと指定しない */
    diffMode?: string;
  },
): Promise<void> {
  await page.evaluate(({ markdown, docId, source, diffMode }) => {
    const w = window as MdmarkWindow;
    const el = document.querySelector<HTMLElement>("#doc");
    if (!w.mdmark || !el) {
      throw new Error("mdmark か描く先の要素が無い");
    }
    const calls = {
      revisions: [] as string[],
      content: [] as DiffContentCall[],
    };
    w.diffCalls = calls;
    let release: () => void = () => {};
    w.releaseRevisions = () => release();
    const diffSource = {
      revisions: (id: string) => {
        calls.revisions.push(id);
        if (source.failRevisions) {
          return Promise.reject(new Error("network"));
        }
        if (source.pendingRevisions) {
          return new Promise((resolve) => {
            release = () => resolve(source.revisions);
          });
        }
        return Promise.resolve(source.revisions);
      },
      content: (target: DiffContentCall) => {
        calls.content.push(target);
        return source.failContent?.includes(target.revisionId)
          ? Promise.reject(new Error("content"))
          : Promise.resolve(source.contents[target.revisionId] ?? "");
      },
    };
    w.handle = w.mdmark.mount(el, { markdown, docId, diffSource, diffMode });
  }, options);
}

/** ページの中で、式の文字列が返却する取り出し元（`DiffSource`）を指定して文書を描かせる。サンプルの取り出し元のコードをそのまま指定するのに使用する */
export async function mountDiffFactory(
  page: Page,
  options: { markdown: string; docId: string; factory: string },
): Promise<void> {
  await page.evaluate(({ markdown, docId, factory }) => {
    const w = window as MdmarkWindow;
    const el = document.querySelector<HTMLElement>("#doc");
    if (!w.mdmark || !el) {
      throw new Error("mdmark か描く先の要素が無い");
    }
    const diffSource = new Function(`return (${factory})`)();
    w.handle = w.mdmark.mount(el, { markdown, docId, diffSource });
  }, options);
}

/** ページが記録した、取り出し元の呼び出しを返却する */
export async function readDiffCalls(
  page: Page,
): Promise<{ revisions: string[]; content: DiffContentCall[] }> {
  return page.evaluate(() => {
    const calls = (window as MdmarkWindow).diffCalls;
    if (!calls) {
      throw new Error("取り出し元を作っていない");
    }
    return JSON.parse(JSON.stringify(calls));
  });
}

/** ページの取り出し元の `revisions` を返却させる（`pendingRevisions` のとき） */
export async function releaseRevisions(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as MdmarkWindow).releaseRevisions?.();
  });
}

/** 範囲の `ts`・`js` の変換のライブラリを読み込む URL（`html-scripts.url` の既定） */
export const TRANSPILER_URL =
  "https://cdn.jsdelivr.net/npm/@babel/standalone@8.1.1/+esm";

/** 変換のライブラリ（開発の依存 `@babel/standalone` の UMD）の場所 */
const TRANSPILER_UMD_PATH = resolve(
  import.meta.dirname,
  "../../node_modules/@babel/standalone/babel.min.js",
);

/** 変換のライブラリへの要求を、`@babel/standalone` を既定のエクスポートを持つ ES モジュールに包んだ手元の応答に差し替え、受けた要求の件数を返却する関数を返却する。`status` が 404 のときは中身を返却しない */
export async function routeTranspiler(
  page: Page,
  status: 200 | 404 = 200,
): Promise<() => number> {
  let requests = 0;
  const body =
    status === 200
      ? `const module = { exports: {} };\nconst exports = module.exports;\n${await readFile(TRANSPILER_UMD_PATH, "utf8")}\nexport default module.exports;\n`
      : "";
  await page.route(TRANSPILER_URL, (route) => {
    requests += 1;
    return route.fulfill({
      status,
      body,
      contentType: "text/javascript",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  return () => requests;
}

/** 範囲の `ts`: 型の注釈を持ち、ノードを押すと根の要素に class `is-open` を付与・解除し、`destroy` で `window.__mdmarkDestroyed` を 1 増やす */
export const RANGE_TS = [
  "export default (root: HTMLElement): (() => void) => {",
  '  const box = root.querySelector<HTMLElement>(".box");',
  "  const onClick = (): void => {",
  '    root.classList.toggle("is-open");',
  "  };",
  '  box?.addEventListener("click", onClick);',
  "  return () => {",
  '    box?.removeEventListener("click", onClick);',
  "    const w = window as unknown as { __mdmarkDestroyed?: number };",
  "    w.__mdmarkDestroyed = (w.__mdmarkDestroyed ?? 0) + 1;",
  "  };",
  "};",
].join("\n");

/** 範囲の `css` がノードに付ける背景の色 */
export const RANGE_COLOR = "rgb(255, 0, 0)";

/** `<!-- html -->` の範囲に、`html`（`html` を省くと class `box` のノード 1 つ）と、`blocks` の言語ごとのコードブロックを配置した Markdown */
export function rangeMarkdown(
  blocks: Partial<Record<"css" | "ts" | "js", string>>,
  html = '<div class="box">箱</div>',
): string {
  return [
    "<!-- html -->",
    "",
    "```html",
    html,
    "```",
    "",
    ...(["css", "ts", "js"] as const).flatMap((lang) =>
      blocks[lang] === undefined
        ? []
        : [`\`\`\`${lang}`, blocks[lang], "```", ""],
    ),
    "<!-- /html -->",
    "",
  ].join("\n");
}

/** ノードの背景を `RANGE_COLOR` にする範囲の `css` */
export const RANGE_CSS = `.box { background-color: ${RANGE_COLOR}; }`;

/** 階層の表の行（キー・型・必須・既定・説明。親の `features`・`aliases[]`・`aliases[].metadata`・`aliases[].metadata.alias_type` の行を持たない） */
const TREE_ROWS = [
  "| キー | 型 | 必須 | 既定 | 説明 |",
  "| --- | --- | --- | --- | --- |",
  "| features.table | bool | ✓ | true | 表の機能 |",
  "| features.html | bool |  |  | 埋め込んだ HTML |",
  "| aliases[].id | string |  |  | 別名の ID |",
  "| aliases[].metadata.alias_type.type | ref \\| custom |  |  | 別名の種類 |",
];

/** 表のマーカーの `tree` に `extra.tree` のキーを、最上位に `extra.top` のキーを加えた、キーの列を階層で描く表の Markdown */
export function treeMarkdown(
  extra: { tree?: string; top?: string } = {},
): string {
  return [
    `<!-- table: {"kind": "data", "tree": {"key": {"column": "キー"}, "type": {"column": "型"}, "required": {"column": "必須"}, "default": {"column": "既定"}${extra.tree ?? ""}}${extra.top ?? ""}} -->`,
    "",
    ...TREE_ROWS,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 見本を結んだ階層の表と、見出し `設定の見本` の下の `最小`・`エイリアス` のタブを持つ Markdown */
export const TREE_EXAMPLE_MARKDOWN = [
  treeMarkdown({ tree: ', "example": {"heading": "設定の見本"}' }),
  "## 設定の見本",
  "",
  "<!-- tabs -->",
  "",
  "### 最小",
  "",
  "```yaml",
  "features:",
  "  table: true",
  "```",
  "",
  "### エイリアス",
  "",
  "```yaml",
  "aliases:",
  "  - id: terms",
  "    metadata:",
  "      alias_type:",
  "        type: custom",
  "```",
  "",
  "<!-- /tabs -->",
  "",
].join("\n");

/** パスの階層の行 */
export function treeRow(page: Page, path: string) {
  return page.locator(`#doc tr.mdmark-tree-row[data-path="${path}"]`);
}
