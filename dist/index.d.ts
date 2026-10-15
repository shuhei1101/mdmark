export type { MdmarkConfig } from "./config.ts";
export type { MdmarkExtension, MdmarkExtensionModule, MdmarkMarkArgs, } from "./extensions.ts";
export { registerExtension } from "./extensions.ts";
export type { MountHandle, MountOptions } from "./mount.ts";
export { mount } from "./mount.ts";
export { render } from "./render/index.ts";
export type { StandardSchemaV1 } from "./standard-schema.ts";
/** ビルドで埋めた版（`v{MAJOR}.{MINOR}.{PATCH}`）を返す */
export declare function version(): string;
