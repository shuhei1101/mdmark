/** `navigator.clipboard.writeText` を差し替える（`undefined` を渡すとクリップボードが無い状態にする） */
export function stubClipboard(
  writeText: ((text: string) => Promise<void>) | undefined,
): void {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
  });
}

/** 差し替えたクリップボードを元に戻す */
export function restoreClipboard(): void {
  Reflect.deleteProperty(navigator, "clipboard");
}
