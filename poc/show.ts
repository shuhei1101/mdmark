import { render } from "./src/render.ts";

// 生の HTML のコメント・スクリプト・コードブロックを持つ見本
const SAMPLE = `<!-- features: +a -b -->

段落。<!-- unknown: 1 --> 続き。

<script>window.__flag = "script"</script>

<a href="#" onclick="window.__flag = 'onclick'">属性のリンク</a>

<a href="javascript:window.__flag = 'href'">生のリンク</a>

[記法のリンク](javascript:window.__flag='markdown')

\`\`\`js
const x = 1;
\`\`\`

<details>
<summary>折り畳み</summary>

中の文。

</details>
`;

console.log(
  JSON.stringify(render({ markdown: SAMPLE, libraryMarks: [] }), null, 2),
);
