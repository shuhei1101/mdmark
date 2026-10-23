// PoC: 先頭と末尾に合言葉を置いた 9,000 文字の索引を additionalContext で返す
const HEAD = "mdmark の使い方集の索引。先頭の合言葉: POC-INDEX-HEAD-3a8f\n";
const TAIL = "\n末尾の合言葉: POC-INDEX-TAIL-b62c";
const TARGET_LENGTH = 9000;
const ROW = "| 例の名前 | 例を読むとき | 例の概要の文 |\n";
let body = HEAD;
while (body.length + ROW.length + TAIL.length <= TARGET_LENGTH) body += ROW;
const context = body + TAIL;
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  }),
);
