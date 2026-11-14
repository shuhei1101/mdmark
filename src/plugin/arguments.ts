import type {
  JsonSchemaValidator,
  JsonSchemaValidatorResult,
  jsonSchemaValidator,
} from "@modelcontextprotocol/server";

/** ツールの引数 1 つの構造（JSON Schema 2020-12 のうち使用する範囲） */
export type ArgumentSchema = {
  /** `string`・`integer`・`boolean`・`array`・`object`・`null` かその並び */
  type:
    | "string"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null"
    | ("object" | "null")[];
  /** 配列の要素の構造。要素が選べる値を `enum` で持てる */
  items?: { type: "string"; enum?: string[] };
  /** 選べる値 */
  enum?: string[];
  /** 配列の最小の要素数 */
  minItems?: number;
  /** 文字列の最小の長さ */
  minLength?: number;
  /** 整数の最小値 */
  minimum?: number;
  /** 整数の最大値 */
  maximum?: number;
  /** 引数の説明 */
  description?: string;
};

/** ツールの引数の構造（JSON Schema 2020-12 のうち使用する範囲） */
export type ToolInputSchema = {
  type: "object";
  properties: Record<string, ArgumentSchema>;
  required: string[];
  additionalProperties: false;
};

/** SDK の `fromJsonSchema` に指定する、どの入力も経由する検証器。SDK の検査は英語の文を頭に付けるため、ツールを呼ぶときに引数を検査する */
export const ACCEPT_ALL_VALIDATOR: jsonSchemaValidator = {
  getValidator: <T>(): JsonSchemaValidator<T> => {
    return (input: unknown): JsonSchemaValidatorResult<T> => ({
      valid: true,
      data: input as T,
      errorMessage: undefined,
    });
  },
};

/** 値がオブジェクト（配列と null を除く）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 値の型が、引数の構造の型のどれかに該当するか */
function matchesType(schema: ArgumentSchema, value: unknown): boolean {
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  return types.some((type) => {
    switch (type) {
      case "string":
        return typeof value === "string";
      case "integer":
        return Number.isInteger(value);
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return (
          Array.isArray(value) &&
          (schema.items === undefined ||
            value.every((item) => typeof item === "string"))
        );
      case "object":
        return isRecord(value);
      case "null":
        return value === null;
      default:
        return false;
    }
  });
}

/** 配列の引数の、合う値の説明 */
function describeArray(schema: ArgumentSchema): string {
  if (schema.items?.enum !== undefined) {
    return `${schema.items.enum.join(" か ")} の配列`;
  }
  return schema.items === undefined ? "配列" : "文字列の配列";
}

/** 配列・整数・真偽値・文字列でない引数の、合う値の説明 */
function describeObject(types: string[]): string {
  if (types.includes("object") && types.includes("null")) {
    return "オブジェクトか null";
  }
  return types.includes("object") ? "オブジェクト" : "null";
}

/** 型が合わないときに「〜で指定してください」へ入れる、合う値の説明 */
function describeType(schema: ArgumentSchema): string {
  if (schema.enum !== undefined) {
    return schema.enum.join(" か ");
  }
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("array")) {
    return describeArray(schema);
  }
  if (types.includes("integer")) {
    return schema.minimum !== undefined && schema.maximum !== undefined
      ? `${schema.minimum} 以上 ${schema.maximum} 以下の整数`
      : "整数";
  }
  if (types.includes("boolean")) {
    return "真偽値";
  }
  if (types.includes("string")) {
    return schema.minLength === undefined ? "文字列" : "空でない文字列";
  }
  return describeObject(types);
}

/** 数の引数が `minimum`・`maximum` の外か */
function outOfRange(schema: ArgumentSchema, value: unknown): boolean {
  return (
    typeof value === "number" &&
    ((schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum))
  );
}

/** 配列の引数に、`items.enum` に無い要素があるか */
function hasUnknownItem(schema: ArgumentSchema, value: unknown): boolean {
  const allowed = schema.items?.enum;
  return (
    allowed !== undefined &&
    Array.isArray(value) &&
    value.some((item) => !allowed.includes(item))
  );
}

/** 配列・文字列の引数の長さが足りないときの、合う値の説明 */
function describeTooShort(
  schema: ArgumentSchema,
  value: unknown,
): string | undefined {
  if (
    schema.minItems !== undefined &&
    Array.isArray(value) &&
    value.length < schema.minItems
  ) {
    return `${schema.minItems} 件以上の配列`;
  }
  if (
    schema.minLength !== undefined &&
    typeof value === "string" &&
    value.length < schema.minLength
  ) {
    return "空でない文字列";
  }
  return undefined;
}

/** 引数 1 つを検査し、合わなければ合う値の説明を返却する */
function describeMismatch(
  schema: ArgumentSchema,
  value: unknown,
): string | undefined {
  if (!matchesType(schema, value)) {
    return describeType(schema);
  }
  if (schema.enum !== undefined && !schema.enum.includes(value as string)) {
    return schema.enum.join(" か ");
  }
  if (outOfRange(schema, value) || hasUnknownItem(schema, value)) {
    return describeType(schema);
  }
  return describeTooShort(schema, value);
}

/** 引数をツールの引数の構造で検査し、最初に合わないところを、何が合わないかと修正方法の日本語の 1 文で返却する。合えば `undefined` */
export function checkArguments(options: {
  /** 引数の構造 */
  schema: ToolInputSchema;
  /** 指定された引数 */
  args: unknown;
}): string | undefined {
  const { schema, args } = options;
  if (!isRecord(args)) {
    return "引数はオブジェクトで指定してください。";
  }
  for (const name of schema.required) {
    if (!(name in args)) {
      return `引数 ${name} がありません。${name} を指定してください。`;
    }
  }
  const allowed = Object.keys(schema.properties);
  for (const name of Object.keys(args)) {
    if (!allowed.includes(name)) {
      return `引数 ${name} は使用できません。使用できる引数は ${allowed.join("・")} です。`;
    }
  }
  for (const [name, value] of Object.entries(args)) {
    const argument = schema.properties[name];
    const expected = argument && describeMismatch(argument, value);
    if (expected !== undefined) {
      return `引数 ${name} は ${expected} で指定してください。`;
    }
  }
  return undefined;
}
