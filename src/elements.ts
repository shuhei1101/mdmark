import { defineTableElement } from "./table/mdmark-table.element.ts";

/** 配布物が登録するカスタム要素の登録する関数。部品のカスタム要素を追加するときは、この並びに 1 つ加える */
export const ELEMENT_DEFINERS: ReadonlyArray<
  (registry: CustomElementRegistry) => void
> = [defineTableElement];

/** `customElements` があれば、配布物が持つカスタム要素を登録する（Node では何もしない） */
export const defineElements = (): void => {
  const registry: CustomElementRegistry | undefined = globalThis.customElements;
  if (!registry) {
    return;
  }
  for (const define of ELEMENT_DEFINERS) {
    define(registry);
  }
};
