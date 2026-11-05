// PoC: React の Webview の入口。配布物の読み込み・描画・状態の表示・inspect・axe だけを最小で持つ
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./preview.css";
import type { HostMessage, WebviewMessage } from "../../messages.ts";
import type { Mdmark } from "../preview.ts";
import { inspectElements } from "./inspect.ts";
import { PreviewStatus, type StatusState } from "./status.tsx";

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewMessage) => void;
};

type Boot = { distJs?: string; version?: string; test: boolean };

type MountHandle = ReturnType<Mdmark["mount"]>;

type Axe = {
  run: (context: Element) => Promise<{ violations: { id: string }[] }>;
};

const api = acquireVsCodeApi();

/** Webview で起きた CSP の違反（PoC の検証用） */
const cspViolations: string[] = [];
document.addEventListener("securitypolicyviolation", (event) => {
  cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
});

/** テストのときだけ、media/test/axe.js を Webview の URL から読み込んで axe を実行し、違反の ID を返す */
const runAxe = async (): Promise<string[]> => {
  const script = document.querySelector<HTMLScriptElement>(
    "script[src$='preview.js']",
  );
  if (script === null) {
    throw new Error("preview.js の script が無い");
  }
  // axe.min.js は UMD のため、読み込むと window.axe が入る
  await import(
    /* @vite-ignore */ script.src.replace(/preview\.js$/, "test/axe.js")
  );
  const axe = (window as unknown as { axe: Axe }).axe;
  const root = document.getElementById("mdmark-preview");
  if (root === null) {
    throw new Error("#mdmark-preview が無い");
  }
  const result = await axe.run(root);
  return result.violations.map((violation) => violation.id);
};

/** 配布物を実行時の import() で参照する（React Compiler は import() を持つコンポーネントを変換しないため、コンポーネントの外に置く） */
const loadMdmark = (url: string): Promise<Mdmark> =>
  import(/* @vite-ignore */ url);

const PreviewApp = ({ boot }: { boot: Boot }) => {
  const documentRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<MountHandle | undefined>(undefined);
  const [mdmark, setMdmark] = useState<Mdmark | undefined>(undefined);
  const [status, setStatus] = useState<StatusState | undefined>(
    boot.distJs === undefined ? "versionUndecidable" : undefined,
  );

  // 配布物は束ねず、実行時の import() で参照する
  useEffect(() => {
    if (boot.distJs === undefined) {
      return;
    }
    loadMdmark(boot.distJs).then(
      (loaded: Mdmark) => {
        setMdmark(loaded);
      },
      () => {
        setStatus("offline");
        api.postMessage({ type: "loadFailed", reason: "offline" });
      },
    );
  }, [boot.distJs]);

  // mount は React の外の DOM（documentRef の要素）に描かせる
  useEffect(() => {
    if (mdmark === undefined) {
      return;
    }
    const onMessage = (event: MessageEvent<HostMessage>) => {
      const message = event.data;
      const element = documentRef.current;
      if (message.type === "render" && element !== null) {
        if (handleRef.current === undefined) {
          handleRef.current = mdmark.mount(element, {
            markdown: message.markdown,
            config: message.config,
          });
        } else {
          handleRef.current.update(message.markdown);
        }
        setStatus(undefined);
        api.postMessage({ type: "rendered" });
      }
    };
    window.addEventListener("message", onMessage);
    // 受ける用意ができてから ready を送り、拡張機能に render を送らせる
    api.postMessage({ type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      handleRef.current?.destroy();
      handleRef.current = undefined;
    };
  }, [mdmark]);

  // テストのときだけ受ける inspect・axe（配布物を読めないときも受ける）
  useEffect(() => {
    if (!boot.test) {
      return;
    }
    const onMessage = (event: MessageEvent<HostMessage>) => {
      const message = event.data;
      if (message.type === "inspect") {
        void inspectElements(message.selector).then((elements) => {
          api.postMessage({ type: "inspected", id: message.id, elements });
        });
      } else if (message.type === "axe") {
        void runAxe().then((violations) => {
          api.postMessage({
            type: "axed",
            id: message.id,
            violations,
            csp: cspViolations,
          });
        });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [boot.test]);

  return (
    <>
      {status === undefined ? null : (
        <PreviewStatus
          state={status}
          version={boot.version}
          onReload={() => api.postMessage({ type: "reload" })}
        />
      )}
      <div ref={documentRef} hidden={status !== undefined} />
    </>
  );
};

const root = document.getElementById("mdmark-preview");
if (root !== null) {
  const boot: Boot = {
    distJs: root.dataset.distJs,
    version: root.dataset.version,
    test: root.dataset.test !== undefined,
  };
  const container = document.createElement("div");
  root.append(container);
  createRoot(container).render(<PreviewApp boot={boot} />);
}
