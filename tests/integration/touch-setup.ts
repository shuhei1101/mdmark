import { beforeEach } from "vitest";

// タッチの点があるプロジェクト（integration-browser-touch）では、名前が _by_touch で終わるテストだけを動かす
beforeEach((context) => {
  if (!context.task.name.endsWith("_by_touch")) {
    context.skip();
  }
});
