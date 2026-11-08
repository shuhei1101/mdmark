import { setupWorker } from "msw/browser";
import { test as base } from "vitest";

/** MSW の Service Worker（ハンドラは各テストが `worker.use` で追加する） */
const worker = setupWorker();

/** MSW の Service Worker をテストの間だけ動かす `test`（MSW の Vitest Browser Mode の構成） */
export const test = base.extend<{ worker: typeof worker }>({
  worker: [
    // biome-ignore lint/correctness/noEmptyPattern: Vitest のフィクスチャは 1 つ目の引数を分割代入で受ける決まり
    async ({}, use) => {
      await worker.start({ quiet: true, onUnhandledFrame: "bypass" });
      await use(worker);
      worker.resetHandlers();
      worker.stop();
    },
    { auto: true },
  ],
});
