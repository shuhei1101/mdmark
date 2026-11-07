import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import aliasSchema from "../../schemas/alias-inject/v0.3.0/aliases.schema.json" with {
  type: "json",
};
import type { CheckIssue } from "./check.ts";

/** `type` の語を日本語の型の名前にする */
const TYPE_NAMES: Record<string, string> = {
  string: "文字列",
  boolean: "真偽値",
  array: "配列",
  object: "オブジェクト",
};

/** 検査の関数。初めて使うときに作り、以降は使い回す */
let validator: ValidateFunction | undefined;

/** 検査の関数を作る（`$data` は使わない） */
function getValidator(): ValidateFunction {
  validator ??= new Ajv2020({
    allErrors: true,
    strict: true,
    verbose: true,
  }).compile(aliasSchema);
  return validator;
}

/** JSON Pointer の各部分を、`~1`・`~0` を戻して返す */
function pointerParts(pointer: string): string[] {
  return pointer === ""
    ? []
    : pointer
        .slice(1)
        .split("/")
        .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/** `/1/alias_type` を `aliases[1].alias_type` の形にする */
function whereOf(pointer: string): string {
  return pointerParts(pointer).reduce(
    (path, part) =>
      /^\d+$/.test(part) ? `${path}[${part}]` : `${path}.${part}`,
    "aliases",
  );
}

/** エラーの `parentSchema` の `title` */
function titleOf(error: ErrorObject): string {
  const parent = error.parentSchema as { title?: string } | undefined;
  return parent?.title ?? "";
}

/** エラーを、日本語の 1 文にする */
function messageOf(error: ErrorObject, where: string): string {
  const title = titleOf(error);
  const label = title === "" ? "" : `（${title}）`;
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case "required": {
      const name = String(params.missingProperty);
      const child = (
        error.parentSchema as
          | { properties?: Record<string, { title?: string }> }
          | undefined
      )?.properties?.[name]?.title;
      return `\`${where}\` に \`${name}\`${child === undefined ? "" : `（${child}）`}がありません。記載してください。`;
    }
    case "type":
      return `\`${where}\`${label}は${TYPE_NAMES[String(params.type)] ?? String(params.type)}にしてください。`;
    case "minLength":
    case "minItems":
      return `\`${where}\`${label}が空です。記載してください。`;
    case "enum":
      return `\`${where}\`${label}は ${(params.allowedValues as unknown[]).join("・")} のどれかにしてください。`;
    case "additionalProperties":
      return `\`${where}\` の \`${String(params.additionalProperty)}\` は記載できません。消してください。`;
    default:
      return `\`${where}\`${label}が Schema に合いません（${error.message ?? ""}）。`;
  }
}

/** 設定の `aliases` の配列に、取り込んだ alias-inject の Schema を当て、合わない行を `null` にした配列と、日本語の 1 文の `schema` のずれを返す */
export function validateAliasRows(
  rows: unknown[],
  file: string,
): { rows: unknown[]; issues: CheckIssue[] } {
  const validate = getValidator();
  const passed: boolean = validate(rows);
  if (passed) {
    return { rows, issues: [] };
  }
  const issues: CheckIssue[] = [];
  const seen = new Set<string>();
  const invalid = new Set<number>();
  const add = (pointer: string, message: string): void => {
    const where = whereOf(pointer);
    const key = `${where}\0${message}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    issues.push({ file, where, kind: "schema", message });
    const row = pointerParts(pointer)[0];
    if (row !== undefined && /^\d+$/.test(row)) {
      invalid.add(Number(row));
    }
  };
  for (const error of validate.errors ?? []) {
    add(error.instancePath, messageOf(error, whereOf(error.instancePath)));
  }
  return {
    rows: rows.map((row, position) => (invalid.has(position) ? null : row)),
    issues,
  };
}
