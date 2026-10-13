export type { MdmarkConfig } from "./config.ts";
export type { MountHandle, MountOptions } from "./mount.ts";
export { mount } from "./mount.ts";
export { render } from "./render/index.ts";

declare const __MDMARK_VERSION__: string;

/** ビルドで埋めた版（`v{MAJOR}.{MINOR}.{PATCH}`）を返す */
export function version(): string {
  return __MDMARK_VERSION__;
}
