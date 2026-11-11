import { icons } from "lucide";

/** PascalCase のアイコンの名前を、Lucide の kebab-case の名前にする */
const kebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();

let names: ReadonlySet<string> | undefined;

/** 採用バージョンの lucide のパッケージのアイコンの名前（kebab-case）。点検で呼んだときだけ作る（使わない配布ファイルにアイコンを束ねない） */
export const lucideIconNames = (): ReadonlySet<string> => {
  names ??= new Set(Object.keys(icons).map(kebab));
  return names;
};
