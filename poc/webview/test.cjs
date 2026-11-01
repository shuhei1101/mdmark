// プレビューと同じ CSP に media-src を足した Webview に video・audio を置き、形式ごとに canplay と再生位置の進みを確かめる
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const vscode = require("vscode");

const FIXTURES = join(__dirname, "..", "fixtures");
const MEDIA = [
  { tag: "video", file: "video.mp4", required: true },
  { tag: "audio", file: "audio.m4a", required: true },
  { tag: "audio", file: "audio.mp3", required: true },
  { tag: "video", file: "video.webm", required: false },
  { tag: "audio", file: "audio.ogg", required: false },
  { tag: "audio", file: "audio.wav", required: false },
  { tag: "video", file: "video.mov", required: false },
  { tag: "video", file: "video-vp8.webm", required: false },
  { tag: "audio", file: "audio-aac.mp4", required: false },
];

/** プレビューの buildCsp（vscode/src/preview/html.ts）と同じ並びに media-src を足した CSP */
function buildCsp({ nonce, cspSource }) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${cspSource}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `img-src ${cspSource} https: data:`,
    `media-src ${cspSource} https: data:`,
    `font-src ${cspSource}`,
  ].join("; ");
}

function pageScript() {
  const vscodeApi = acquireVsCodeApi();
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  // 1 つずつ要素を作り、イベントを待ち受けてから src を入れる（先に入れると canplay を取り逃す）
  async function check({ tag, file, src }) {
    const element = document.createElement(tag);
    element.controls = true;
    element.preload = "auto";
    document.body.append(element);
    const result = {
      file,
      canplay: false,
      error: null,
      play: null,
      currentTime: 0,
      audioDecodedBytes: 0,
    };
    const pending = Promise.race([
      new Promise((done) =>
        element.addEventListener("canplay", () => done("canplay"), {
          once: true,
        }),
      ),
      new Promise((done) =>
        element.addEventListener("error", () => done("error"), { once: true }),
      ),
      wait(10000).then(() => "timeout"),
    ]);
    element.src = src;
    const ready = await pending;
    result.canplay = ready === "canplay";
    if (!result.canplay) {
      result.error =
        ready === "error"
          ? `MediaError ${element.error?.code} ${element.error?.message ?? ""}`
          : "timeout";
      return result;
    }
    try {
      await element.play();
      result.play = "ok";
    } catch (error) {
      // 自動再生の制限で止まったときは、使う人が押したときと同じく、クリック（ユーザーの操作）の中で再生する
      result.play = `${error.name} → `;
      result.play += await Promise.race([
        new Promise((done) => {
          window.addEventListener(
            "pointerdown",
            () =>
              element.play().then(
                () => done("click ok"),
                (retry) => done(`click ${retry.name}`),
              ),
            { once: true },
          );
        }),
        wait(30000).then(() => "click timeout"),
      ]);
    }
    const start = element.currentTime;
    await wait(1000);
    result.currentTime = element.currentTime - start;
    // 音声の復号が進んだか（Chromium の webkitAudioDecodedByteCount）
    result.audioDecodedBytes = element.webkitAudioDecodedByteCount ?? null;
    element.pause();
    return result;
  }
  (async () => {
    const results = [];
    for (const item of JSON.parse(document.body.dataset.media)) {
      results.push(await check(item));
    }
    vscodeApi.postMessage({ results, userAgent: navigator.userAgent });
  })();
}

exports.run = async () => {
  const panel = vscode.window.createWebviewPanel(
    "pocMedia",
    "PoC media",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(FIXTURES)],
    },
  );
  const { webview } = panel;
  const nonce = "pocnonce0123456789";
  const media = MEDIA.map(({ tag, file }) => ({
    tag,
    file,
    src: webview.asWebviewUri(vscode.Uri.file(join(FIXTURES, file))).toString(),
  }));
  const mediaAttribute = JSON.stringify(media)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  const received = new Promise((done) => webview.onDidReceiveMessage(done));
  webview.html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${buildCsp({ nonce, cspSource: webview.cspSource })}">
</head><body data-media="${mediaAttribute}"><script nonce="${nonce}">(${pageScript.toString()})();</script></body></html>`;
  const message = await Promise.race([
    received,
    new Promise((_, fail) =>
      setTimeout(() => fail(new Error("Webview から結果が来ない")), 120000),
    ),
  ]);
  const report = {
    vscode: vscode.version,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    userAgent: message.userAgent,
    results: message.results.map((result) => ({
      ...result,
      required: MEDIA.find((item) => item.file === result.file).required,
    })),
  };
  writeFileSync(
    join(process.env.POC_OUT_DIR, `result-${vscode.version}.json`),
    JSON.stringify(report, null, 2),
  );
  panel.dispose();
};
