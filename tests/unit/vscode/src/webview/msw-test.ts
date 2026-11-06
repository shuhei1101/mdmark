import { setupWorker } from "msw/browser";
import { test as base } from "vitest";

/** MSW の Service Worker（ハンドラは各テストが `worker.use` で足す） */
const worker = setupWorker();

/** MSW の Service Worker をテストの間だけ動かす `test`（MSW の Vitest Browser Mode の構成） */
export const test = base.extend<{ worker: typeof worker }>({
  worker: [
    async ({}, use) => {
      await worker.start({ quiet: true, onUnhandledRequest: "bypass" });
      await use(worker);
      worker.resetHandlers();
      worker.stop();
    },
    { auto: true },
  ],
});
