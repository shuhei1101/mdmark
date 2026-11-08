/** Vite の `import.meta.glob`（パターンに合うファイルが無ければ空の表を返却する） */
interface ImportMeta {
  glob<T>(pattern: string): Record<string, () => Promise<T>>;
}
