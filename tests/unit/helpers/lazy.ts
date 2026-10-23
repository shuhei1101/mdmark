/** `import.meta.glob` で引いた実装を読む。ファイルが無い間は、テストの中で失敗させる（`import()` に直に書くと、テストのファイルごと読み込めなくなる） */
export function loadSource<T>(
  loaders: Record<string, () => Promise<T>>,
): Promise<T> {
  const loader = Object.values(loaders)[0];
  if (loader === undefined) {
    return Promise.reject(new Error("実装のファイルがありません"));
  }
  return loader();
}
