// 書き出した HTML と CSP のページを、ライトとダークで開いて結果を集める
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2];
const { chromium } = await import(resolve(repo, "node_modules/playwright/index.mjs"));
const css = await readFile(resolve(repo, "src/index.css"), "utf8");
const diagrams = await readFile(resolve(here, "diagrams.html"), "utf8");

const server = createServer(async (req, res) => {
  const name = req.url === "/" ? "/page.html" : req.url.split("?")[0];
  try {
    let body;
    if (name === "/index.css") body = css;
    else if (name === "/page.html") body = page;
    else body = await readFile(resolve(here, `.${name}`), "utf8");
    const type = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html" }[extname(name)];
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;
// vscode/src/preview/html.ts の buildCsp と同じ規則（cspSource の代わりにページの origin）
const dist = "https://cdn.jsdelivr.net";
const csp = [
  "default-src 'none'",
  `script-src 'nonce-poc' ${dist} ${origin}`,
  `style-src ${dist} ${origin} 'unsafe-inline'`,
  `img-src ${origin} https: data:`,
  `media-src ${origin} https: data:`,
  `font-src ${dist} ${origin}`,
  `connect-src ${dist}`,
].join("; ");
const page = (await readFile(resolve(here, "page.template.html"), "utf8")).replace("__CSP__", csp).replace("__DIAGRAMS__", diagrams);

const browser = await chromium.launch();
const results = { csp };
for (const scheme of ["light", "dark"]) {
  for (const target of ["export", "csp"]) {
    const context = await browser.newContext({ colorScheme: scheme });
    const p = await context.newPage();
    const external = [];
    const consoleErrors = [];
    p.on("request", (r) => {
      if (!/^(file|data|blob):/.test(r.url())) external.push(r.url());
    });
    p.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    const url = target === "export" ? pathToFileURL(resolve(here, "out/export.html")).href : `${origin}/page.html`;
    await p.goto(url);
    await p.waitForFunction(() => window.__poc !== undefined, null, { timeout: 60000 });
    const poc = await p.evaluate(() => window.__poc);
    const cspViolations = await p.evaluate(() => window.__csp ?? []);
    await p.screenshot({ path: resolve(here, `out/${target}-${scheme}.png`), fullPage: true });
    results[`${target}-${scheme}`] = {
      poc,
      cspViolations,
      externalRequests: target === "export" ? external : external.filter((u) => !u.startsWith(origin)).length,
      consoleErrors,
    };
    await context.close();
  }
}
await browser.close();
server.close();
await writeFile(resolve(here, "out/results.json"), `${JSON.stringify(results, null, 2)}\n`);
for (const [key, value] of Object.entries(results)) {
  if (key === "csp") continue;
  const failed = value.poc.checks.filter((c) => !c.match);
  console.log(key, {
    svgs: value.poc.svgs,
    errors: value.poc.errors,
    checks: `${value.poc.checks.length - failed.length}/${value.poc.checks.length}`,
    failed,
    font: value.poc.font.match,
    csp: value.cspViolations,
    external: Array.isArray(value.externalRequests) ? value.externalRequests.length : value.externalRequests,
    consoleErrors: value.consoleErrors,
  });
}
