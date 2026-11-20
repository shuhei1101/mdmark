import { escapeHtml } from "../shared/escape.logic.ts";
import { iconSvg } from "../shared/icons.part.ts";
import type { MapChange } from "./data.ts";
import { MAP_CHANGE_LABELS, mapChangeBadge } from "./map.part.ts";

/** 部品『mapの一覧』の項目 */
export type MapListItem = {
  /** ノード・グループの ID かメッセージの番号 */
  id: string;
  /** 名前かメッセージの項目の文字 */
  name: string;
  /** 種類の名前 */
  kind?: string | undefined;
  /** 補足の notes の説明 */
  note?: string | undefined;
  /** 出る線の文字 */
  out: string[];
  /** 計画した変更 */
  change?: MapChange | undefined;
  /** グループの中の項目 */
  children?: MapListItem[] | undefined;
};

/** 部品『mapの一覧』の引数 */
export type MapListArgs = {
  /** 一覧のスクリーンリーダー向けの名前 */
  label: string;
  items: MapListItem[];
  /** 閉じた子を持つ項目の ID */
  collapsed?: string[] | undefined;
  /** `tabindex="0"` を持たせる項目の ID（省くと最初の項目） */
  focused?: string | undefined;
};

/** 項目のスクリーンリーダー向けの名前（名前・変更の名前・種類・説明・出る線の数の順。持たないものは飛ばす） */
const itemLabel = (item: MapListItem): string =>
  [
    item.name,
    item.change === undefined ? undefined : MAP_CHANGE_LABELS[item.change],
    item.kind,
    item.note,
    item.out.length === 0 ? undefined : `出る線 ${item.out.length} 本`,
  ]
    .filter((part) => part !== undefined && part !== "")
    .join("、");

/** 項目の名前の行の中身（山形・名前・変更のバッジ・種類・説明・出る線） */
const itemRow = (item: MapListItem, hasChildren: boolean): string => {
  const toggle = `<span class="mdmark-map-list-toggle" aria-hidden="true">${hasChildren ? iconSvg("chevron-down") : ""}</span>`;
  const badge = item.change === undefined ? "" : mapChangeBadge(item.change);
  const kind =
    item.kind === undefined
      ? ""
      : `<span class="mdmark-map-list-kind">${escapeHtml(item.kind)}</span>`;
  const note =
    item.note === undefined
      ? ""
      : `<span class="mdmark-map-list-note">${escapeHtml(item.note)}</span>`;
  const out = item.out
    .map(
      (line) => `<span class="mdmark-map-list-out">${escapeHtml(line)}</span>`,
    )
    .join("");
  return `<div class="mdmark-map-list-row">${toggle}<span class="mdmark-map-list-name">${escapeHtml(item.name)}</span>${badge}${kind}${note}${out}</div>`;
};

/** 一覧の項目 1 つ（子を持てば入れ子の `role="group"` を持つ） */
const renderItem = (
  item: MapListItem,
  context: { level: number; collapsed: Set<string>; focused: string },
): string => {
  const { level, collapsed, focused } = context;
  const children = item.children ?? [];
  const hasChildren = children.length > 0;
  const open = !collapsed.has(item.id);
  const expanded = hasChildren ? ` aria-expanded="${open}"` : "";
  const change =
    item.change === undefined ? "" : ` data-change="${item.change}"`;
  const group = hasChildren
    ? `<ul role="group"${open ? "" : " hidden"}>${children
        .map((child) => renderItem(child, { ...context, level: level + 1 }))
        .join("")}</ul>`
    : "";
  return `<li class="mdmark-map-list-item" role="treeitem" data-id="${escapeHtml(item.id)}" aria-level="${level}" tabindex="${item.id === focused ? "0" : "-1"}" aria-label="${escapeHtml(itemLabel(item))}"${expanded}${change}>${itemRow(item, hasChildren)}${group}</li>`;
};

/** 部品設計『mapの一覧』の HTML を返却する（DOM を使用しない） */
export const renderMapList = (args: MapListArgs): string => {
  const context = {
    level: 1,
    collapsed: new Set(args.collapsed ?? []),
    focused: args.focused ?? args.items[0]?.id ?? "",
  };
  return `<ul class="mdmark-map-list" role="tree" aria-label="${escapeHtml(args.label)}">${args.items
    .map((item) => renderItem(item, context))
    .join("")}</ul>`;
};
