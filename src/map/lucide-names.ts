import { icons } from "lucide";

/** PascalCase のアイコンの名前を、Lucide の kebab-case の名前にする */
const kebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

/** 採用バージョンの lucide のパッケージのアイコンの名前（kebab-case） */
export const LUCIDE_ICON_NAMES: ReadonlySet<string> = new Set(
  Object.keys(icons).map(kebab),
);
