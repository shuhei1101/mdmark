declare const __MDMARK_VERSION__: string;

/** 手元の版・パッケージの版・移行の手順のフォルダ名が合うべき書式 */
export const VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

/** `v{MAJOR}.{MINOR}.{PATCH}` を 3 つの数にする。書式が違えば `undefined` */
export function parseVersion(
  text: string,
): [number, number, number] | undefined {
  const match = VERSION_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** 2 つの版を MAJOR・MINOR・PATCH の順に数として比べ、`a` が古ければ -1、同じなら 0、新しければ 1 を返す */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new Error(`版の書式が違います: ${left ? b : a}`);
  }
  for (const [index, value] of left.entries()) {
    const other = right[index] ?? 0;
    if (value !== other) {
      return value < other ? -1 : 1;
    }
  }
  return 0;
}

/** ビルドが `dist/cli.js` に埋めた、呼んだ CLI の版を返す */
export function cliVersion(): string {
  return __MDMARK_VERSION__;
}
