export type {
  MdmarkComment,
  MdmarkCommentDraft,
  MdmarkCommentStore,
  MdmarkCommentsHandle,
} from "./comments/spec.ts";
export type { MdmarkConfig } from "./config.ts";
export type {
  MdmarkChartDefinition,
  MdmarkFlowDefinition,
  MdmarkParamDefinition,
  MdmarkSequenceDefinition,
} from "./diagram/definition.ts";
export type { DiffRevision, DiffSource } from "./diff/source.ts";
export type {
  MdmarkExtension,
  MdmarkExtensionModule,
  MdmarkMarkArgs,
} from "./extensions.ts";
export { registerExtension } from "./extensions.ts";
export type { MdmarkIndexIssue } from "./knowledge/check.ts";
export { checkIndex } from "./knowledge/check.ts";
export type { MdmarkIndex } from "./knowledge/index-shape.ts";
export type {
  MdmarkMatch,
  MdmarkMatches,
  MdmarkMatchTarget,
} from "./knowledge/matches.ts";
export { collectMatches } from "./knowledge/matches.ts";
export type { MdmarkReferences } from "./knowledge/references.ts";
export { collectReferences } from "./knowledge/references.ts";
export type { MountHandle, MountOptions } from "./mount.ts";
export { mount } from "./mount.ts";
export { mountComments, mountView } from "./mount-parts.ts";
export { render } from "./render/index.ts";
export type { StandardSchemaV1 } from "./standard-schema.ts";
export type { MdmarkViewHandle, MdmarkViewOptions } from "./views/spec.ts";

declare const __MDMARK_VERSION__: string;

/** ビルドで埋めた版（`v{MAJOR}.{MINOR}.{PATCH}`）を返す */
export function version(): string {
  return __MDMARK_VERSION__;
}
