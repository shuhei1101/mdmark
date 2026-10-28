import net from "node:net";
// 外への要求を数え、あれば例外にする
let count = 0;
const deny = () => {
  count += 1;
  throw new Error("外への要求");
};
net.connect = deny;
net.createConnection = deny;
globalThis.fetch = deny;
process.on("exit", () => console.error(`外への要求: ${count} 件`));
