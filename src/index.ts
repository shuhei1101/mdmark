export type {
  MdmarkComment,
  MdmarkCommentDraft,
  MdmarkCommentStore,
  MdmarkCommentsHandle,
} from "./comments/spec.ts";
export type { MdmarkConfig } from "./config.ts";
export type {
  MdmarkChartDefinition,
  MdmarkParamDefinition,
} from "./diagram/definition.ts";
export type { DiffMode, DiffRevision, DiffSource } from "./diff/source.ts";
export { diffModes } from "./diff/source.ts";
export type {
  MdmarkExtension,
  MdmarkExtensionModule,
  MdmarkMarkArgs,
} from "./extensions.ts";
export { registerExtension } from "./extensions.ts";
export type {
  MdmarkAlias,
  MdmarkAliasDetail,
  MdmarkAliasProblem,
  MdmarkAliasSource,
  MdmarkAliasType,
} from "./knowledge/aliases.ts";
export { buildAliases } from "./knowledge/aliases.ts";
export type { MdmarkIndexIssue } from "./knowledge/check.ts";
export { checkIndex } from "./knowledge/check.ts";
export type {
  MdmarkIndex,
  MdmarkIndexDocTag,
  MdmarkIndexRelated,
  MdmarkRelationType,
} from "./knowledge/index-shape.ts";
export type {
  MdmarkAvoidedMatch,
  MdmarkMatch,
  MdmarkMatches,
  MdmarkMatchTarget,
} from "./knowledge/matches.ts";
export { collectMatches } from "./knowledge/matches.ts";
export type { MdmarkReferences } from "./knowledge/references.ts";
export { collectReferences } from "./knowledge/references.ts";
export type {
  FigureToMarkdown,
  MdmarkFigure,
  PureMarkdownOptions,
  PureMarkdownResult,
} from "./markdown/pure-markdown.ts";
export { toPureMarkdown } from "./markdown/pure-markdown.ts";
export type {
  MdmarkColumnsChange,
  MdmarkRendered,
  MountHandle,
  MountOptions,
  RenderForMountOptions,
} from "./mount.ts";
export { mount, renderForMount } from "./mount.ts";
export { mountComments, mountView } from "./mount-parts.ts";
export { setPartModuleLoader } from "./part-modules.ts";
export { render } from "./render/index.ts";
export type { MdmarkIconNode } from "./shared/icon-node.logic.ts";
export type { StandardSchemaV1 } from "./standard-schema.ts";
export type { MdmarkViewHandle, MdmarkViewOptions } from "./views/spec.ts";

import type {
  MdmarkCommentEditDetail,
  MdmarkCommentRemoveDetail,
  MdmarkCommentsElement,
} from "./comments/mdmark-comments.element.ts";
import type { MdmarkCommentDraft } from "./comments/spec.ts";
import type {
  MdmarkGraphElement,
  MdmarkParamChangeDetail,
  MdmarkParamGraphElement,
} from "./diagram/mdmark-graph.element.ts";
import { defineElements } from "./elements.ts";
import type {
  MdmarkMapElement,
  MdmarkNodeClickDetail,
} from "./map/mdmark-map.element.ts";
import type {
  MdmarkTableCellEditDetail,
  MdmarkTableElement,
  MdmarkTableRowClickDetail,
} from "./table/mdmark-table.element.ts";
import type {
  MdmarkViewElement,
  MdmarkViewItemClickDetail,
} from "./views/mdmark-view.element.ts";

export type {
  MdmarkCommentEditDetail,
  MdmarkCommentRemoveDetail,
  MdmarkCommentsElement,
} from "./comments/mdmark-comments.element.ts";
export type {
  MdmarkGraphElement,
  MdmarkParamChangeDetail,
  MdmarkParamGraphElement,
} from "./diagram/mdmark-graph.element.ts";
export type {
  MdmarkMapElement,
  MdmarkNodeClickDetail,
} from "./map/mdmark-map.element.ts";
export type {
  MdmarkTableCellEditDetail,
  MdmarkTableElement,
  MdmarkTableRowClickDetail,
} from "./table/mdmark-table.element.ts";
export type {
  MdmarkTableColumn,
  MdmarkTableFeatures,
  MdmarkTableRow,
  MdmarkTableValue,
} from "./table/mdmark-table.logic.ts";
export type {
  MdmarkViewElement,
  MdmarkViewItem,
  MdmarkViewItemClickDetail,
} from "./views/mdmark-view.element.ts";

declare global {
  interface HTMLElementTagNameMap {
    "mdmark-table": MdmarkTableElement;
    "mdmark-view": MdmarkViewElement;
    "mdmark-comments": MdmarkCommentsElement;
    "mdmark-graph": MdmarkGraphElement;
    "mdmark-param-graph": MdmarkParamGraphElement;
    "mdmark-map": MdmarkMapElement;
  }
  interface HTMLElementEventMap {
    "mdmark-row-click": CustomEvent<MdmarkTableRowClickDetail>;
    "mdmark-cell-edit": CustomEvent<MdmarkTableCellEditDetail>;
    "mdmark-row-add": CustomEvent<Record<string, never>>;
    "mdmark-item-click": CustomEvent<MdmarkViewItemClickDetail>;
    "mdmark-comment-save": CustomEvent<MdmarkCommentDraft>;
    "mdmark-comment-edit": CustomEvent<MdmarkCommentEditDetail>;
    "mdmark-comment-remove": CustomEvent<MdmarkCommentRemoveDetail>;
    "mdmark-param-change": CustomEvent<MdmarkParamChangeDetail>;
    "mdmark-node-click": CustomEvent<MdmarkNodeClickDetail>;
  }
}

declare const __MDMARK_VERSION__: string;

/** ビルドで埋めたバージョン（`v{MAJOR}.{MINOR}.{PATCH}`）を返却する */
export function version(): string {
  return __MDMARK_VERSION__;
}
export type { PageSettings as MdmarkPageSettings } from "./config.ts";

defineElements();
