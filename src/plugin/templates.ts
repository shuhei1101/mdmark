import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import { stat } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import { parse, stringify, YAMLParseError } from "yaml";
import templatesSchema from "../../schemas/mdmark.templates.schema.json" with {
  type: "json",
};
import { CliError } from "../cli/errors.ts";
import { findConfigChain, resolveSettingsPath } from "../config-files.ts";

/** 索引の `templates` の 1 行 */
export type TemplateEntry = {
  /** テンプレートの名前 */
  name: string;
  /** テンプレートのフォルダの直下の CSS のファイル名 */
  file: string;
  /** 説明 */
  description: string;
  /** タグ。索引で省いた行は空の並び */
  tags: string[];
};

/** `templates.yaml` の中身 */
export type TemplatesIndex = {
  /** 索引のバージョン */
  schema: 1;
  /** 行の並び */
  templates: TemplateEntry[];
};

/** `list_templates` が返す 1 行 */
export type ListedTemplate = {
  /** テンプレートの名前 */
  name: string;
  /** 説明 */
  description: string;
  /** タグ */
  tags: string[];
  /** CSS の絶対パス */
  path: string;
};

/** 端末の設定のファイルのフォルダから見たテンプレートのフォルダ */
export const TEMPLATES_SUBDIR = "templates/css";

/** テンプレートのフォルダの索引のファイル名 */
export const TEMPLATES_INDEX_FILE = "templates.yaml";

/** 書く索引の `schema` の値 */
export const TEMPLATES_SCHEMA_VERSION = 1;

/** `add_template` の `name` の正規表現。JSON Schema の `pattern` と同じ */
export const TEMPLATE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 検査の関数。初めて使うときに作り、以降は使い回す */
let validator: ValidateFunction | undefined;

/** 登録の書き込みを 1 つずつ順に進める連鎖の末尾 */
let writing: Promise<unknown> = Promise.resolve();

/** 端末の設定のパスのフォルダの `templates/css` の絶対パスを返す */
export const resolveTemplatesDir = (options: {
  env: Record<string, string | undefined>;
  home: string;
}): string => join(dirname(resolveSettingsPath(options)), TEMPLATES_SUBDIR);

/** JSON Pointer（`/templates/0/file`）を `templates[0].file` の形にする */
const whereOf = (pointer: string): string =>
  pointer
    .split("/")
    .slice(1)
    .reduce(
      (path, part) =>
        /^\d+$/.test(part)
          ? `${path}[${part}]`
          : path === ""
            ? part
            : `${path}.${part}`,
      "",
    );

/** 値を索引の JSON Schema で検査し、最初に合わないところを、索引のパス・キーのパス・直し方の 1 文で返す */
export const validateTemplatesIndex = (options: {
  value: unknown;
  path: string;
}): string | undefined => {
  const { value, path } = options;
  validator ??= new Ajv2020({ allErrors: true, strict: true }).compile(
    templatesSchema,
  );
  if (!validator(value)) {
    const error = validator.errors?.[0];
    const params = (error?.params ?? {}) as Record<string, unknown>;
    const base = whereOf(error?.instancePath ?? "");
    const where =
      error?.keyword === "required"
        ? [base, String(params.missingProperty)]
            .filter((part) => part !== "")
            .join(".")
        : error?.keyword === "additionalProperties"
          ? [base, String(params.additionalProperty)]
              .filter((part) => part !== "")
              .join(".")
          : base === ""
            ? "(最上位)"
            : base;
    const reason =
      error?.keyword === "required"
        ? "がありません。記載してください"
        : error?.keyword === "additionalProperties"
          ? "は記載できません。削除してください"
          : "がスキーマに合いません。ER 図『CSSのテンプレート』の決まりに合わせてください";
    return `${path} の ${where} ${reason}。`;
  }
  const names = new Set<string>();
  const rows = (value as { templates: { name: string }[] }).templates;
  for (const [position, row] of rows.entries()) {
    if (names.has(row.name)) {
      return `${path} の templates[${position}].name の ${row.name} が重なっています。名前を変えるか、行を 1 つにしてください。`;
    }
    names.add(row.name);
  }
  return undefined;
};

/** テンプレートのフォルダの索引を読んで検査し、無ければ空の索引を返す */
export const readTemplatesIndex = async (
  dir: string,
): Promise<TemplatesIndex> => {
  const path = join(dir, TEMPLATES_INDEX_FILE);
  let text: string;
  try {
    text = await fs.readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { schema: TEMPLATES_SCHEMA_VERSION, templates: [] };
    }
    throw error;
  }
  let raw: unknown;
  try {
    raw = parse(text);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      const line = error.linePos?.[0].line ?? 1;
      throw new CliError(
        `${path} の ${line} 行目を YAML として読めません。${line} 行目を直してください。`,
      );
    }
    throw error;
  }
  const message = validateTemplatesIndex({ value: raw, path });
  if (message !== undefined) {
    throw new CliError(message);
  }
  const index = raw as {
    templates: (Omit<TemplateEntry, "tags"> & { tags?: string[] })[];
  };
  return {
    schema: TEMPLATES_SCHEMA_VERSION,
    templates: index.templates.map((row) => ({ ...row, tags: row.tags ?? [] })),
  };
};

/** 索引の行を、CSS の絶対パスを付けて索引の順に返す */
export const listTemplates = async (dir: string): Promise<ListedTemplate[]> => {
  const index = await readTemplatesIndex(dir);
  return index.templates.map((row) => ({
    name: row.name,
    description: row.description,
    tags: row.tags,
    path: join(dir, row.file),
  }));
};

/** 索引を同じフォルダの一時ファイルに書いてから rename で置き換える */
const writeTemplatesIndex = async (options: {
  dir: string;
  index: TemplatesIndex;
}): Promise<void> => {
  const { dir, index } = options;
  const temp = join(
    dir,
    `${TEMPLATES_INDEX_FILE}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temp, stringify(index));
    await fs.rename(temp, join(dir, TEMPLATES_INDEX_FILE));
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
};

/** ファイルの中身を読む。無ければ `undefined` */
const readIfExists = async (path: string): Promise<Buffer | undefined> => {
  try {
    return await fs.readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
};

/** CSS をテンプレートのフォルダへ `{name}.css` でコピーし、索引に行を追加するか置き換える */
export const addTemplate = async (options: {
  dir: string;
  source: string;
  name: string;
  description: string;
  tags: string[];
  overwrite: boolean;
}): Promise<{ name: string; path: string; replaced: boolean }> => {
  const { dir, source, name, description, tags, overwrite } = options;
  if (extname(source) !== ".css") {
    throw new CliError(
      `${source} は CSS ではありません。拡張子が .css のファイルを渡してください。`,
    );
  }
  const css = await readIfExists(source);
  if (css === undefined) {
    throw new CliError(
      `${source} が見つかりません。登録する CSS のパスを確かめてください。`,
    );
  }
  // 同じプロセスで重なった登録が、互いの行を上書きしないよう 1 つずつ順に進める
  const run = async () => {
    const index = await readTemplatesIndex(dir);
    const position = index.templates.findIndex((row) => row.name === name);
    if (position !== -1 && !overwrite) {
      throw new CliError(
        `テンプレート ${name} は既にあります。置き換えるときは overwrite を true にしてください。`,
      );
    }
    const file = `${name}.css`;
    const row: TemplateEntry = { name, file, description, tags };
    const templates =
      position === -1
        ? [...index.templates, row]
        : index.templates.map((current, at) =>
            at === position ? row : current,
          );
    const next: TemplatesIndex = {
      schema: TEMPLATES_SCHEMA_VERSION,
      templates,
    };
    const indexPath = join(dir, TEMPLATES_INDEX_FILE);
    const message = validateTemplatesIndex({ value: next, path: indexPath });
    if (message !== undefined) {
      throw new CliError(message);
    }
    await fs.mkdir(dir, { recursive: true });
    const path = join(dir, file);
    const previous = await readIfExists(path);
    await fs.writeFile(path, css);
    try {
      await writeTemplatesIndex({ dir, index: next });
    } catch (error) {
      if (previous === undefined) {
        await fs.rm(path, { force: true });
      } else {
        await fs.writeFile(path, previous);
      }
      throw error;
    }
    return { name, path, replaced: position !== -1 };
  };
  const result = writing.then(run, run);
  writing = result.catch(() => undefined);
  return result;
};

/** フォルダがあるか */
const isDirectory = async (path: string): Promise<boolean> =>
  (await stat(path).catch(() => undefined))?.isDirectory() === true;

/** ファイルがあるか */
const isFile = async (path: string): Promise<boolean> =>
  (await stat(path).catch(() => undefined))?.isFile() === true;

/** テンプレートの CSS を配置先へコピーし、配置したパスと基準の設定ファイルからの `theme` の値を返す */
export const applyTemplate = async (options: {
  dir: string;
  name: string;
  cwd: string;
  target: string | undefined;
  overwrite: boolean;
}): Promise<{ path: string; theme: string | undefined; replaced: boolean }> => {
  const { dir, name, cwd, target, overwrite } = options;
  const index = await readTemplatesIndex(dir);
  const row = index.templates.find((current) => current.name === name);
  if (row === undefined) {
    throw new CliError(
      `テンプレート ${name} がありません。list_templates で名前を確かめてください。`,
    );
  }
  if (target !== undefined && !(await isDirectory(target))) {
    throw new CliError(
      `配置先のフォルダ ${target} が見つかりません。ある配置先を dir に渡してください。`,
    );
  }
  const [config] = await findConfigChain({
    cwd: target ?? cwd,
    cascade: false,
    isFile,
  });
  if (target === undefined && config === undefined) {
    throw new CliError(
      `${cwd} とその上のフォルダに mdmark.config.yaml がありません。配置先を dir に渡すか、mdmark init で設定ファイルを置いてください。`,
    );
  }
  const destination = target ?? dirname(config as string);
  const path = join(destination, `${name}.css`);
  const css = await fs.readFile(join(dir, row.file));
  const existing = await readIfExists(path);
  if (existing !== undefined && !existing.equals(css) && !overwrite) {
    throw new CliError(
      `${path} は既にあり、テンプレートと中身が違います。置き換えるときは overwrite を true にしてください。`,
    );
  }
  const replaced = existing !== undefined && !existing.equals(css);
  if (existing === undefined || replaced) {
    await fs.writeFile(path, css);
  }
  const theme =
    config === undefined
      ? undefined
      : `./${relative(dirname(config), path).split("\\").join("/")}`;
  return { path, theme, replaced };
};
