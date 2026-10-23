import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { collectCheckIssues } from "./check.ts";
import { findConfigFile } from "./config.ts";
import { cliVersion } from "./versions.ts";

// PoC: read_guide が返す固定の本文
const GUIDE_BODY = "POC-GUIDE-BODY-7d41: 使い方集の本文の代わりの固定の文字列";

// PoC: セッションの開始時にモデルへ届く、ツールの呼び方の説明
const INSTRUCTIONS =
  "mdmark の記法・部品・図の描き方を確かめるときは read_guide に names（使い方集の索引の名前の配列）を渡して本文を読む。合言葉: POC-INSTRUCTIONS-5c9e";

/** 標準入出力で MCP サーバーを立て、read_guide と check を登録する */
export async function runMcp(options: { cwd: string }): Promise<void> {
  const server = new Server(
    { name: "mdmark", version: cliVersion() },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "read_guide",
        description: "使い方集の索引の名前ごとに本文を返す",
        inputSchema: {
          type: "object",
          properties: { names: { type: "array", items: { type: "string" } } },
          required: ["names"],
        },
      },
      {
        name: "check",
        description: "mdmark check と同じ点検をし、ずれの一覧を返す",
        inputSchema: {
          type: "object",
          properties: { config: { type: "string" } },
        },
      },
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};
    if (request.params.name === "read_guide") {
      return { content: [{ type: "text", text: GUIDE_BODY }] };
    }
    if (request.params.name === "check") {
      const config = typeof args.config === "string" ? args.config : undefined;
      const path = await findConfigFile(options.cwd, config);
      const issues = await collectCheckIssues(path);
      return { content: [{ type: "text", text: JSON.stringify(issues) }] };
    }
    return {
      isError: true,
      content: [
        { type: "text", text: `知らないツールです: ${request.params.name}` },
      ],
    };
  });
  await server.connect(new StdioServerTransport());
}
