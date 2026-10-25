import { createServer, type IncomingMessage } from "node:http";
import {
  createMcpHandler,
  fromJsonSchema,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  McpServer,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import {
  ACCEPT_ALL_VALIDATOR,
  checkArguments,
  type ToolInputSchema,
} from "../../src/plugin/arguments.ts";

/** 既定のポート */
const DEFAULT_PORT = 8782;

/** ポートを上書きする環境変数の名前 */
const PORT_ENV = "MDMARK_PORT";

/** `tools/list` に出す引数の形。`project_dir` は出さない */
const PUBLISHED_SCHEMA: ToolInputSchema = {
  type: "object",
  properties: { message: { type: "string", description: "返す文字列" } },
  required: ["message"],
  additionalProperties: false,
};

/** サーバーが検査に使う引数の形。フックが入れる `project_dir` を許す */
const CHECKED_SCHEMA: ToolInputSchema = {
  ...PUBLISHED_SCHEMA,
  properties: {
    ...PUBLISHED_SCHEMA.properties,
    project_dir: { type: "string" },
  },
  required: [...PUBLISHED_SCHEMA.required, "project_dir"],
};

/** 呼び出しごとに `echo_project_dir` を持つ `McpServer` を作る */
function createPocServer(): McpServer {
  const server = new McpServer(
    { name: "mdmark-poc", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  server.registerTool(
    "echo_project_dir",
    {
      description: "受け取った引数とサーバーのプロセス ID を返す",
      inputSchema: fromJsonSchema(PUBLISHED_SCHEMA, ACCEPT_ALL_VALIDATOR),
    },
    (args) => {
      const mismatch = checkArguments({ schema: CHECKED_SCHEMA, args });
      if (mismatch !== undefined) {
        return { content: [{ type: "text", text: mismatch }], isError: true };
      }
      const text = JSON.stringify({ pid: process.pid, args });
      return { content: [{ type: "text", text }] };
    },
  );
  return server;
}

/** `node:http` の要求を、本文を読み切った組み込みの `Request` にする */
async function toRequest(options: {
  /** 受けた要求 */
  req: IncomingMessage;
  /** 待ち受けているポート */
  port: number;
}): Promise<Request> {
  const { req, port } = options;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    // 同じ名前が複数あるヘッダーは並べて渡す
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        headers.append(name, item);
      }
    }
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://127.0.0.1:${port}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: hasBody && chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
}

const port = Number(process.env[PORT_ENV] ?? DEFAULT_PORT);
const handler = createMcpHandler(createPocServer);
const http = createServer(async (req, res) => {
  const request = await toRequest({ req, port });
  const rejected =
    hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
    originValidationResponse(request, localhostAllowedOrigins());
  const response =
    rejected ??
    (new URL(request.url).pathname === "/mcp"
      ? await handler.fetch(request)
      : new Response("Not Found", { status: 404 }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  // SSE の応答も届いた順に書く
  if (response.body !== null) {
    for await (const chunk of response.body) {
      res.write(chunk);
    }
  }
  res.end();
});
http.listen(port, "127.0.0.1", () => {
  console.log(`listening http://127.0.0.1:${port}/mcp pid=${process.pid}`);
});
