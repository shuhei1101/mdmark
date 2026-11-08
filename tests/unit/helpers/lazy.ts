/** `import.meta.glob` で参照した実装を読み込む。ファイルが無い間は、テストの中で失敗させる（`import()` に直に記載すると、テストのファイルごと読み込めなくなる） */
export function loadSource<T>(
  loaders: Record<string, () => Promise<T>>,
): Promise<T> {
  const loader = Object.values(loaders)[0];
  if (loader === undefined) {
    return Promise.reject(new Error("実装のファイルがありません"));
  }
  return loader();
}
