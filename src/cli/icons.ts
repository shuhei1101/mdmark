import { icons as lucideIcons } from "lucide";
import { bundledIconNode } from "../parts/icons.ts";
import type { MdmarkIconNode } from "../parts/inline-icon.ts";
import { ICON_NAME_PATTERN } from "../render/syntax/inline-icons.ts";

/** 本文の `icon:` の行内のコード（打ち消した `icon\:` は除く） */
const ICON_CODE_PATTERN = /`icon:\s*([^`\s]+)\s*`/g;

/** Lucide の名前（`arrow-up-1-0`）を、`icons` のキー（`ArrowUp10`）にする */
const pascalName = (name: string): string =>
  name
    .split("-")
    .map((part) => (part ? `${part[0]?.toUpperCase()}${part.slice(1)}` : ""))
    .join("");

/** 文書と取り込む文書の `icon:` のうち、配布物に束ねていない名前の IconNode を依存の lucide から取り出す。lucide に無い名前は別に返す */
export const collectIconNodes = (
  markdowns: string[],
): { icons: Record<string, MdmarkIconNode>; missing: string[] } => {
  const icons: Record<string, MdmarkIconNode> = {};
  const missing = new Set<string>();
  const table = lucideIcons as unknown as Record<string, MdmarkIconNode>;
  for (const markdown of markdowns) {
    for (const match of markdown.matchAll(ICON_CODE_PATTERN)) {
      const name = match[1] ?? "";
      if (
        !ICON_NAME_PATTERN.test(name) ||
        bundledIconNode(name) !== undefined ||
        Object.hasOwn(icons, name)
      ) {
        continue;
      }
      const key = pascalName(name);
      const node = Object.hasOwn(table, key) ? table[key] : undefined;
      if (node === undefined) {
        missing.add(name);
      } else {
        icons[name] = node;
      }
    }
  }
  return { icons, missing: [...missing] };
};
