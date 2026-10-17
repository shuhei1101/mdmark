import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse, parseDocument } from "yaml";
import type {
  MigrationStep,
  MigrationTarget,
  MigrationVersion,
} from "../../../../src/cli/migrations.ts";
import { useTempDirs, writeFiles } from "../../helpers/cli.ts";

/** 移行の手順の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/migrations.ts");

/** CLI の誤りを読み込む */
const loadMain = () => import("../../../../src/cli/main.ts");

const createTempDir = useTempDirs();

/** 設定の `legacy` を `renamed` に改める手順 */
const RENAME_STEP: MigrationStep = {
  op: "rename_key",
  description: "legacy を renamed に改める",
  file: "config",
  from: "legacy",
  to: "renamed",
};

/** `steps.yaml` の本文を作る（手順は 1 つ） */
function stepsYaml(lines: string[]): string {
  return ["steps:", ...lines, ""].join("\n");
}

/** 一時フォルダのパッケージに `migrations/{版}/` のファイルを置く */
async function writeMigrations(
  packageDir: string,
  files: Record<string, string>,
): Promise<void> {
  const prefixed = Object.fromEntries(
    Object.entries(files).map(([path, text]) => [`migrations/${path}`, text]),
  );
  await writeFiles(packageDir, prefixed);
}

/** 設定だけを持つ当て先と、設定ファイルの絶対パスを作る */
async function createTarget(
  config: string,
  overrides?: Partial<MigrationTarget>,
): Promise<{ dir: string; target: MigrationTarget }> {
  const dir = await createTempDir();
  await writeFiles(dir, { "mdmark.config.yaml": config });
  return {
    dir,
    target: {
      configPath: join(dir, "mdmark.config.yaml"),
      indexPath: undefined,
      documents: [],
      answers: new Map(),
      ...overrides,
    },
  };
}

/** 版と手順だけを持つ当てる版を作る */
function createVersion(
  steps: MigrationStep[],
  version = "v0.5.0",
  dir = "/package/migrations/v0.5.0",
): MigrationVersion {
  return { version, dir, steps };
}

// 5 つの種類の手順をそのまま返す（正常系）
test("test_validate_steps", async () => {
  // 準備
  const { validateSteps } = await loadModule();
  const raw = {
    steps: [
      {
        op: "rename_key",
        description: "a を b に改める",
        file: "config",
        from: "a",
        to: "b",
      },
      {
        op: "set_default",
        description: "diff を足す",
        file: "config",
        key: "features.diff",
        value: true,
      },
      {
        op: "map_values",
        description: "出力先を読み替える",
        file: "config",
        key: "build.out",
        mapping: { "dist/docs.html": "dist/index.html" },
      },
      {
        op: "replace_mark",
        description: "印を書き換える",
        from: "<!-- note -->",
        to: "<!-- callout -->",
      },
      {
        op: "call",
        description: "用語を移す",
        script: "move-terms.mjs",
        files: ["index"],
      },
    ],
  };
  // 実行
  const { steps, problems } = validateSteps(
    raw,
    "migrations/v0.5.0/steps.yaml",
  );
  // 検証
  expect(problems).toEqual([]);
  expect(steps).toHaveLength(5);
  expect(steps).toMatchObject(raw.steps);
});

// op の必須のプロパティが無いと合わないところを返す（異常系）
test("test_validate_steps_when_required_missing", async () => {
  // 準備
  const { validateSteps } = await loadModule();
  const raw = {
    steps: [
      {
        op: "replace_mark",
        description: "印を書き換える",
        from: "<!-- note -->",
      },
    ],
  };
  // 実行
  const { problems } = validateSteps(raw, "migrations/v0.5.0/steps.yaml");
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("migrations/v0.5.0/steps.yaml");
  expect(problems[0]).toContain("steps[0].to");
});

// 当て直すと結果が変わる手順を拒む（異常系）
test("test_validate_steps_when_not_reapplicable", async () => {
  // 準備
  const { validateSteps } = await loadModule();
  const raw = {
    steps: [
      {
        op: "replace_mark",
        description: "印を書き換える",
        from: "<!-- note -->",
        to: "<!-- note --> 追記",
      },
      {
        op: "map_values",
        description: "出力先を読み替える",
        file: "config",
        key: "build.out",
        mapping: { a: "b", b: "c" },
      },
    ],
  };
  // 実行
  const { problems } = validateSteps(raw, "migrations/v0.5.0/steps.yaml");
  // 検証
  expect(problems).toHaveLength(2);
});

// 拡張子 .ts のスクリプトを拒む（異常系）
test("test_validate_steps_when_script_ts", async () => {
  // 準備
  const { validateSteps } = await loadModule();
  const raw = {
    steps: [
      {
        op: "call",
        description: "用語を移す",
        script: "move.ts",
        files: ["config"],
      },
    ],
  };
  // 実行
  const { problems } = validateSteps(raw, "migrations/v0.5.0/steps.yaml");
  // 検証
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("steps[0].script");
});

// 範囲の版だけを昇順に返す（正常系）
test("test_load_migration_versions", async () => {
  // 準備
  const { loadMigrationVersions } = await loadModule();
  const packageDir = await createTempDir();
  const body = stepsYaml([
    "  - op: rename_key",
    "    description: legacy を renamed に改める",
    "    file: config",
    "    from: legacy",
    "    to: renamed",
  ]);
  await writeMigrations(packageDir, {
    "v0.3.0/steps.yaml": body,
    "v0.4.0/steps.yaml": body,
    "v0.10.0/steps.yaml": body,
    "next/steps.yaml": body,
    "no-steps.yaml": "entries: []\n",
  });
  // 実行
  const versions = await loadMigrationVersions({
    packageDir,
    from: "v0.3.0",
    to: "v0.10.0",
  });
  // 検証
  expect(versions.map((item) => item.version)).toEqual(["v0.4.0", "v0.10.0"]);
  expect(versions[0]?.dir).toBe(join(packageDir, "migrations", "v0.4.0"));
  expect(versions[0]?.steps).toHaveLength(1);
});

// 形の合わない版があれば CliError（異常系）
test("test_load_migration_versions_when_steps_invalid", async () => {
  // 準備
  const { loadMigrationVersions } = await loadModule();
  const { CliError } = await loadMain();
  const packageDir = await createTempDir();
  await writeMigrations(packageDir, {
    "v0.4.0/steps.yaml": stepsYaml([
      "  - description: op が無い",
      "    file: config",
      "    from: legacy",
      "    to: renamed",
    ]),
  });
  // 実行
  const result = loadMigrationVersions({
    packageDir,
    from: "v0.3.0",
    to: "v0.5.0",
  });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("migrations/v0.4.0/steps.yaml");
  await expect(result).rejects.toThrow("steps[0].op");
});

// 版のフォルダの外を指すスクリプトを拒む（異常系）
test("test_load_migration_versions_when_script_outside", async () => {
  // 準備
  const { loadMigrationVersions } = await loadModule();
  const { CliError } = await loadMain();
  const packageDir = await createTempDir();
  await writeMigrations(packageDir, {
    "v0.4.0/steps.yaml": stepsYaml([
      "  - op: call",
      "    description: 外のスクリプトを流す",
      "    script: ../x.mjs",
      "    files: [config]",
    ]),
    "x.mjs": "process.exit(0);\n",
  });
  // 実行
  const result = loadMigrationVersions({
    packageDir,
    from: "v0.3.0",
    to: "v0.5.0",
  });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
});

// 同じ親の下で名前を変え、位置とコメントを保つ（正常系）
test("test_rename_key", async () => {
  // 準備
  const { renameKey } = await loadModule();
  const doc = parseDocument(
    [
      "build:",
      "  # 書き出す先",
      "  out: dist/docs.html",
      "  include: a.md",
      "",
    ].join("\n"),
  );
  // 実行
  const changed = renameKey(doc, "build.out", "build.output");
  // 検証
  expect(changed).toBe(true);
  expect(String(doc)).toBe(
    [
      "build:",
      "  # 書き出す先",
      "  output: dist/docs.html",
      "  include: a.md",
      "",
    ].join("\n"),
  );
});

// 新しいキーがあれば何もしない（正常系）
test("test_rename_key_when_already_renamed", async () => {
  // 準備
  const { renameKey } = await loadModule();
  const text = "build:\n  output: dist/docs.html\n";
  const doc = parseDocument(text);
  // 実行
  const changed = renameKey(doc, "build.out", "build.output");
  // 検証
  expect(changed).toBe(false);
  expect(String(doc)).toBe(text);
});

// 無いキーを足す（正常系）
test("test_set_default", async () => {
  // 準備
  const { setDefault } = await loadModule();
  const doc = parseDocument("features:\n  print: true\n");
  // 実行
  const changed = setDefault(doc, "features.diff", true);
  // 検証
  expect(changed).toBe(true);
  expect(doc.getIn(["features", "diff"])).toBe(true);
});

// あるキーは変えない（正常系）
test("test_set_default_when_present", async () => {
  // 準備
  const { setDefault } = await loadModule();
  const doc = parseDocument("features:\n  diff: false\n");
  // 実行
  const changed = setDefault(doc, "features.diff", true);
  // 検証
  expect(changed).toBe(false);
  expect(doc.getIn(["features", "diff"])).toBe(false);
});

// 表にある値を替え、無い値は残す（正常系）
test("test_map_values", async () => {
  // 準備
  const { mapValues } = await loadModule();
  const doc = parseDocument(
    ["build:", "  include:", "    - docs/**/*.md", "    - a.md", ""].join("\n"),
  );
  // 実行
  const changed = mapValues(doc, "build.include", {
    "docs/**/*.md": "**/*.md",
  });
  // 検証
  expect(changed).toBe(true);
  expect(doc.toJS()).toEqual({ build: { include: ["**/*.md", "a.md"] } });
});

// 当て直しても変わらない（正常系）
test("test_map_values_when_no_match", async () => {
  // 準備
  const { mapValues } = await loadModule();
  const mapping = { "docs/**/*.md": "**/*.md" };
  const doc = parseDocument("build:\n  include:\n    - docs/**/*.md\n");
  mapValues(doc, "build.include", mapping);
  // 実行
  const changed = mapValues(doc, "build.include", mapping);
  // 検証
  expect(changed).toBe(false);
});

// 全ての印を書き換える（正常系）
test("test_replace_mark", async () => {
  // 準備
  const { replaceMark } = await loadModule();
  const text = "前\n<!-- note -->\n中\n<!-- note -->\n後\n";
  // 実行
  const replaced = replaceMark(text, "<!-- note -->", "<!-- callout -->");
  // 検証
  expect(replaced).toBe("前\n<!-- callout -->\n中\n<!-- callout -->\n後\n");
});

// 設定・索引・文書を重なりなく返す（正常系）
test("test_step_files", async () => {
  // 準備
  const { stepFiles } = await loadModule();
  const root = "/work";
  const target: MigrationTarget = {
    configPath: join(root, "mdmark.config.yaml"),
    indexPath: join(root, "docs", "index.yaml"),
    documents: [join(root, "docs", "a.md"), join(root, "docs", "b.md")],
    answers: new Map(),
  };
  const versions = [
    createVersion([
      {
        op: "rename_key",
        description: "索引のキーを改める",
        file: "index",
        from: "a",
        to: "b",
      },
      {
        op: "replace_mark",
        description: "印を書き換える",
        from: "<!-- note -->",
        to: "<!-- callout -->",
      },
      {
        op: "call",
        description: "索引と文書を書き換える",
        script: "move.mjs",
        files: ["index", "documents"],
      },
    ]),
  ];
  // 実行
  const files = stepFiles(versions, target);
  // 検証
  expect(files).toHaveLength(4);
  expect(files[0]).toBe(target.configPath);
  expect(new Set(files)).toEqual(
    new Set([target.configPath, target.indexPath, ...target.documents]),
  );
});

// 索引が無ければ足さない（正常系）
test("test_step_files_when_no_index", async () => {
  // 準備
  const { stepFiles } = await loadModule();
  const target: MigrationTarget = {
    configPath: "/work/mdmark.config.yaml",
    indexPath: undefined,
    documents: [],
    answers: new Map(),
  };
  const versions = [
    createVersion([
      {
        op: "rename_key",
        description: "索引のキーを改める",
        file: "index",
        from: "a",
        to: "b",
      },
    ]),
  ];
  // 実行
  const files = stepFiles(versions, target);
  // 検証
  expect(files).toEqual(["/work/mdmark.config.yaml"]);
});

// rename_key で設定のキーの名前を変えて書き戻す（正常系）
test("test_apply_step", async () => {
  // 準備
  const { applyStep } = await loadModule();
  const { dir, target } = await createTarget("legacy: 1\ntitle: 題\n");
  const version = createVersion([RENAME_STEP]);
  // 実行
  await applyStep({ step: RENAME_STEP, version, target });
  // 検証
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config).toEqual({ renamed: 1, title: "題" });
});

// 手順が触らないフロー形式の並びの書き方を残す（正常系）
test("test_apply_step_keeps_flow_style", async () => {
  // 準備
  const { applyStep } = await loadModule();
  const { dir, target } = await createTarget(
    'legacy: 1\nbuild:\n  include: ["**/*.md"]\n',
  );
  const version = createVersion([RENAME_STEP]);
  // 実行
  await applyStep({ step: RENAME_STEP, version, target });
  // 検証
  const text = await readFile(join(dir, "mdmark.config.yaml"), "utf8");
  expect(text).toContain('include: ["**/*.md"]');
  expect(text).toContain("renamed: 1");
});

// ask の答えを YAML の値として足す（正常系）
test("test_apply_step_when_asked", async () => {
  // 準備
  const { applyStep } = await loadModule();
  const step: MigrationStep = {
    op: "set_default",
    description: "count を足す",
    file: "config",
    key: "count",
    ask: "件数を入れてください",
  };
  const { dir, target } = await createTarget("title: 題\n", {
    answers: new Map([[step, "3"]]),
  });
  const version = createVersion([step]);
  // 実行
  await applyStep({ step, version, target });
  // 検証
  const config = parse(await readFile(join(dir, "mdmark.config.yaml"), "utf8"));
  expect(config.count).toBe(3);
});

// 索引が無ければ file: index の手順は何もしない（正常系）
test("test_apply_step_when_index_missing", async () => {
  // 準備
  const { applyStep } = await loadModule();
  const step: MigrationStep = {
    op: "rename_key",
    description: "索引のキーを改める",
    file: "index",
    from: "a",
    to: "b",
  };
  const { dir, target } = await createTarget("title: 題\n");
  const version = createVersion([step]);
  // 実行
  const result = applyStep({ step, version, target });
  // 検証
  await expect(result).resolves.toBeUndefined();
  expect(await readFile(join(dir, "mdmark.config.yaml"), "utf8")).toBe(
    "title: 題\n",
  );
});

// スクリプトが 0 以外で終わると CliError（異常系）
test("test_apply_step_when_script_fails", async () => {
  // 準備
  const { applyStep } = await loadModule();
  const { CliError } = await loadMain();
  const scriptDir = await createTempDir();
  await writeFiles(scriptDir, { "fail.mjs": "process.exit(1);\n" });
  const step: MigrationStep = {
    op: "call",
    description: "設定をスクリプトで直す",
    script: "fail.mjs",
    files: ["config"],
  };
  const { target } = await createTarget("title: 題\n");
  const version = createVersion([step], "v0.5.0", scriptDir);
  // 実行
  const result = applyStep({ step, version, target });
  // 検証
  await expect(result).rejects.toBeInstanceOf(CliError);
  await expect(result).rejects.toThrow("v0.5.0");
  await expect(result).rejects.toThrow("設定をスクリプトで直す");
  await expect(result).rejects.toThrow("1");
});
