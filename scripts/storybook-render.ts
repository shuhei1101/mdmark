import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import { renderEmbed } from "../src/parts/embed.ts";
import { renderNotice } from "../src/parts/notice.ts";

// 描画の口を外へ出さないための待受アドレス
const RENDER_HOST = "127.0.0.1";
// 待ち受けるポートの範囲
const MIN_PORT = 1;
const MAX_PORT = 65535;
// リポジトリの直下
const REPO_ROOT = resolve(import.meta.dirname, "..");
// 描画の口の経路: 本文の CSS と、部品の HTML の前置き
const CSS_PATH = "/render/index.css";
const PART_PATH_PATTERN = /^\/render\/([^/]+)$/;

/** ストーリーの `server.id` の部品を、問い合わせの引数で描き、描く先の要素（class `mdmark`）で包んで返す。知らない部品は `undefined` */
export function renderPart(options: {
  /** 部品の id（`notice` か `embed`） */
  component: string;
  /** 問い合わせの引数 */
  params: URLSearchParams;
}): string | undefined {
  const { component, params } = options;
  const name = params.get("name") ?? "";
  if (component === "notice") {
    // 真偽値は問い合わせの文字列で届くため、`"false"` のときだけ偽にする
    const figure = params.get("figure") !== "false";
    return `<div class="mdmark">${renderNotice({ name, figure })}</div>`;
  }
  if (component === "embed") {
    // 配列はカンマで区切った 1 つの文字列で届く
    const joined = params.get("args") ?? "";
    const args = joined === "" ? [] : joined.split(",");
    return `<div class="mdmark">${renderEmbed({ name, args })}</div>`;
  }
  return undefined;
}

/** `GET /render/index.css` に `src/index.css` を、`GET /render/{部品の id}` に部品の HTML を返す HTTP サーバーを作る（待ち受けは呼び出し側） */
export function createRenderServer(options: {
  /** 作業ツリーの場所（`src/index.css` を読む） */
  root: string;
}): Server {
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${RENDER_HOST}`);
    if (url.pathname === CSS_PATH) {
      const css = readFileSync(join(options.root, "src", "index.css"), "utf8");
      response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      response.end(css);
      return;
    }
    const component = PART_PATH_PATTERN.exec(url.pathname)?.[1];
    if (component === undefined) {
      response.writeHead(404);
      response.end();
      return;
    }
    const html = renderPart({ component, params: url.searchParams });
    if (html === undefined) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`知らない部品: ${component}`);
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(html);
  });
}

/** 環境変数 `RENDER_PORT` のポートで、`RENDER_HOST` に描画の口を待ち受ける */
export function main(): void {
  const port = Number(process.env.RENDER_PORT);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    console.error(
      `RENDER_PORT は ${MIN_PORT}〜${MAX_PORT} の整数にする: ${process.env.RENDER_PORT}`,
    );
    process.exitCode = 1;
    return;
  }
  createRenderServer({ root: REPO_ROOT }).listen(port, RENDER_HOST);
}

// `node scripts/storybook-render.ts` で入口として実行されたときだけ流す
if (import.meta.main) {
  main();
}
