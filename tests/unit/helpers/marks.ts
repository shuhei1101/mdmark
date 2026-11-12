import type { Mark } from "../../../src/render/marks.ts";

/** 名前と JSON のオブジェクトの設定から、開きのマーカーを作る（設定を省くと引数の無いマーカー） */
export const jsonMark = (
  name: string,
  options?: Record<string, unknown>,
): Mark => ({
  name,
  options: options ?? {},
  source: options === undefined ? "none" : "json",
  problems: [],
  unknownKeys: [],
  raw:
    options === undefined
      ? `<!-- ${name} -->`
      : `<!-- ${name}: ${JSON.stringify(options)} -->`,
  closing: false,
});
