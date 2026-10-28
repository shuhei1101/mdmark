import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import aliasSchema from "../../schemas/alias-inject/v0.2.0/aliases.schema.json" with {
  type: "json",
};
import type { CheckIssue } from "./check.ts";

/** 値の取り方の枝（`type` の `const` で見分ける）を持つ `$defs` の名前 */
const BRANCH_NAMES = ["refValue", "customValue", "aliasTypeValue"] as const;

/** 枝の `$defs` の中の場所（`#/$defs/refValue/properties/field/minLength` の `refValue` と、その後ろ） */
const BRANCH_PATH =
  /^#\/\$defs\/(refValue|customValue|aliasTypeValue)(?:\/(.*))?$/;

/** `type` の語を日本語の型の名前にする */
const TYPE_NAMES: Record<string, string> = {
  string: "文字列",
  boolean: "真偽値",
  array: "配列",
  object: "オブジェクト",
};

/** 検査の関数。初めて使うときに作り、以降は使い回す */
let validator: ValidateFunction | undefined;

/** `$defs` の中の枝のスキーマ */
type DefsSchema = {
  $defs: Record<string, { properties?: { type?: { const?: unknown } } }>;
};

/** 検査の関数を作る（`$data` は使わない） */
function getValidator(): ValidateFunction {
  validator ??= new Ajv2020({
    allErrors: true,
    strict: true,
    verbose: true,
  }).compile(aliasSchema);
  return validator;
}

/** 値がキーと値の組か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

/** JSON Pointer の指す値を返す */
function valueAt(root: unknown, pointer: string): unknown {
  let current: unknown = root;
  for (const part of pointerParts(pointer)) {
    if (Array.isArray(current)) {
      current = current[Number(part)];
    } else if (isRecord(current)) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/** `/1/metadata/alias_type` を `aliases[1].metadata.alias_type` の形にする */
function whereOf(pointer: string): string {
  return pointerParts(pointer).reduce(
    (path, part) =>
      /^\d+$/.test(part) ? `${path}[${part}]` : `${path}.${part}`,
    "aliases",
  );
}

/** 枝の判別子（`type` の `const`） */
function discriminatorOf(name: string): unknown {
  return (aliasSchema as unknown as DefsSchema).$defs[name]?.properties?.type
    ?.const;
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
    case "const":
      return `\`${where}\`${label}は ${String(params.allowedValue)} のどれかにしてください。`;
    case "enum":
      return `\`${where}\`${label}は ${(params.allowedValues as unknown[]).join("・")} のどれかにしてください。`;
    case "additionalProperties":
      return `\`${where}\` の \`${String(params.additionalProperty)}\` は記載できません。消してください。`;
    default:
      return `\`${where}\`${label}が Schema に合いません（${error.message ?? ""}）。`;
  }
}

/** 値の取り方の枝のエラーのうち、判別子（`type`）が合う枝のものだけを残すかを返す。枝のエラーでなければ残す */
function keepsBranch(error: ErrorObject, rows: unknown): boolean {
  const matched = BRANCH_PATH.exec(error.schemaPath);
  if (matched === null) {
    return true;
  }
  const [, name = "", rest = ""] = matched;
  // 枝の中の項目のエラーは、場所の末尾が項目の名前になる
  const root = rest.startsWith("properties/")
    ? `/${pointerParts(error.instancePath).slice(0, -1).join("/")}`.replace(
        /^\/$/,
        "",
      )
    : error.instancePath;
  const data = valueAt(rows, root);
  return isRecord(data) && data.type === discriminatorOf(name);
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
    const where = whereOf(error.instancePath);
    if (error.keyword === "anyOf") {
      // 判別子がどの枝にも合わなければ、判別子の値を並べた 1 件にする
      const branches = (
        (error.parentSchema as { anyOf?: Array<{ $ref?: string }> } | undefined)
          ?.anyOf ?? []
      ).flatMap((branch) =>
        BRANCH_NAMES.filter((name) => branch.$ref === `#/$defs/${name}`),
      );
      const consts = branches.map((name) => discriminatorOf(name));
      const data = valueAt(rows, error.instancePath);
      if (!isRecord(data) || !consts.includes(data.type)) {
        const title = titleOf(error);
        add(
          error.instancePath,
          `\`${where}\`${title === "" ? "" : `（${title}）`}は ${consts.join("・")} のどれかにしてください。`,
        );
      }
    } else if (keepsBranch(error, rows)) {
      add(error.instancePath, messageOf(error, where));
    }
  }
  return {
    rows: rows.map((row, position) => (invalid.has(position) ? null : row)),
    issues,
  };
}
