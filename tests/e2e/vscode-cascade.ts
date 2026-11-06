import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Frame } from "@playwright/test";
import {
  cascadeConfigPaths,
  cascadeFolderFiles,
  readConfigs,
  writeSettings,
} from "./cascade.ts";
import type { useVscodeE2E, VscodeSession } from "./vscode.ts";

/** 重ねる設定を持つワークスペースと、ワークスペースの外の端末の設定で VS Code を起動し、`docs/guide.md` のプレビューを開く */
export async function openCascadedPreview(
  e2e: ReturnType<typeof useVscodeE2E>,
  settingsContent: string,
): Promise<{
  session: VscodeSession;
  frame: Frame;
  settings: string;
  /** 端末の設定と 2 つの `mdmark.config.yaml` が起動の前と同じか */
  configs: () => Promise<string[]>;
  before: string[];
}> {
  const settingsDir = await mkdtemp(join(tmpdir(), "mdmark-e2e-settings-"));
  const settings = await writeSettings(settingsDir, settingsContent);
  const session = await e2e.launch({
    files: cascadeFolderFiles(),
    env: { MDMARK_CONFIG: settings },
  });
  const watched = [settings, ...cascadeConfigPaths(session.workspaceDir)];
  const before = await readConfigs(watched);
  await session.openFile("docs/guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith(".mdmark h1");
  return {
    session,
    frame,
    settings,
    configs: () => readConfigs(watched),
    before,
  };
}
