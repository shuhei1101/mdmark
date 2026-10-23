// PoC: Webview の中で jsDelivr の mdmark を読んで描き、描いた結果を拡張機能へ報告させる
const vscode = require("vscode");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { runScenario } = require("./scenario.js");

/** 読む mdmark の版 */
const MDMARK_TAG = "v0.6.0";
/** 配布物のフォルダの URL */
const DIST = `https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@${MDMARK_TAG}/dist`;

/** 進み具合を書くファイル（Remote で流すときだけ） */
let progressFile = null;
/** 進み具合を 1 行書く */
function progress(line) {
  if (progressFile) fs.appendFileSync(progressFile, `${new Date().toISOString()} ${line}\n`);
}

/** Webview の HTML を組む */
function buildHtml(webview, nonce, unsafeInline) {
  const src = webview.cspSource;
  const style = `https://cdn.jsdelivr.net ${src}${unsafeInline ? " 'unsafe-inline'" : ""}`;
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net ${src}`,
    `style-src ${style}`,
    `img-src ${src} https: data:`,
    `font-src ${src} https://cdn.jsdelivr.net`,
    "connect-src https://cdn.jsdelivr.net",
  ].join("; ");
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<script nonce="${nonce}">
  window.__violations = [];
  document.addEventListener("securitypolicyviolation", (e) => {
    window.__violations.push({ directive: e.violatedDirective, blockedURI: e.blockedURI, sourceFile: e.sourceFile, line: e.lineNumber, sample: e.sample });
  });
</script>
<link rel="stylesheet" href="${DIST}/index.css">
</head><body><div id="doc"></div>
<script type="module" nonce="${nonce}">
  const vscodeApi = acquireVsCodeApi();
  const mdmark = await import("${DIST}/index.js");
  const el = document.getElementById("doc");
  let handle = null;
  // 外部ライブラリの印が描き終わるまで待つ（上限 5 秒）
  async function settle() {
    const until = performance.now() + 5000;
    while (performance.now() < until) {
      const pending = [...el.querySelectorAll("[data-mdmark-slot]")].filter((s) => !s.hasAttribute("data-mdmark-drawn"));
      if (pending.length === 0) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }
  // 描いた結果を集める
  function collect() {
    const node = el.querySelector(".mdmark-diagram-node");
    const count = (sel) => el.querySelectorAll(sel).length;
    return {
      version: mdmark.version(),
      h1: el.querySelector("h1")?.textContent ?? null,
      counts: {
        h2: count("h2"),
        table: count("table"),
        callout: count(".markdown-alert"),
        diagram: count("figure.mdmark-diagram"),
        diagramNode: count(".mdmark-diagram-node"),
        seqHeads: count(".mdmark-diagram-seq-heads > *"),
        hint: count(".mdmark-hint-block, .mdmark-hint-inline"),
        libDrawn: count("[data-poc-drawn]"),
        slot: count("[data-mdmark-slot]"),
        slotDrawn: count("[data-mdmark-drawn]"),
        slotText: [...el.querySelectorAll("[data-mdmark-slot]")].map((s) => s.outerHTML.slice(0, 200)),
      },
      firstNode: node ? { styleAttr: node.getAttribute("style"), computedLeft: getComputedStyle(node).left, computedTop: getComputedStyle(node).top } : null,
      bodyClass: document.body.className,
      violations: window.__violations,
    };
  }
  window.addEventListener("message", async (ev) => {
    const m = ev.data;
    if (m.type === "render") {
      if (handle === null) handle = mdmark.mount(el, { markdown: m.markdown, config: m.config });
      else handle.update(m.markdown);
      const settled = await settle();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      vscodeApi.postMessage({ type: "report", seq: m.seq, at: Date.now(), settled, ...collect() });
    } else if (m.type === "probe") {
      vscodeApi.postMessage({ type: "report", seq: m.seq, at: Date.now(), ...collect() });
    }
  });
  vscodeApi.postMessage({ type: "ready", at: Date.now() });
</script>
</body></html>`;
}

/** パネルを開き、本文の送信と報告の待ち受けを持つ操作の口を返す */
function openPanel({ folder, retain, unsafeInline }) {
  const panel = vscode.window.createWebviewPanel("mdmarkPoc", "mdmark PoC", vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: retain,
    localResourceRoots: [folder],
  });
  const libUrl = panel.webview.asWebviewUri(vscode.Uri.joinPath(folder, "lib", "poc-lib.js")).toString();
  const state = { latest: null, seq: 0, readyCount: 0, readyAt: [], reports: [], posted: [], waiters: [] };
  const config = { libraries: { "poc-lib": libUrl } };
  /** 最後の本文を送る */
  const post = (type) => {
    state.seq += 1;
    const entry = { seq: state.seq, type, visible: panel.visible, returned: "pending" };
    state.posted.push(entry);
    // 送信の結果は待たない（届いたかは報告で見る）
    Promise.resolve(panel.webview.postMessage({ type, seq: state.seq, markdown: state.latest, config })).then((r) => {
      entry.returned = r;
    });
  };
  panel.webview.onDidReceiveMessage((m) => {
    progress(`message ${m.type} ${m.seq ?? ""}`);
    if (m.type === "ready") {
      state.readyCount += 1;
      state.readyAt.push(Date.now());
      if (state.latest !== null) post("render");
    } else if (m.type === "report") {
      state.reports.push(m);
    }
    for (const w of [...state.waiters]) w();
  });
  panel.webview.html = buildHtml(panel.webview, crypto.randomBytes(16).toString("base64"), unsafeInline);
  return {
    panel,
    state,
    libUrl,
    /** 本文を差し替えて送る */
    send(markdown) {
      state.latest = markdown;
      return post("render");
    },
    probe() {
      return post("probe");
    },
    /** 条件に合う報告を待つ */
    waitFor(pred, timeoutMs) {
      return new Promise((resolve, reject) => {
        const check = () => {
          const hit = state.reports.find(pred);
          if (hit) {
            state.waiters = state.waiters.filter((w) => w !== check);
            clearTimeout(timer);
            resolve(hit);
          }
        };
        const timer = setTimeout(() => {
          state.waiters = state.waiters.filter((w) => w !== check);
          reject(new Error(`報告を待ちきれなかった（${timeoutMs} ms）`));
        }, timeoutMs);
        state.waiters.push(check);
        check();
      });
    },
  };
}

/** 検証を流して結果をワークスペースの poc-report.json へ書く */
async function runAndWrite(folder, options = {}) {
  const report = await runScenario({ vscode, openPanel, folder, progress, ...options });
  report.env = { vscodeVersion: vscode.version, remoteName: vscode.env.remoteName ?? null, uiKind: vscode.env.uiKind };
  fs.writeFileSync(path.join(folder.fsPath, "poc-report.json"), JSON.stringify(report, null, 2));
  return report;
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("mdmarkPoc.runAll", () => runAndWrite(vscode.workspace.workspaceFolders[0].uri)),
  );
  // Remote で流すときは、拡張機能のフォルダの autorun.json が指すフォルダで自分で流し、窓を閉じる
  const autorun = path.join(__dirname, "autorun.json");
  if (fs.existsSync(autorun)) {
    const { folder: target } = JSON.parse(fs.readFileSync(autorun, "utf8"));
    fs.rmSync(autorun);
    const folder = vscode.Uri.file(target);
    progressFile = path.join(target, "poc-progress.log");
    progress(`start remote=${vscode.env.remoteName}`);
    runAndWrite(folder, { skipTheme: true })
      .catch((e) => fs.writeFileSync(path.join(target, "poc-report.json"), JSON.stringify({ error: String(e?.stack ?? e) })))
      .finally(() => vscode.commands.executeCommand("workbench.action.closeWindow"));
  }
  return { openPanel, runAndWrite };
}

module.exports = { activate, progress };
