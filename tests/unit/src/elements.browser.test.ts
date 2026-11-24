import { expect, test } from "vitest";

/** カスタム要素の登録を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadElements = () => import("../../../src/elements.ts");
/** 表のカスタム要素を読み込む */
const loadTableElement = () =>
  import("../../../src/table/mdmark-table.element.ts");

// ページでは mdmark-table を登録する（正常系）
test("test_define_elements", async () => {
  // 準備
  const { defineElements } = await loadElements();
  const { MdmarkTableElement } = await loadTableElement();
  // 実行
  defineElements();
  // 検証
  expect(customElements.get("mdmark-table")).toBe(MdmarkTableElement);
});

// customElements が無ければ何もしない（正常系）
test("test_define_elements_when_no_registry", async () => {
  // 準備
  const { defineElements } = await loadElements();
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "customElements",
  );
  Object.defineProperty(globalThis, "customElements", {
    value: undefined,
    configurable: true,
  });
  // 実行
  const call = () => defineElements();
  // 検証
  try {
    expect(call).not.toThrow();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "customElements", descriptor);
    }
  }
});
