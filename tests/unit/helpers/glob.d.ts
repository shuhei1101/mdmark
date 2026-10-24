/** Vite の `import.meta.glob`（パターンに合うファイルが無ければ空の表を返す） */
interface ImportMeta {
  glob<T>(pattern: string): Record<string, () => Promise<T>>;
}
