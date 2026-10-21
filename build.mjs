// 把 src/kapaipai-lookup.js 轉成書籤用的 javascript: 網址，產出 dist/bookmarklet.txt 與 dist/install.html
// 用法：node build.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const src = await readFile(new URL('./src/kapaipai-lookup.js', import.meta.url), 'utf8');

const code = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join('\n');

const bookmarklet = 'javascript:' + encodeURIComponent(code);
const hrefAttr = bookmarklet.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>卡拍拍卡號查詢</title>
<style>
  body { margin: 0; background: #fff; color: #222; font: 16px/1.75 -apple-system, "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px; }
  a.bm { display: inline-block; padding: 6px 14px; border: 1px solid #ccc; border-radius: 6px; color: #222; text-decoration: none; font-weight: 700; }
  blockquote { margin: 16px 0; padding: 8px 16px; border-left: 4px solid #ccc; background: #f6f6f6; }
  code { background: #f2f2f2; padding: 1px 5px; border-radius: 4px; }
  textarea { width: 100%; height: 90px; font: 12px/1.4 monospace; }
</style>
</head>
<body>
<main>
<h1>卡拍拍卡號查詢</h1>
<h2>安裝</h2>
<p>把下面這個連結<strong>拖曳到瀏覽器的書籤列</strong>：</p>
<p><a class="bm" href="${hrefAttr}">卡號查詢</a></p>
<blockquote>沒看到書籤列：按 <code>Ctrl+Shift+B</code> 叫出來。拖曳不行的話，新增一個書籤，網址貼上最下面文字框的內容。</blockquote>
<h2>使用</h2>
<ol>
  <li>開啟 <code>https://trade.kapaipai.tw/</code> 任一頁</li>
  <li>按書籤列上的「卡號查詢」，右上角會跳出查詢面板</li>
  <li>輸入卡號（例如 <code>s10a 073</code>、<code>S10a-073</code>、<code>S-P 201</code>），按 Enter</li>
  <li>繁中、日文分兩欄列出編號完全符合的卡；點卡片會在新分頁開啟該卡頁面</li>
</ol>
<p>再按一次書籤可以隱藏／顯示面板，<code>Esc</code> 也可以關閉。</p>
<h2>書籤網址</h2>
<textarea readonly>${bookmarklet.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
</main>
</body>
</html>
`;

await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/bookmarklet.txt', import.meta.url), bookmarklet + '\n');
await writeFile(new URL('./dist/install.html', import.meta.url), html);
console.log(`bookmarklet: ${bookmarklet.length} chars -> dist/bookmarklet.txt, dist/install.html`);
