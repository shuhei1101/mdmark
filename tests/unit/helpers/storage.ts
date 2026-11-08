/** `Map` で包んだ `Storage` の形のオブジェクト（sessionStorage の代わりに渡す） */
export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  };
}

/** 読み書きのたびに例外を投げる `Storage` の形のオブジェクト */
export function throwingStorage(): Storage {
  const fail = (): never => {
    throw new Error("storage is not available");
  };
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}
