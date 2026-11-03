// PoC: `<!-- html -->` の範囲の ts を、範囲の根の要素で呼ぶ機構が CSP の下で成立するかを確かめる。
// 経路 1: 書き出した HTML（CSP `script-src 'unsafe-inline'`、blob:・data:・動的 import() を使わない）
// 対照: POC_NO_NONCE=1 で範囲の script 要素に nonce を付けず、CSP が止めることを確かめる（vscode の経路が失敗すれば CSP が効いている）
// 経路 2: VS Code のプレビューと同じ CSP（nonce と配布物の origin で絞った script-src）を meta で指定したページ
import http from "node:http";
import { transform } from "esbuild";
import { chromium, firefox } from "playwright";

/** 範囲に記載する ts（既定のエクスポートの関数が範囲の根の要素を受け、destroy を返す） */
const SOURCE_TS = `
type Root = HTMLElement;
export default function setup(root: Root): () => void {
  const calls: number = Number(root.dataset.pocCalls ?? "0") + 1;
  root.dataset.pocCalls = String(calls);
  root.dataset.pocRan = "1";
  const onClick = (): void => root.classList.toggle("is-open");
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("click", onClick);
    (window as unknown as { __pocDestroyed: number }).__pocDestroyed += 1;
  };
}
`;

/** ts を IIFE に変換し、既定のエクスポートを範囲ごとの登録の関数へ渡す形にする（両方の経路で同じ結果を使う） */
async function compileRange(id) {
  const { code } = await transform(SOURCE_TS, {
    loader: "ts",
    format: "iife",
    globalName: "__mdmarkRange",
    target: "es2022",
  });
  return `(function(){${code}\nwindow.__mdmarkHtmlScripts.register(${JSON.stringify(id)}, __mdmarkRange.default);})();`;
}

/** mount に当たる処理: 登録の表と、範囲の根の要素で呼ぶ・描き直しの前に destroy を呼ぶ処理 */
const RUNTIME = `
window.__pocDestroyed = 0;
window.__mdmarkHtmlScripts = (() => {
  const setups = new Map();
  const destroys = new Map();
  return {
    register(id, setup) { setups.set(id, setup); },
    run() {
      for (const root of document.querySelectorAll("[data-mdmark-html-root]")) {
        const setup = setups.get(root.dataset.mdmarkHtmlRoot);
        if (typeof setup === "function") {
          const destroy = setup(root);
          if (typeof destroy === "function") destroys.set(root, destroy);
        }
      }
    },
    rerender() {
      for (const [root, destroy] of destroys) { destroy(); destroys.delete(root); }
      this.run();
    },
  };
})();
`;

const ROOT_HTML = `<div data-mdmark-html-root="r1"><ul class="tree"><li>features</li></ul></div>`;

const violationsHook = `<script nonce="__NONCE__">window.__pocViolations=[];document.addEventListener("securitypolicyviolation",(e)=>window.__pocViolations.push(e.violatedDirective+" "+e.blockedURI));</script>`;

function exportHtml(rangeCode) {
  // 書き出した HTML: 束ねた 1 つの script に、mount に当たる処理と範囲の関数を入れる
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
${violationsHook.replace(' nonce="__NONCE__"', "")}
</head><body>${ROOT_HTML}
<script>${RUNTIME}\n${rangeCode}\nwindow.__mdmarkHtmlScripts.run();</script>
</body></html>`;
}

function buildCsp({ nonce, distOrigin, cspSource }) {
  // vscode/src/preview/html.ts の buildCsp と同じ値（libraries の origin は無し）
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${distOrigin} ${cspSource}`,
    `style-src ${distOrigin} ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} https: data:`,
    `media-src ${cspSource} https: data:`,
    `font-src ${distOrigin} ${cspSource}`,
    `connect-src ${distOrigin}`,
  ].join("; ");
}

function vscodeHtml({ nonce, distOrigin, cspSource }) {
  const csp = buildCsp({ nonce, distOrigin, cspSource });
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
${violationsHook.replace("__NONCE__", nonce)}
</head><body>${ROOT_HTML}
<script type="module" nonce="${nonce}" src="${cspSource}/preview.js"></script>
</body></html>`;
}

/** パネルのスクリプト: 配布物を動的 import() で読み、mount に当たる関数を呼ぶ（VS Code の webview と同じ読み方） */
function previewJs(distOrigin) {
  return `import(${JSON.stringify(`${distOrigin}/dist.js`)}).then((m) => m.mount());`;
}

/** 配布物: ページの nonce を読み、範囲の関数を nonce を付けた script 要素で動かす */
function distJs(rangeCode) {
  return `${RUNTIME}
const RANGE_CODE = ${JSON.stringify(rangeCode)};
export function mount() {
  const nonce = document.querySelector("script[nonce]")?.nonce ?? "";
  const script = document.createElement("script");
  if (!${JSON.stringify(process.env.POC_NO_NONCE === "1")}) script.nonce = nonce;
  script.textContent = RANGE_CODE;
  document.head.append(script);
  window.__pocNonceRead = nonce !== "";
  window.__mdmarkHtmlScripts.run();
  window.__pocMounted = true;
}
`;
}

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const rangeCode = await compileRange("r1");
const NONCE = "cG9jLW5vbmNlLTEyMzQ1Ng";

let distOrigin = "";
let pageOrigin = "";
const dist = await listen((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/dist.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(distJs(rangeCode));
    return;
  }
  res.statusCode = 404;
  res.end();
});
distOrigin = `http://127.0.0.1:${dist.address().port}`;
const page = await listen((req, res) => {
  if (req.url === "/export.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", "script-src 'unsafe-inline'");
    res.end(exportHtml(rangeCode));
  } else if (req.url === "/vscode.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(vscodeHtml({ nonce: NONCE, distOrigin, cspSource: pageOrigin }));
  } else if (req.url === "/preview.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(previewJs(distOrigin));
  } else {
    res.statusCode = 404;
    res.end();
  }
});
pageOrigin = `http://127.0.0.1:${page.address().port}`;

const results = [];
let failed = false;
for (const [browserName, type] of [
  ["chromium", chromium],
  ["firefox", firefox],
]) {
  const browser = await type.launch();
  for (const route of ["export", "vscode"]) {
    const context = await browser.newContext();
    const pageObj = await context.newPage();
    const scriptRequests = [];
    pageObj.on("request", (r) => {
      const url = r.url();
      if (url.startsWith("blob:") || url.startsWith("data:")) scriptRequests.push(url);
    });
    const errors = [];
    pageObj.on("pageerror", (e) => errors.push(String(e)));
    await pageObj.goto(`${pageOrigin}/${route}.html`);
    if (route === "vscode") {
      await pageObj.waitForFunction(() => window.__pocMounted === true, null, { timeout: 5000 }).catch(() => {});
    }
    const before = await pageObj.evaluate(() => ({
      ran: document.querySelector("[data-mdmark-html-root]").dataset.pocRan ?? null,
      calls: document.querySelector("[data-mdmark-html-root]").dataset.pocCalls ?? "0",
      nonceRead: window.__pocNonceRead ?? null,
    }));
    await pageObj.click("[data-mdmark-html-root]");
    const clickWorks = await pageObj.evaluate(() =>
      document.querySelector("[data-mdmark-html-root]").classList.contains("is-open"),
    );
    const after = await pageObj.evaluate(() => {
      window.__mdmarkHtmlScripts.rerender();
      return {
        destroyed: window.__pocDestroyed,
        calls: document.querySelector("[data-mdmark-html-root]").dataset.pocCalls,
        violations: window.__pocViolations,
      };
    });
    const row = {
      browser: browserName,
      route,
      ran: before.ran === "1",
      callsBeforeRerender: Number(before.calls),
      clickWorks,
      destroyedOnRerender: after.destroyed,
      callsAfterRerender: Number(after.calls),
      blobOrDataRequests: scriptRequests.length,
      violations: after.violations.length,
      nonceRead: before.nonceRead,
      errors,
    };
    const ok =
      row.ran &&
      row.callsBeforeRerender === 1 &&
      row.clickWorks &&
      row.destroyedOnRerender === 1 &&
      row.callsAfterRerender === 2 &&
      row.blobOrDataRequests === 0 &&
      row.violations === 0 &&
      errors.length === 0;
    row.ok = ok;
    if (!ok) failed = true;
    if (after.violations.length > 0) row.violationDetails = after.violations;
    results.push(row);
    await context.close();
  }
  await browser.close();
}
dist.close();
page.close();

console.log(`csp(vscode): ${buildCsp({ nonce: NONCE, distOrigin, cspSource: pageOrigin })}`);
console.log(`compiled range code bytes: ${rangeCode.length}`);
for (const row of results) console.log(JSON.stringify(row));
console.log(failed ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(failed ? 1 : 0);
