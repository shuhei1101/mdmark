/** JSON Schema の 1 つのセクション（使用するキーだけ） */
export type JsonSchema = {
  $ref?: string;
  allOf?: JsonSchema[];
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  default?: unknown;
  description?: string;
};

/** 設定のキー 1 つの今の値・端末の設定の値・既定・説明 */
export type ConfigKey = {
  key: string;
  current: unknown;
  inherited: unknown;
  default: unknown;
  description: string;
};

/** 端末の設定だけが持つキーの頭 */
const SETTINGS_ONLY_ROOTS = ["config", "serve"];

/** 一覧に含めないキー */
const EXCLUDED_KEYS = ["version"];

/** ドットで区切ったキーの値を取る。無ければ `null` */
const getIn = (value: unknown, path: string[]): unknown => {
  let current = value;
  for (const part of path) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
};

/** `allOf` の `$ref` を先に展開し、`properties` を 1 つにまとめる */
const mergeProperties = (
  schema: JsonSchema,
  resolveRef: (ref: string) => JsonSchema,
): Record<string, JsonSchema> => {
  const merged: Record<string, JsonSchema> = {};
  for (const part of schema.allOf ?? []) {
    const resolved = part.$ref ? resolveRef(part.$ref) : part;
    Object.assign(merged, mergeProperties(resolved, resolveRef));
  }
  return { ...merged, ...schema.properties };
};

/** 葉のキーまで展開して一覧に追加する。`additionalProperties` で受けるキーは今の値にあるものだけ追加する */
const collectKeys = (options: {
  properties: Record<string, JsonSchema>;
  prefix: string[];
  schema: JsonSchema;
  current: Record<string, unknown>;
  inherited: Record<string, unknown> | undefined;
  out: ConfigKey[];
}): void => {
  const { properties, prefix, schema, current, inherited, out } = options;
  const push = (path: string[], node: JsonSchema | undefined) => {
    out.push({
      key: path.join("."),
      current: getIn(current, path),
      inherited: inherited === undefined ? null : getIn(inherited, path),
      default: node?.default ?? null,
      description: node?.description ?? "",
    });
  };
  for (const [name, node] of Object.entries(properties)) {
    const path = [...prefix, name];
    if (node.properties) {
      collectKeys({
        ...options,
        properties: node.properties,
        prefix: path,
        schema: node,
      });
    } else {
      push(path, node);
    }
  }
  for (const name of additionalKeys({ properties, prefix, schema, current })) {
    push(
      [...prefix, name],
      typeof schema.additionalProperties === "object"
        ? schema.additionalProperties
        : undefined,
    );
  }
};

/** `additionalProperties` で受けるキーのうち、今の値にあるものの名前 */
const additionalKeys = (options: {
  properties: Record<string, JsonSchema>;
  prefix: string[];
  schema: JsonSchema;
  current: Record<string, unknown>;
}): string[] => {
  const { properties, prefix, schema, current } = options;
  if (
    schema.additionalProperties === undefined ||
    schema.additionalProperties === false
  ) {
    return [];
  }
  const here = getIn(current, prefix);
  if (typeof here !== "object" || here === null) {
    return [];
  }
  return Object.keys(here).filter((name) => !(name in properties));
};

/** Schema の葉のキーごとに、今の値・端末の設定の値・既定・説明を Schema の並びで返却する */
export const listConfigKeys = (options: {
  target: "settings" | "config";
  schema: JsonSchema;
  resolveRef: (ref: string) => JsonSchema;
  current: Record<string, unknown>;
  inherited?: Record<string, unknown> | undefined;
}): ConfigKey[] => {
  const properties = mergeProperties(options.schema, options.resolveRef);
  for (const key of EXCLUDED_KEYS) {
    delete properties[key];
  }
  if (options.target === "config") {
    for (const key of SETTINGS_ONLY_ROOTS) {
      delete properties[key];
    }
  }
  const out: ConfigKey[] = [];
  collectKeys({
    properties,
    prefix: [],
    schema: {},
    current: options.current,
    inherited: options.inherited,
    out,
  });
  return out;
};
