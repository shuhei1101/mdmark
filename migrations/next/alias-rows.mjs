// 設定の aliases の v0.2.0 の構造の行を、alias-inject v0.3.0 の構造へ書き換える移行の手順のスクリプト
import { glob, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { isMap, isScalar, parse, parseDocument } from "yaml";

/** 値がオブジェクト（配列を除く）か */
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `{type: ..., ...}` の値の取り方を YAML の Map から読む */
const ruleOf = (node) => {
  if (!isMap(node)) {
    return undefined;
  }
  const rule = node.toJSON();
  return isRecord(rule) ? rule : undefined;
};

/** 行の `paths` に当たった YAML のレコードの `field` の列の値を、重ねずに集める */
const collectTypes = async ({ row, field, configDir }) => {
  const paths = row.get("paths")?.toJSON() ?? [];
  const records = row.get("records");
  const recordsKey = isScalar(records) ? String(records.value) : undefined;
  const files = new Set();
  for (const pattern of Array.isArray(paths) ? paths : []) {
    for await (const path of glob(String(pattern), { cwd: configDir })) {
      files.add(path);
    }
  }
  const values = new Set();
  for (const path of [...files].sort()) {
    const data = parse(await readFile(resolve(configDir, path), "utf8"));
    const list =
      recordsKey === undefined
        ? [data]
        : isRecord(data) && Array.isArray(data[recordsKey])
          ? data[recordsKey]
          : [];
    for (const record of list) {
      if (isRecord(record) && record[field] !== undefined) {
        values.add(String(record[field]));
      }
    }
  }
  return [...values];
};

/** 設定の `aliases` の v0.2.0 の構造の行を、alias-inject v0.3.0 の構造へ書き換える */
export const migrateAliasRows = async ({ doc, configDir }) => {
  const notices = [];
  const problems = [];
  let changed = false;
  const rows = doc.get("aliases");
  const items = rows?.items ?? [];
  for (const [position, row] of items.entries()) {
    if (!isMap(row) || row.has("alias_type")) {
      continue;
    }
    const metadata = row.get("metadata");
    if (!isMap(metadata) || !metadata.has("alias_type")) {
      continue;
    }
    const label = `aliases[${position}]（${row.get("id")}）`;
    const typeRule = ruleOf(metadata.get("alias_type", true));
    let aliasType;
    if (typeRule?.type === "custom") {
      aliasType = String(typeRule.value);
    } else if (typeRule?.type === "ref" && typeof typeRule.field === "string") {
      const types = await collectTypes({
        row,
        field: typeRule.field,
        configDir,
      });
      if (types.length === 0) {
        problems.push(
          `${label}はレコードが無く、種類を決められません。行に \`alias_type\` を記載してください。`,
        );
        continue;
      }
      if (types.length > 1) {
        problems.push(
          `${label}はレコードの \`${typeRule.field}\` から種類を 1 つに決められません（${types.join("・")}）。種類ごとに行を分け、行に \`alias_type\` を記載してください。`,
        );
        continue;
      }
      aliasType = types[0];
    } else {
      continue;
    }
    metadata.delete("alias_type");
    for (const pair of [...metadata.items]) {
      const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
      const rule = ruleOf(pair.value);
      if (rule?.type === "ref" && typeof rule.field === "string") {
        metadata.set(key, rule.field);
      } else if (rule?.type === "custom") {
        metadata.delete(key);
        notices.push(
          `${label}の \`metadata.${key}\` の固定値 \`${String(rule.value)}\` を除外しました。必要なら YAML の列に記載してください。`,
        );
      }
    }
    if (metadata.items.length === 0) {
      row.delete("metadata");
    }
    row.set("alias_type", aliasType);
    changed = true;
  }
  return { changed, notices, problems };
};

/** スクリプトとして呼ばれたとき、`--config` の設定ファイルを書き換える */
const main = async () => {
  const configPath = argv[argv.indexOf("--config") + 1];
  const doc = parseDocument(await readFile(configPath, "utf8"));
  const result = await migrateAliasRows({
    doc,
    configDir: dirname(configPath),
  });
  if (result.problems.length > 0) {
    stderr.write(`${result.problems.join("\n")}\n`);
    exit(1);
  }
  if (result.changed) {
    await writeFile(configPath, doc.toString({ flowCollectionPadding: false }));
  }
  if (result.notices.length > 0) {
    stdout.write(`${result.notices.join("\n")}\n`);
  }
};

if (
  argv[1] !== undefined &&
  resolve(argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
