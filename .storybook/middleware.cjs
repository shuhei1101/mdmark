"use strict";

const http = require("node:http");

/** Storybook の開発サーバーの `/render` への要求を、環境変数 `RENDER_ORIGIN` の描画の口へそのまま中継する */
module.exports = function relayRender(router) {
  // 起動時に確かめ、設定が無ければ Storybook を起こさない
  const origin = new URL(process.env.RENDER_ORIGIN);
  router.use("/render", (request, response) => {
    const upstream = http.request(
      new URL(request.originalUrl, origin),
      {
        method: request.method,
        headers: { ...request.headers, host: origin.host },
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode,
          upstreamResponse.headers,
        );
        upstreamResponse.pipe(response);
      },
    );
    // 描画の口に届かないときは 502 とエラーの文字列を返す
    upstream.on("error", (error) => {
      response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(String(error));
    });
    request.pipe(upstream);
  });
};
