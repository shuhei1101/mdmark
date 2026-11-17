declare const __MDMARK_VERSION__: string;

/** 手元のバージョン・パッケージのバージョン・移行の手順のフォルダ名が合うべき書式 */
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

/** 2 つのバージョンを MAJOR・MINOR・PATCH の順に数として比べ、`a` が古ければ -1、同じなら 0、新しければ 1 を返却する */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    throw new Error(`バージョンの書式が違います: ${left ? b : a}`);
  }
  for (const [index, value] of left.entries()) {
    const other = right[index] ?? 0;
    if (value !== other) {
      return value < other ? -1 : 1;
    }
  }
  return 0;
}

/** ビルドが `dist/cli.js` に埋めた、呼んだ CLI のバージョンを返却する */
export function cliVersion(): string {
  return __MDMARK_VERSION__;
}

/** develop の最新を表す手元のバージョン */
export const DEVELOP_VERSION = "develop";

/** ビルドが `--develop` で埋めたバージョン（ビルドメタデータ付き）の書式 */
export const DEVELOP_BUILD_PATTERN =
  /^(v\d+\.\d+\.\d+)\+develop\.[0-9a-f]{7,}$/;

/** 埋めたバージョンが develop のビルドか */
export function isDevelopBuild(version: string): boolean {
  return DEVELOP_BUILD_PATTERN.test(version);
}

/** develop のビルドは `+` より前を、それ以外はそのまま返却する */
export function releaseVersionOf(version: string): string {
  return DEVELOP_BUILD_PATTERN.exec(version)?.[1] ?? version;
}

/** 設定に記載する手元のバージョン（develop のビルドは `develop`） */
export function localVersionOf(version: string): string {
  return isDevelopBuild(version) ? DEVELOP_VERSION : version;
}

/** 手元のバージョンとして受け付けるか（`VERSION_PATTERN` か `develop`） */
export function isLocalVersion(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value === DEVELOP_VERSION || VERSION_PATTERN.test(value))
  );
}
