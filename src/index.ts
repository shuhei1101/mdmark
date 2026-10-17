export type { MdmarkConfig } from "./config.ts";
export type {
  MdmarkExtension,
  MdmarkExtensionModule,
  MdmarkMarkArgs,
} from "./extensions.ts";
export { registerExtension } from "./extensions.ts";
export type { MdmarkIndexIssue } from "./knowledge/check.ts";
export { checkIndex } from "./knowledge/check.ts";
export type { MdmarkIndex } from "./knowledge/index-shape.ts";
export type { MdmarkReferences } from "./knowledge/references.ts";
export { collectReferences } from "./knowledge/references.ts";
export type { MountHandle, MountOptions } from "./mount.ts";
export { mount } from "./mount.ts";
export { render } from "./render/index.ts";
export type { StandardSchemaV1 } from "./standard-schema.ts";

declare const __MDMARK_VERSION__: string;

/** ビルドで埋めた版（`v{MAJOR}.{MINOR}.{PATCH}`）を返す */
export function version(): string {
  return __MDMARK_VERSION__;
}
