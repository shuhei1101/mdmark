import { delay, type HttpHandler, HttpResponse, http } from "msw";

/** jsDelivr の mdmark の配布物の `index.js`（バージョンを問わない） */
export const DIST_JS_PATTERN =
  "https://cdn.jsdelivr.net/gh/shuhei1101/*/dist/index.js";

/** 応答の種類 */
export type DistHeadKind = "ok" | "versionMissing" | "offline" | "slow";

/** `slow` で応答を返すまで待つミリ秒 */
const SLOW_DELAY_MS = 3000;

/** 読めなかった配布物の `HEAD` に、応答の種類どおりに答えるハンドラを返す */
export const handlers = (kind: DistHeadKind): HttpHandler[] => [
  http.head(DIST_JS_PATTERN, async () => {
    switch (kind) {
      case "ok":
        return new HttpResponse(null, { status: 200 });
      case "versionMissing":
        return new HttpResponse(null, { status: 404 });
      case "offline":
        return HttpResponse.error();
      case "slow":
        await delay(SLOW_DELAY_MS);
        return new HttpResponse(null, { status: 200 });
      default: {
        const unknown: never = kind;
        throw new Error(`知らない応答の種類: ${String(unknown)}`);
      }
    }
  }),
];
