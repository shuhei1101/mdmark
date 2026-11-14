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

/** `list_templates` が返却する 1 行 */
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

/** 端末の設定のファイルのフォルダを基準にしたテンプレートのフォルダ */
export const TEMPLATES_SUBDIR = "templates/css";

/** テンプレートのフォルダの索引のファイル名 */
export const TEMPLATES_INDEX_FILE = "templates.yaml";

/** 記載する索引の `schema` の値 */
export const TEMPLATES_SCHEMA_VERSION = 1;

/** `add_template` の `name` の正規表現。JSON Schema の `pattern` と同じ */
export const TEMPLATE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 検査の関数。初めて使用するときに作り、以降は使い回す */
let validator: ValidateFunction | undefined;

/** 登録の書き込みを 1 つずつ順に進める連鎖の末尾 */
let writing: Promise<unknown> = Promise.resolve();

/** 端末の設定のパスのフォルダの `templates/css` の絶対パスを返却する */
export const resolveTemplatesDir = (options: {
  env: Record<string, string | undefined>;
  home: string;
}): string => join(dirname(resolveSettingsPath(options)), TEMPLATES_SUBDIR);

/** JSON Pointer（`/templates/0/file`）を `templates[0].file` の構造にする */
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

/** JSON Schema の検査の誤り */
type SchemaError = NonNullable<ValidateFunction["errors"]>[number];

/** キーが無い・記載できないキーの誤りを、キーのパスと修正方法にする。ほかの誤りは `undefined` */
const describeKeyError = (
  error: SchemaError,
  base: string,
): string | undefined => {
  const params = error.params as Record<string, unknown>;
  const join = (key: unknown) =>
    [base, String(key)].filter((part) => part !== "").join(".");
  if (error.keyword === "required") {
    return `${join(params.missingProperty)} がありません。記載してください`;
  }
  if (error.keyword === "additionalProperties") {
    return `${join(params.additionalProperty)} は記載できません。削除してください`;
  }
  return undefined;
};

/** JSON Schema の検査の誤りを、索引のパス・キーのパス・修正方法の 1 文にする */
const describeSchemaError = (
  error: SchemaError | undefined,
  path: string,
): string => {
  const base = whereOf(error?.instancePath ?? "");
  const keyError =
    error === undefined ? undefined : describeKeyError(error, base);
  if (keyError !== undefined) {
    return `${path} の ${keyError}。`;
  }
  const where = base === "" ? "(最上位)" : base;
  const description =
    (error?.parentSchema as { description?: string } | undefined)
      ?.description ?? "索引の決まりに合う値にしてください。";
  const reason =
    `の値 ${JSON.stringify(error?.data)} は使用できません。${description}`.replace(
      /。$/,
      "",
    );
  return `${path} の ${where} ${reason}。`;
};

/** 値を索引の JSON Schema で検査し、最初に合わないところを、索引のパス・キーのパス・修正方法の 1 文で返却する */
export const validateTemplatesIndex = (options: {
  value: unknown;
  path: string;
}): string | undefined => {
  const { value, path } = options;
  validator ??= new Ajv2020({
    allErrors: true,
    strict: true,
    verbose: true,
  }).compile(templatesSchema);
  if (!validator(value)) {
    return describeSchemaError(validator.errors?.[0], path);
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

/** テンプレートのフォルダの索引を読み込んで検査し、無ければ空の索引を返却する */
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
        `${path} の ${line} 行目を YAML として読み込めません。${line} 行目を修正してください。`,
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

/** 索引の行を、CSS の絶対パスを付けて索引の順に返却する */
export const listTemplates = async (dir: string): Promise<ListedTemplate[]> => {
  const index = await readTemplatesIndex(dir);
  return index.templates.map((row) => ({
    name: row.name,
    description: row.description,
    tags: row.tags,
    path: join(dir, row.file),
  }));
};

/** 索引を同じフォルダの一時ファイルに書き込んでから rename で置き換える */
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

/** ファイルの中身を読み込む。無ければ `undefined` */
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
  if (!TEMPLATE_NAME_PATTERN.test(name)) {
    throw new CliError(
      `引数 name の ${name} は使用できません。英小文字・数字・- の 1〜64 文字で、英小文字か数字で始まる名前を指定してください。`,
    );
  }
  if (tags.some((tag) => tag === "")) {
    throw new CliError(
      "引数 tags に空の文字列があります。空でない単語だけを指定してください。",
    );
  }
  if (extname(source) !== ".css") {
    throw new CliError(
      `${source} は CSS ではありません。拡張子が .css のファイルを指定してください。`,
    );
  }
  const css = await readIfExists(source);
  if (css === undefined) {
    throw new CliError(
      `${source} が見つかりません。登録する CSS のパスを確認してください。`,
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

/** 配置先のフォルダと、基準の設定ファイル（配置先か作業のフォルダから上へ探して最初の `mdmark.config.yaml`）を決める */
const findDestination = async (options: {
  cwd: string;
  target: string | undefined;
}): Promise<{ config: string | undefined; destination: string }> => {
  const { cwd, target } = options;
  if (target !== undefined && !(await isDirectory(target))) {
    throw new CliError(
      `配置先のフォルダ ${target} が見つかりません。ある配置先を dir に指定してください。`,
    );
  }
  const [config] = await findConfigChain({
    cwd: target ?? cwd,
    cascade: false,
    isFile,
  });
  if (target !== undefined) {
    return { config, destination: target };
  }
  if (config === undefined) {
    throw new CliError(
      `${cwd} とその上のフォルダに mdmark.config.yaml がありません。配置先を dir に指定するか、mdmark init で設定ファイルを配置してください。`,
    );
  }
  return { config, destination: dirname(config) };
};

/** CSS を配置先へ書き込む。中身の違うファイルが既にあれば、`overwrite` のときだけ置き換える。置き換えたかを返却する */
const copyTemplateCss = async (options: {
  path: string;
  css: Buffer;
  overwrite: boolean;
}): Promise<boolean> => {
  const { path, css, overwrite } = options;
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
  return replaced;
};

/** テンプレートの CSS を配置先へコピーし、配置したパスと基準の設定ファイルからの `theme` の値を返却する */
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
      `テンプレート ${name} がありません。list_templates で名前を確認してください。`,
    );
  }
  if (target !== undefined && !(await isDirectory(target))) {
    throw new CliError(
      `配置先のフォルダ ${target} が見つかりません。ある配置先を dir に指定してください。`,
    );
  }
  const { config, destination } = await findDestination({ cwd, target });
  const path = join(destination, `${name}.css`);
  const sourcePath = join(dir, row.file);
  const css = await readIfExists(sourcePath);
  if (css === undefined) {
    throw new CliError(
      `テンプレート ${name} の CSS ${sourcePath} がありません。add_template でもう一度登録するか、索引の行を削除してください。`,
    );
  }
  const replaced = await copyTemplateCss({ path, css, overwrite });
  const theme =
    config === undefined
      ? undefined
      : `./${relative(dirname(config), path).split("\\").join("/")}`;
  return { path, theme, replaced };
};
