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

/** 結合テストの開発サーバーに、外部ライブラリの代役 `/fixtures/test-lib.js`・拡張の代役 `/fixtures/greet.js` と、404 を返す `/fixtures/missing.js` を足す */
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
      server.middlewares.use("/fixtures/missing.js", (_request, response) => {
        response.statusCode = 404;
        response.end();
      });
    },
  };
}
