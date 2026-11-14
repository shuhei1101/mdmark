import type { Logger } from "./log.ts";

/** `mdmark.version` の既定で、タグ一覧から最新を選ぶ値 */
export const LATEST = "latest";

/** 取得するタグの名前の構造（`vscode-` で始まるタグは合わない） */
export const VERSION_TAG_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

/** テストで差し替えないときのタグ一覧の最初のページの URL */
export const TAGS_URL =
  "https://api.github.com/repos/shuhei1101/mdmark/tags?per_page=100";

/** タグ一覧を全てのページ読み込み終えるまでの合計の待ちの上限（ミリ秒） */
export const TAGS_TIMEOUT_MS = 3000;

/** header `Link` の `rel="next"` の URL を取り出す正規表現 */
const NEXT_LINK_PATTERN = /<([^>]*)>\s*;\s*rel="next"/;

/** 読み込むバージョンの決まり方 */
export type VersionDecision =
  | { kind: "decided"; version: string; fetched: boolean }
  | { kind: "undecidable" };

/** タグ一覧から最新のバージョンを取る関数。取れなければ `undefined` */
export type FetchLatestVersion = () => Promise<string | undefined>;

/** `candidate` が `current` より新しいか（メジャー・マイナー・パッチの順に数で比べる） */
function isNewer(candidate: number[], current: number[]): boolean {
  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index] !== current[index]) {
      return (candidate[index] ?? 0) > (current[index] ?? 0);
    }
  }
  return false;
}

/** タグの名前から `VERSION_TAG_PATTERN` に合うものだけを取得し、メジャー・マイナー・パッチを数で比べた最大を返却する */
export function pickLatestVersion(names: string[]): string | undefined {
  let latest: { name: string; parts: number[] } | undefined;
  for (const name of names) {
    const match = VERSION_TAG_PATTERN.exec(name);
    if (!match) {
      continue;
    }
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (latest === undefined || isNewer(parts, latest.parts)) {
      latest = { name, parts };
    }
  }
  return latest?.name;
}

/** 応答の header `Link` から `rel="next"` の URL を取り出す。無ければ `undefined` */
export function nextPageUrl(link: string | null): string | undefined {
  return link === null ? undefined : NEXT_LINK_PATTERN.exec(link)?.[1];
}

/** タグ一覧の 1 ページを読み込み、タグの名前と次のページの URL を返却する。取れなければログを出して `undefined` */
async function fetchTagPage(options: {
  url: string;
  signal: AbortSignal;
  fetch: typeof fetch;
  log: Logger;
}): Promise<{ names: string[]; next: string | undefined } | undefined> {
  const { url, signal, log } = options;
  let response: Response;
  let body: unknown;
  try {
    response = await options.fetch(url, {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
    body = response.ok ? await response.json() : undefined;
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    log.warn("タグ一覧を取れない", url, reason.name, reason.message);
    return undefined;
  }
  if (!response.ok || !Array.isArray(body)) {
    log.warn("タグ一覧を取れない", url, response.status);
    return undefined;
  }
  const names = body
    .filter((entry) => typeof entry?.name === "string")
    .map((entry) => entry.name as string);
  return { names, next: nextPageUrl(response.headers.get("Link")) };
}

/** タグ一覧を `rel="next"` が無くなるまで辿り、最新のバージョンを返却する。取れなければ例外を投げず `undefined` */
export async function fetchLatestVersion(options: {
  /** 最初のページの URL */
  url: string;
  /** 全てのページを読み込み終えるまでの合計の待ちの上限（ミリ秒） */
  timeoutMs: number;
  /** 要求に使用する `fetch` */
  fetch: typeof fetch;
  /** ログの出力先 */
  log: Logger;
}): Promise<string | undefined> {
  const { timeoutMs, log } = options;
  // 全てのページの要求に同じ中断の合図を指定し、合計の待ちにする
  const signal = AbortSignal.timeout(timeoutMs);
  const names: string[] = [];
  let url: string | undefined = options.url;
  while (url !== undefined) {
    const page = await fetchTagPage({ url, signal, fetch: options.fetch, log });
    if (page === undefined) {
      return undefined;
    }
    names.push(...page.names);
    url = page.next;
  }
  const latest = pickLatestVersion(names);
  if (latest === undefined) {
    log.warn("mdmark のバージョンのタグが無い", names.length);
  }
  return latest;
}

/** `mdmark.version` が `latest` ならタグ一覧の最新を、取れなければ前回のバージョンを、`latest` でなければ記載したバージョンを使用する */
export async function decideVersion(options: {
  /** `mdmark.version` の値 */
  setting: string;
  /** `globalState` の `mdmark.lastVersion` */
  lastVersion: string | undefined;
  /** 最新のバージョンを取る関数 */
  fetchLatest: FetchLatestVersion;
  /** ログの出力先 */
  log: Logger;
}): Promise<VersionDecision> {
  const { setting, lastVersion, fetchLatest, log } = options;
  if (setting !== LATEST) {
    return { kind: "decided", version: setting, fetched: false };
  }
  const latest = await fetchLatest();
  if (latest !== undefined) {
    return { kind: "decided", version: latest, fetched: true };
  }
  if (lastVersion !== undefined) {
    log.info("前回のバージョンで描く", lastVersion);
    return { kind: "decided", version: lastVersion, fetched: false };
  }
  log.warn("読み込むバージョンを決められない");
  return { kind: "undecidable" };
}
