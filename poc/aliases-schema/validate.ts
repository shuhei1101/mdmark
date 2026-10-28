import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import { parse } from "yaml";

// esbuild で束ねたときも元のフォルダを読むよう、引数でフォルダを受ける
const BASE_DIR = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
const ROOT = join(BASE_DIR, "..", "..");
const ALIASES_SCHEMA_ID = "https://mdmark.local/schemas/aliases.schema.yaml";
const ALIASES_KEY = "aliases";
// schemaPath の末尾から外すキーワードの区切り
const PROPERTIES_SEGMENT = "/properties/";

/** mdmark check のずれ 1 件 */
type Issue = {
  /** ずれの場所 */
  location: string;
  /** 内容と直し方の 1 文 */
  message: string;
};

/** スキーマの title を引き、無ければキーの名前を返す */
function titleOf(options: { schema: unknown; key: string }): string {
  const props = (
    options.schema as { properties?: Record<string, { title?: string }> }
  )?.properties;
  const title = props?.[options.key]?.title;
  return title ? `${title}（${options.key}）` : options.key;
}

/** instancePath を「aliases の 2 行目（id: terms）の metadata.alias_type」の形にする */
function describeLocation(options: {
  path: string;
  config: Record<string, unknown>;
}): string {
  const parts = options.path.split("/").filter(Boolean);
  if (parts[0] !== ALIASES_KEY || parts[1] === undefined) {
    return parts.join(".") || "(ルート)";
  }
  const rows = options.config[ALIASES_KEY] as Array<{ id?: unknown }>;
  const index = Number(parts[1]);
  const id =
    typeof rows[index]?.id === "string" ? `（id: ${rows[index].id}）` : "";
  const rest = parts.slice(2).join(".");
  return `${ALIASES_KEY} の ${index + 1} 行目${id}${rest ? ` の ${rest}` : ""}`;
}

/** schemaPath から、エラーを出した枝のスキーマの場所を返す */
function branchOf(schemaPath: string): string {
  let path = schemaPath.slice(0, schemaPath.lastIndexOf("/"));
  // properties/{キー} を剥がして枝のスキーマの根まで戻る
  while (path.includes(PROPERTIES_SEGMENT)) {
    path = path.slice(0, path.lastIndexOf(PROPERTIES_SEGMENT));
  }
  return path;
}

/** anyOf の枝のうち、判別子の const が合わない枝のエラーを落とし、誤った 1 箇所を 1 件にする */
function narrow(errors: ErrorObject[]): ErrorObject[] {
  const anyOfPaths = new Set(
    errors.filter((e) => e.keyword === "anyOf").map((e) => e.instancePath),
  );
  // 判別子が合わない枝（const のエラーを持つ枝）を枝の場所と instancePath の組で集める
  const mismatched = new Set(
    errors
      .filter((e) => e.keyword === "const")
      .map((e) => `${branchOf(e.schemaPath)}@${dirname(e.instancePath)}`),
  );
  const kept = errors.filter((e) => {
    if (e.keyword === "anyOf") {
      return true;
    }
    const owner = [...anyOfPaths].find(
      (p) => e.instancePath === p || e.instancePath.startsWith(`${p}/`),
    );
    if (owner === undefined) {
      return true;
    }
    return !mismatched.has(`${branchOf(e.schemaPath)}@${owner}`);
  });
  // 枝のエラーが残った anyOf は、その枝のエラーで言えるので落とす
  return kept.filter(
    (e) =>
      e.keyword !== "anyOf" ||
      !kept.some(
        (o) =>
          o !== e &&
          o.instancePath.startsWith(e.instancePath) &&
          o.keyword !== "anyOf",
      ),
  );
}

/** keyword・params・スキーマの title から、内容と直し方の 1 文を組む */
function toMessage(error: ErrorObject): string {
  const { keyword, params, parentSchema } = error;
  switch (keyword) {
    case "required":
      return `${titleOf({ schema: parentSchema, key: params.missingProperty })} がありません。記載してください。`;
    case "minItems":
      return `${parentSchema?.title ?? "値"} が空です。${params.limit} 件以上記載してください。`;
    case "minLength":
      return `${parentSchema?.title ?? "値"} が空です。${params.limit} 文字以上記載してください。`;
    case "enum":
      return `${parentSchema?.title ?? "値"} は ${params.allowedValues.join("・")} のどれかにしてください。`;
    case "const":
      return `${parentSchema?.title ?? "値"} は ${params.allowedValue} にしてください。`;
    case "type":
      return `${parentSchema?.title ?? "値"} の型が違います。${params.type} で記載してください。`;
    case "additionalProperties":
      return `${params.additionalProperty} は記載できないキーです。削除してください。`;
    case "anyOf":
      return `${parentSchema?.title ?? "値"} の取り方が分かりません。type を ref か custom にしてください。`;
    default:
      return `${keyword} の決まりに合いません。`;
  }
}

/** 設定の aliases を検証し、ずれの一覧を返す */
export function checkAliases(config: Record<string, unknown>): Issue[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true, verbose: true });
  const aliasesSchema = parse(
    readFileSync(join(BASE_DIR, "aliases.schema.yaml"), "utf8"),
  );
  ajv.addSchema(aliasesSchema, ALIASES_SCHEMA_ID);
  const configSchema = JSON.parse(
    readFileSync(join(ROOT, "schemas", "mdmark.config.schema.json"), "utf8"),
  );
  configSchema.properties[ALIASES_KEY] = {
    title: "エイリアスの元の行",
    $ref: ALIASES_SCHEMA_ID,
  };
  const validate = ajv.compile(configSchema);
  if (validate(config)) {
    return [];
  }
  if (process.env.RAW)
    console.error(`絞る前のエラー: ${validate.errors?.length} 件`);
  return narrow(validate.errors ?? []).map((error) => ({
    location: describeLocation({ path: error.instancePath, config }),
    message: toMessage(error),
  }));
}

const config = parse(
  readFileSync(join(BASE_DIR, "fixture.config.yaml"), "utf8"),
);
console.log(JSON.stringify(checkAliases(config), null, 2));
