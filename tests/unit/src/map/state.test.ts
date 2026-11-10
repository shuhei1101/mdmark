import { expect, test } from "vitest";
import { memoryStorage } from "../../helpers/storage.ts";

/** 図の状態の読み書きを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadState = () => import("../../../../src/map/state.ts");

const IDS = new Set(["lib", "read", "place", "store"]);
const KEY = "mdmark-map:/a.html#1";

/** 検索文字列を持つ Location の代わり */
const at = (search: string) =>
  ({ pathname: "/a.html", search, hash: "" }) as Location;

/** sessionStorage に状態を入れた Storage */
function stored(state: object): Storage {
  const storage = memoryStorage();
  storage.setItem(KEY, JSON.stringify(state));
  return storage;
}

/** replaceState の呼び出しを記録する History の代わり */
function recordingHistory() {
  const calls: string[] = [];
  const history = {
    length: 1,
    state: null,
    replaceState: (_state: unknown, _title: string, url: string) =>
      calls.push(url),
  } as unknown as History;
  return { history, calls };
}

// クエリ文字列を先に読む（正常系）
test("test_read_map_state_when_query", async () => {
  // 準備
  const { readMapState } = await loadState();
  // 実行
  const state = readMapState({
    index: 1,
    ids: IDS,
    urlState: true,
    focus: undefined,
    storage: stored({ entered: "place" }),
    location: at("?map-1=read"),
  });
  // 検証
  expect(state.entered).toBe("read");
});

// url_state が false（正常系）
test("test_read_map_state_when_url_state_off", async () => {
  // 準備
  const { readMapState } = await loadState();
  // 実行
  const state = readMapState({
    index: 1,
    ids: IDS,
    urlState: false,
    focus: undefined,
    storage: stored({ entered: "place" }),
    location: at("?map-1=read"),
  });
  // 検証
  expect(state.entered).toBe("place");
});

// 知らない ID（正常系）
test("test_read_map_state_when_unknown_id", async () => {
  // 準備
  const { readMapState } = await loadState();
  // 実行
  const state = readMapState({
    index: 1,
    ids: IDS,
    urlState: true,
    focus: undefined,
    storage: memoryStorage(),
    location: at("?map-1=ghost"),
  });
  // 検証
  expect(state.entered).toBeUndefined();
});

// sessionStorage が無い（正常系）
test("test_read_map_state_when_storage_unavailable", async () => {
  // 準備
  const { readMapState } = await loadState();
  // 実行
  const state = readMapState({
    index: 1,
    ids: IDS,
    urlState: true,
    focus: undefined,
    storage: undefined,
    location: at(""),
  });
  // 検証
  expect(state).toMatchObject({
    collapsed: [],
    entered: undefined,
    selected: [],
  });
});

// focus だけ（正常系）
test("test_read_map_state_when_focus", async () => {
  // 準備
  const { readMapState } = await loadState();
  // 実行
  const state = readMapState({
    index: 1,
    ids: IDS,
    urlState: true,
    focus: "read",
    storage: memoryStorage(),
    location: at(""),
  });
  // 検証
  expect(state.entered).toBe("read");
});

// 保った状態を優先（正常系）
test("test_read_map_state_when_saved_over_focus", async () => {
  // 準備
  const { readMapState } = await loadState();
  // 実行
  const state = readMapState({
    index: 1,
    ids: IDS,
    urlState: true,
    focus: "read",
    storage: stored({ entered: "place" }),
    location: at(""),
  });
  // 検証
  expect(state.entered).toBe("place");
});

// 中へ入る（正常系）
test("test_write_map_state", async () => {
  // 準備
  const { writeMapState, readMapState } = await loadState();
  const storage = memoryStorage();
  const { history, calls } = recordingHistory();
  const state = {
    ...readMapState({
      index: 1,
      ids: IDS,
      urlState: true,
      focus: undefined,
      storage,
      location: at(""),
    }),
    entered: "read",
  };
  // 実行
  writeMapState({
    index: 1,
    state,
    urlState: true,
    storage,
    history,
    location: at("?x=1"),
  });
  // 検証
  expect(JSON.parse(storage.getItem(KEY) ?? "{}").entered).toBe("read");
  expect(calls).toEqual(["/a.html?x=1&map-1=read"]);
  expect(history.length).toBe(1);
});

// url_state が false（正常系）
test("test_write_map_state_when_url_state_off", async () => {
  // 準備
  const { writeMapState, readMapState } = await loadState();
  const storage = memoryStorage();
  const { history, calls } = recordingHistory();
  const state = {
    ...readMapState({
      index: 1,
      ids: IDS,
      urlState: false,
      focus: undefined,
      storage,
      location: at(""),
    }),
    entered: "read",
  };
  // 実行
  writeMapState({
    index: 1,
    state,
    urlState: false,
    storage,
    history,
    location: at(""),
  });
  // 検証
  expect(calls).toEqual([]);
});

// 全体に戻る（正常系）
test("test_write_map_state_when_left", async () => {
  // 準備
  const { writeMapState, readMapState } = await loadState();
  const storage = memoryStorage();
  const { history, calls } = recordingHistory();
  const state = {
    ...readMapState({
      index: 1,
      ids: IDS,
      urlState: true,
      focus: undefined,
      storage,
      location: at(""),
    }),
    entered: undefined,
  };
  // 実行
  writeMapState({
    index: 1,
    state,
    urlState: true,
    storage,
    history,
    location: at("?map-1=read"),
  });
  // 検証
  expect(calls).toEqual(["/a.html"]);
});
