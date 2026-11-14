import type { MapSide } from "./data.ts";

export type { MapSide } from "./data.ts";

/** 図ごとに保つ状態 */
export type MapState = {
  collapsed: string[];
  entered: string | undefined;
  selected: string[];
  positions: Record<string, { x: number; y: number }>;
  /** 動かした線の区間のずらし。count は動かしたときの線の点の数（配置し直して変わったら捨てる） */
  wireShifts: Record<
    string,
    Array<{ segment: number; offset: number; count?: number }>
  >;
  attachments: Record<string, { from?: MapSide; to?: MapSide }>;
  order: string[] | undefined;
  height: number | undefined;
};

/** sessionStorage のキーの頭（`{頭}{pathname}{まとめた HTML の文書の経路}#{図の番号}`） */
export const MAP_STATE_KEY_PREFIX = "mdmark-map:";

/** クエリ文字列のキーの頭（`map-{図の番号}`） */
export const MAP_QUERY_PREFIX = "map-";

/** 空の状態 */
export const emptyMapState = (): MapState => ({
  collapsed: [],
  entered: undefined,
  selected: [],
  positions: {},
  wireShifts: {},
  attachments: {},
  order: undefined,
  height: undefined,
});

/** キー。まとめた HTML では文書ごとに分けるため、ハッシュの文書の経路（`#/a.md`）を足す */
const stateKey = (
  location: Pick<Location, "pathname" | "hash">,
  index: number,
) => {
  const route = /^#\/[^#]*/.exec(location.hash)?.[0] ?? "";
  return `${MAP_STATE_KEY_PREFIX}${location.pathname}${route}#${index}`;
};

/** sessionStorage を読み、取り出せないときは undefined */
const readStored = (
  storage: Storage | undefined,
  key: string,
): Partial<MapState> => {
  try {
    const text = storage?.getItem(key);
    if (!text) return {};
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null
      ? (value as Partial<MapState>)
      : {};
  } catch {
    return {};
  }
};

/** 保った値がオブジェクトならその値、それ以外は空のオブジェクト */
const objectOr = <T extends object>(
  value: T | undefined,
): T | Record<never, never> =>
  typeof value === "object" && value !== null ? value : {};

/** クエリ文字列 → sessionStorage → マーカーの focus の順に入るグループかブロックを決め、ほかの状態を sessionStorage から読む */
export const readMapState = (options: {
  index: number;
  ids: Set<string>;
  urlState: boolean;
  focus: string | undefined;
  /** 補足の layout の collapsed が true のグループ。保った開閉の状態が無いときに閉じる */
  collapsed: string[];
  storage: Storage | undefined;
  location: Pick<Location, "pathname" | "search" | "hash">;
}): MapState => {
  const stored = readStored(
    options.storage,
    stateKey(options.location, options.index),
  );
  const known = (id: unknown): id is string =>
    typeof id === "string" && options.ids.has(id);
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter(known) : [];
  const query = options.urlState
    ? new URLSearchParams(options.location.search).get(
        `${MAP_QUERY_PREFIX}${options.index}`,
      )
    : null;
  const entered = [query ?? undefined, stored.entered, options.focus].find(
    known,
  );
  return {
    ...emptyMapState(),
    collapsed: Array.isArray(stored.collapsed)
      ? list(stored.collapsed)
      : options.collapsed.filter(known),
    entered,
    selected: list(stored.selected),
    positions: objectOr(stored.positions),
    wireShifts: objectOr(stored.wireShifts),
    attachments: objectOr(stored.attachments),
    order: Array.isArray(stored.order)
      ? stored.order.filter((id): id is string => typeof id === "string")
      : undefined,
    height: typeof stored.height === "number" ? stored.height : undefined,
  };
};

/** sessionStorage に状態を書き、url_state が true なら入ったグループかブロックを history.replaceState でクエリ文字列に書く */
export const writeMapState = (options: {
  index: number;
  state: MapState;
  urlState: boolean;
  storage: Storage | undefined;
  history: Pick<History, "replaceState" | "state">;
  location: Pick<Location, "pathname" | "search" | "hash">;
}): void => {
  try {
    options.storage?.setItem(
      stateKey(options.location, options.index),
      JSON.stringify(options.state),
    );
  } catch (error) {
    console.warn(
      "map の図の状態を sessionStorage に保存できませんでした",
      error,
    );
  }
  if (!options.urlState) return;
  const params = new URLSearchParams(options.location.search);
  const key = `${MAP_QUERY_PREFIX}${options.index}`;
  if (options.state.entered === undefined) params.delete(key);
  else params.set(key, options.state.entered);
  const search = params.toString();
  const next = `${options.location.pathname}${search === "" ? "" : `?${search}`}${options.location.hash}`;
  const current = `${options.location.pathname}${options.location.search}${options.location.hash}`;
  if (next !== current)
    options.history.replaceState(options.history.state, "", next);
};
