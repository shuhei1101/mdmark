import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CASCADE_THEME_VARIABLE,
  cascadeSettings,
  cascadeTheme,
  expectFeaturesOff,
  expectUpperApplied,
  expectUpperNotApplied,
  themeValue,
} from "../cascade.ts";
import { expect, openStandalone, runCli, test } from "../cli.ts";
import { callTool, withMcpClient } from "../plugin.ts";
import { useVscodeE2E } from "../vscode.ts";
import { openCascadedPreview } from "../vscode-cascade.ts";

const e2e = useVscodeE2E();

/** 重ねた設定で決まる見た目（`theme.css` の CSS 変数・固有の部品の文字・注意書きの枠と表の並べ替えのボタンの数）。本文の色は VS Code とブラウザの明暗で変わるため比べない */
async function cascadedLook(
  root: import("@playwright/test").Page | import("@playwright/test").Frame,
): Promise<Record<string, string | number>> {
  return root.evaluate((variable) => {
    const article = document.querySelector(".mdmark");
    return {
      theme:
        article === null
          ? ""
          : getComputedStyle(article).getPropertyValue(variable).trim(),
      slot:
        document.querySelector(".mdmark [data-mdmark-slot]")?.textContent ?? "",
      alerts: document.querySelectorAll(".mdmark .markdown-alert").length,
      sorts: document.querySelectorAll(".mdmark button.mdmark-sort").length,
    };
  }, CASCADE_THEME_VARIABLE);
}

// 端末の設定と上のフォルダの設定を重ね、プレビュー・theme の CSS の保存・mdmark export・export_html を同じ見た目にそろえる（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備: VS Code のプレビューを開く（設定を重ねる）
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: true, applyToExport: true }),
  );
  await expectFeaturesOff(opened.frame);
  await expectUpperApplied(opened.frame);
  // 実行: theme の CSS を書き換えて保存する
  await writeFile(
    join(opened.session.workspaceDir, "theme.css"),
    cascadeTheme("rgb(7, 8, 9)"),
  );
  await expect.poll(() => themeValue(opened.frame)).toBe("rgb(7, 8, 9)");
  const preview = await cascadedLook(opened.frame);
  // 実行: 下のフォルダで mdmark export を流す
  const docs = join(opened.session.workspaceDir, "docs");
  const exported = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "cli/guide.html"],
    docs,
    "",
    { MDMARK_CONFIG: opened.settings },
  );
  expect(exported.code).toBe(0);
  await openStandalone(page, {
    tempDir,
    htmlFile: join(docs, "cli", "guide.html"),
  });
  await expectFeaturesOff(page);
  await expect.poll(() => themeValue(page)).toBe("rgb(7, 8, 9)");
  const cli = await cascadedLook(page);
  expect(cli).toEqual(preview);
  // 実行: Claude Code から export_html を呼ぶ
  const tool = await withMcpClient(
    {
      builtRoot,
      projectDir: docs,
      env: { MDMARK_CONFIG: opened.settings },
    },
    (client) =>
      callTool(client, "export_html", {
        file: "guide.md",
        out: "mcp/guide.html",
      }),
  );
  expect(tool.isError).toBe(false);
  const mcpPage = await page.context().newPage();
  await openStandalone(mcpPage, {
    tempDir,
    htmlFile: join(docs, "mcp", "guide.html"),
  });
  await expectFeaturesOff(mcpPage);
  await expect(mcpPage.locator(".mdmark [data-mdmark-slot]")).toHaveText([
    "greet:世界",
  ]);
  await expect.poll(() => themeValue(mcpPage)).toBe("rgb(7, 8, 9)");
  expect(await cascadedLook(mcpPage)).toEqual(cli);
  await mcpPage.close();
  // 検証: 端末の設定と 2 つの mdmark.config.yaml は書き換わらない
  expect(await opened.configs()).toEqual(opened.before);
});

// 重ねて読む切り替えがオフのとき、プレビューと書き出した HTML の両方で、上のフォルダの設定を当てない（正常シナリオ（最初の 1 つだけを読む））
test("test_normal_when_first_only", async ({ builtRoot, tempDir, page }) => {
  // 準備・実行: VS Code のプレビューを開く
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: false }),
  );
  // 検証
  await expectFeaturesOff(opened.frame);
  await expectUpperNotApplied(opened.frame);
  // 実行: mdmark export
  const docs = join(opened.session.workspaceDir, "docs");
  const exported = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "cli/guide.html"],
    docs,
    "",
    { MDMARK_CONFIG: opened.settings },
  );
  // 検証
  expect(exported.code).toBe(0);
  await openStandalone(page, {
    tempDir,
    htmlFile: join(docs, "cli", "guide.html"),
  });
  await expectFeaturesOff(page);
  await expectUpperNotApplied(page);
});

// 端末の設定を読めないとき、プレビューは帯で知らせ、mdmark export は書き出さず、直した後は書き出す（異常シナリオ（端末の設定を読めない））
test("test_error_when_settings_unreadable", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備・実行: VS Code のプレビューを開く
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: true, applyToExport: true, broken: true }),
  );
  // 検証
  await expect(opened.frame.locator(".mdmark-config-band")).toContainText(
    "settings.yaml",
  );
  // 実行: mdmark export
  const docs = join(opened.session.workspaceDir, "docs");
  const html = join(docs, "cli", "guide.html");
  const failed = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "cli/guide.html"],
    docs,
    "",
    { MDMARK_CONFIG: opened.settings },
  );
  // 検証
  expect(failed.code).toBe(1);
  expect(failed.stderr).toContain("settings.yaml");
  expect(failed.stderr).toContain("3 行目");
  expect(failed.stderr).toContain("字下げと書き方を直してください");
  expect(existsSync(html)).toBe(false);
  expect(await opened.configs()).toEqual(opened.before);
  // 実行: 端末の設定の読めない行を直して、もう一度書き出す
  const fixed = cascadeSettings({ cascade: true, applyToExport: true });
  await writeFile(opened.settings, fixed);
  const succeeded = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "cli/guide.html"],
    docs,
    "",
    { MDMARK_CONFIG: opened.settings },
  );
  // 検証
  expect(succeeded.code).toBe(0);
  expect(existsSync(html)).toBe(true);
  await openStandalone(page, { tempDir, htmlFile: html });
  await expectFeaturesOff(page);
  expect(await readFile(opened.settings, "utf8")).toBe(fixed);
});
