import { DEFAULT_FEATURES } from "../../../src/config.ts";
import type { RenderEnv } from "../../../src/render/parser.ts";

/** 解析器に渡す env の mdmark が出した要素の印 */
const NONCE = "test-nonce";

/** 知っている機能を全てオフにした機能のオン・オフ */
export function featuresOff(): Record<string, boolean> {
  return Object.fromEntries(
    Object.keys(DEFAULT_FEATURES).map((k) => [k, false]),
  );
}

/** 解析器に渡す env を作る（機能は既定、`overrides` で上書きする） */
export function createEnv(overrides: Partial<RenderEnv> = {}): RenderEnv {
  return {
    libraries: {},
    defaults: { ...DEFAULT_FEATURES },
    featureArgs: [],
    features: {},
    headings: [],
    nonce: NONCE,
    ownGlossary: [],
    ...overrides,
  };
}
