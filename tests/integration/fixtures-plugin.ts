import type { Plugin } from "vite";

// 外部ライブラリの代役のモジュール: `draw(slot, args)` で `slot` の文字を `drawn:` と引数を `,` で結んだものにする
const TEST_LIB_SOURCE = `export function draw(slot, args) {
  slot.textContent = "drawn:" + args.join(",");
}
`;

/** 結合テストの開発サーバーに、外部ライブラリの代役 `/fixtures/test-lib.js` と、404 を返す `/fixtures/missing.js` を足す */
export function fixturesPlugin(): Plugin {
  return {
    name: "mdmark-fixtures",
    configureServer(server) {
      server.middlewares.use("/fixtures/test-lib.js", (_request, response) => {
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.end(TEST_LIB_SOURCE);
      });
      server.middlewares.use("/fixtures/missing.js", (_request, response) => {
        response.statusCode = 404;
        response.end();
      });
    },
  };
}
