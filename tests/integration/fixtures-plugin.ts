import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";
import type { Plugin } from "vite";

// 外部ライブラリの代役のモジュール: `draw(slot, args)` で `slot` の文字を `drawn:` と引数を `,` で結んだものにする
const TEST_LIB_SOURCE = `export function draw(slot, args) {
  slot.textContent = "drawn:" + args.join(",");
}
`;

// 拡張のモジュールの代役: `draw(slot, value)` で `slot` の文字を `value` の JSON にする
const GREET_SOURCE = `export function draw(slot, value) {
  slot.textContent = JSON.stringify(value);
}
`;

// 部品の定義を受ける拡張のモジュールの代役: `draw(slot, value)` で `slot` の文字を `value.definition.title` と `value.definition.items` の数にする
const DEFINITION_SOURCE = `export function draw(slot, value) {
  slot.textContent = value.definition.title + " " + value.definition.items.length;
}
`;

// ビルドした配布物を写して配る経路の頭。`/fixtures/dist/{名前}{配布物のファイルの絶対パス}` で引く
const DIST_COPY_PREFIX = "/fixtures/dist/";
// 配布物を写して配るときに、404 を返す部品のモジュール（名前が `blocked` のとき）
const BLOCKED_NAME = "blocked";
const BLOCKED_FILES = ["view.js", "comments.js"];
// 配布物を置く一時フォルダの頭（`global-setup.ts` が作る）
const BUILT_ROOT_PREFIX = "mdmark-integration-dist-";
// ファイルの拡張子から Content-Type を引く表
const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/** 結合テストの開発サーバーに、外部ライブラリの代役 `/fixtures/test-lib.js`・拡張の代役 `/fixtures/greet.js`・部品の定義を受ける拡張の代役 `/fixtures/definition.js` と、404 を返す `/fixtures/missing.js` を足す。ビルドした配布物は `/fixtures/dist/{名前}{絶対パス}` でも配り、名前ごとに別の URL にして、ページの中のモジュールの読み込み済みを分ける（名前が `blocked` のときは部品のモジュール `view.js`・`comments.js` を 404 にする） */
export function fixturesPlugin(): Plugin {
  return {
    name: "mdmark-fixtures",
    configureServer(server) {
      server.middlewares.use("/fixtures/test-lib.js", (_request, response) => {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(TEST_LIB_SOURCE);
      });
      server.middlewares.use("/fixtures/greet.js", (_request, response) => {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(GREET_SOURCE);
      });
      server.middlewares.use(
        "/fixtures/definition.js",
        (_request, response) => {
          response.setHeader("Content-Type", "text/javascript; charset=utf-8");
          response.end(DEFINITION_SOURCE);
        },
      );
      server.middlewares.use("/fixtures/missing.js", (_request, response) => {
        response.statusCode = 404;
        response.end();
      });
      server.middlewares.use(DIST_COPY_PREFIX, (request, response) => {
        const [, name = "", ...rest] =
          (request.url ?? "").split("?")[0]?.split("/") ?? [];
        const file = resolve(`/${rest.join("/")}`);
        const allowed = file.startsWith(join(tmpdir(), BUILT_ROOT_PREFIX));
        const blocked =
          name === BLOCKED_NAME && BLOCKED_FILES.includes(basename(file));
        if (!allowed || blocked || file.split(sep).includes("..")) {
          response.statusCode = 404;
          response.end();
          return;
        }
        readFile(file).then(
          (body) => {
            response.setHeader(
              "Content-Type",
              CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
            );
            response.end(body);
          },
          () => {
            response.statusCode = 404;
            response.end();
          },
        );
      });
    },
  };
}
