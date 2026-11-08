import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { useTempDirs, writeFiles } from "../cli.ts";

/** 設定を重ねて読み込む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../src/config-files.ts");

const createTempDir = useTempDirs();

/** ファイルがあるか */
const isFile = async (path: string): Promise<boolean> =>
  stat(path).then(
    (found) => found.isFile(),
    () => false,
  );

/** 端末の設定と、重ねる設定を持つフォルダ（`work/` と `work/docs/`）を一時フォルダに作る */
const createWork = async (settings: string | undefined) => {
  const root = await createTempDir();
  const files: Record<string, string> = {
    "work/mdmark.config.yaml": "theme: ./theme.css\nfeatures:\n  table: true\n",
    "work/docs/mdmark.config.yaml": "features:\n  table: false\n",
  };
  if (settings !== undefined) {
    files["settings/settings.yaml"] = settings;
  }
  await writeFiles(root, files);
  return {
    work: join(root, "work"),
    settings: join(root, "settings", "settings.yaml"),
  };
};

/** `loadLayeredConfig` を実ファイルで呼ぶ */
const load = async (options: {
  cwd: string;
  settings: string;
  purpose?: "preview" | "export";
  explicit?: string;
}) => {
  const { loadLayeredConfig } = await loadModule();
  return loadLayeredConfig({
    cwd: options.cwd,
    explicit: options.explicit,
    purpose: options.purpose ?? "preview",
    env: { MDMARK_CONFIG: options.settings },
    home: "/nonexistent-home",
    readFile: (path) => readFile(path, "utf8"),
    isFile,
    explicitName: "--config のパス",
  });
};

/** 正常系の端末の設定 */
const CASCADE_SETTINGS =
  "config:\n  cascade: true\nfeatures:\n  callout: false\n";

// 端末の設定と上のフォルダの設定と近いフォルダの設定を重ね、相対パスを記載した設定ファイルから解決する（正常系）
test("test_normal", async () => {
  // 準備
  const { work, settings } = await createWork(CASCADE_SETTINGS);
  // 実行
  const layered = await load({ cwd: join(work, "docs"), settings });
  // 検証
  expect(layered.config.features).toEqual({ callout: false, table: false });
  expect(layered.config.theme).toBe(join(work, "theme.css"));
  expect(layered.files.map((file) => file.path)).toEqual([
    settings,
    join(work, "mdmark.config.yaml"),
    join(work, "docs", "mdmark.config.yaml"),
  ]);
  expect(layered.nearest).toBe(join(work, "docs", "mdmark.config.yaml"));
  expect(layered.issues).toEqual([]);
});

// config.cascade が false のとき、近いフォルダの設定と端末の設定だけを重ねる（正常系（最初の 1 つだけを読み込む））
test("test_normal_when_first_only", async () => {
  // 準備
  const { work, settings } = await createWork(
    "config:\n  cascade: false\nfeatures:\n  callout: false\n",
  );
  // 実行
  const layered = await load({ cwd: join(work, "docs"), settings });
  // 検証
  expect(layered.config.theme).toBeUndefined();
  expect(layered.files.map((file) => file.path)).toEqual([
    settings,
    join(work, "docs", "mdmark.config.yaml"),
  ]);
});

// purpose が export で config.applyToExport が false のとき、端末の設定を重ねない（正常系（書き出しに端末の設定を重ねない））
test("test_normal_when_settings_not_applied_to_export", async () => {
  // 準備
  const { work, settings } = await createWork(
    `${CASCADE_SETTINGS.replace("cascade: true", "cascade: true\n  applyToExport: false")}`,
  );
  // 実行
  const layered = await load({
    cwd: join(work, "docs"),
    settings,
    purpose: "export",
  });
  // 検証
  expect(layered.config.features).toEqual({ table: false });
  expect(layered.files.map((file) => file.path)).not.toContain(settings);
});

// 端末の設定のファイルが無いとき、フォルダの設定だけを重ねる（正常系（端末の設定が無い））
test("test_normal_when_settings_missing", async () => {
  // 準備
  const { work, settings } = await createWork(undefined);
  // 実行
  const layered = await load({ cwd: join(work, "docs"), settings });
  // 検証
  expect(layered.files.map((file) => file.path)).toEqual([
    join(work, "docs", "mdmark.config.yaml"),
  ]);
  expect(layered.issues).toEqual([]);
});

// YAML として読み込めない端末の設定を重ねずに、ずれとして返却する（正常系（読み込めない設定ファイルがある））
test("test_normal_when_unreadable_file", async () => {
  // 準備
  const { work, settings } = await createWork(
    "config:\n  cascade: true\nlibraries: [a, b}\n",
  );
  // 実行
  const layered = await load({ cwd: join(work, "docs"), settings });
  // 検証
  expect(layered.unreadable?.path).toBe(settings);
  expect(layered.unreadable?.line).toBe(3);
  expect(layered.issues).toEqual([]);
  expect(layered.files.map((file) => file.path)).not.toContain(settings);
  expect(layered.config.features).toEqual({ table: false });
});

// explicit のファイルが無いとき、パスを示す例外を投げる（異常系（指定した設定ファイルが無い））
test("test_error_when_explicit_missing", async () => {
  // 準備
  const { ConfigNotFoundError } = await loadModule();
  const { work, settings } = await createWork(undefined);
  // 実行
  const result = load({ cwd: work, settings, explicit: "missing.yaml" });
  // 検証
  await expect(result).rejects.toBeInstanceOf(ConfigNotFoundError);
  await expect(result).rejects.toThrow("missing.yaml");
});
