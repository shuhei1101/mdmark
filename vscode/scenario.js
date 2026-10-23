// PoC: 成功条件の観点ごとにパネルを開いて報告を集める
const fs = require("node:fs");
const path = require("node:path");

/** 報告を待つ上限（ミリ秒）。初回は jsDelivr からの読み込みを含む */
const REPORT_TIMEOUT_MS = 30000;
/** テーマを切り替えた後に待つ時間（ミリ秒） */
const THEME_SETTLE_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 見出し 1 の文字が text の報告を探す条件 */
const h1Is = (text) => (r) => r.h1 === text;

async function runScenario({ vscode, openPanel, folder, progress = () => {}, skipTheme = false }) {
  const sample = fs.readFileSync(path.join(folder.fsPath, "sample.md"), "utf8");
  const result = { load: [], update: null, hidden: [], theme: [] };

  // 配布物の読み込みと CSP: style-src の 'unsafe-inline' なし・ありの 2 回
  for (const unsafeInline of [false, true]) {
    progress(`load unsafeInline=${unsafeInline}`);
    const p = openPanel({ folder, retain: false, unsafeInline });
    const t0 = Date.now();
    await p.send(sample);
    const r = await p.waitFor(h1Is("PoC の見本"), REPORT_TIMEOUT_MS);
    result.load.push({ unsafeInline, msToReport: r.at - t0, readyCount: p.state.readyCount, report: r });

    // 本文の差し替え（'unsafe-inline' ありのパネルで）
    if (unsafeInline) {
      await p.send(sample.replace("# PoC の見本", "# 差し替えた本文"));
      const u = await p.waitFor(h1Is("差し替えた本文"), REPORT_TIMEOUT_MS);
      result.update = { h1: u.h1, counts: u.counts };
    }
    p.panel.dispose();
  }

  // 背面からの復帰: retainContextWhenHidden の false・true
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder, "sample.md"));
  for (const retain of [false, true]) {
    progress(`hidden retain=${retain}`);
    const p = openPanel({ folder, retain, unsafeInline: true });
    await p.send(sample);
    await p.waitFor(h1Is("PoC の見本"), REPORT_TIMEOUT_MS);
    const readyBefore = p.state.readyCount;
    // 同じ列にエディタを開いてパネルを背面へ回す
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: false });
    await sleep(500);
    const visibleWhileHidden = p.panel.visible;
    for (const n of [1, 2, 3]) {
      await p.send(sample.replace("# PoC の見本", `# 背面 ${n}`));
    }
    const postedWhileHidden = p.state.posted.slice(-3);
    const tReveal = Date.now();
    p.panel.reveal(vscode.ViewColumn.One);
    let last = null;
    let error = null;
    try {
      last = await p.waitFor(h1Is("背面 3"), REPORT_TIMEOUT_MS);
    } catch (e) {
      error = String(e);
    }
    result.hidden.push({
      retain,
      visibleWhileHidden,
      postedWhileHidden,
      readyBefore,
      readyAfter: p.state.readyCount,
      msFromRevealToLast: last ? last.at - tReveal : null,
      lastH1: last?.h1 ?? null,
      reportsWithHiddenH1: p.state.reports.filter((r) => /^背面 [12]$/.test(r.h1 ?? "")).map((r) => r.h1),
      error,
    });
    p.panel.dispose();
  }

  if (skipTheme) return result;
  progress("theme");
  // 配色の手がかり: ワークスペースの設定でテーマを切り替えて body の class を見る
  const conf = vscode.workspace.getConfiguration("workbench");
  const p = openPanel({ folder, retain: true, unsafeInline: true });
  await p.send(sample);
  await p.waitFor(h1Is("PoC の見本"), REPORT_TIMEOUT_MS);
  for (const theme of ["Default Light Modern", "Default Dark Modern"]) {
    await conf.update("colorTheme", theme, vscode.ConfigurationTarget.Workspace);
    await sleep(THEME_SETTLE_MS);
    const before = p.state.reports.length;
    await p.probe();
    const r = await p.waitFor((x) => p.state.reports.indexOf(x) >= before, REPORT_TIMEOUT_MS);
    result.theme.push({ theme, bodyClass: r.bodyClass });
  }
  await conf.update("colorTheme", undefined, vscode.ConfigurationTarget.Workspace);
  p.panel.dispose();

  return result;
}

module.exports = { runScenario };
