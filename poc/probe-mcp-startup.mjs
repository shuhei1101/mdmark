// MCP サーバーを起動し、tools/list が返るまでの秒数を出す
import { spawn } from "node:child_process";
const start = Date.now();
const child = spawn("npx", ["-y", "github:shuhei1101/mdmark#poc/claude-code/plugin-mcp", "mcp"], { stdio: ["pipe", "pipe", "inherit"], env: process.env });
let buf = "";
child.stdout.on("data", (d) => {
  buf += d;
  if (buf.includes('"id":1')) { child.stdin.write(JSON.stringify({jsonrpc:"2.0",method:"notifications/initialized"})+"\n"); child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:2,method:"tools/list"})+"\n"); buf=buf.replace('"id":1',''); }
  if (buf.includes('"id":2')) { console.log(`tools/list まで ${((Date.now()-start)/1000).toFixed(1)} 秒`); console.log(buf.includes("read_guide") && buf.includes("check") ? "ツール 2 つ" : buf.slice(0,300)); child.kill(); process.exit(0); }
});
child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"probe",version:"0"}}})+"\n");
setTimeout(() => { console.log("120 秒で打ち切り"); child.kill(); process.exit(1); }, 120000);
