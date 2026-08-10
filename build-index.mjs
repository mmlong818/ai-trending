#!/usr/bin/env node
// build-index.mjs — 扫描 reports/ 下的 *.html,生成首页 index.html。
// 首页按日期倒序列出所有日报,并提供关注管理页面入口。
// 用法: node build-index.mjs

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const REPORT_DIR = join(ROOT, "reports");
const OUT = join(REPORT_DIR, "index.html");

// 扫描所有 YYYY-MM-DD.html
const files = existsSync(REPORT_DIR)
  ? readdirSync(REPORT_DIR)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
      .sort()
      .reverse()
  : [];

// 从每个报告里提取标题/候选池等(读 HTML 的 meta-line)
const items = files.map((f) => {
  const date = f.replace(/\.html$/, "");
  let pool = "";
  try {
    const html = readFileSync(join(REPORT_DIR, f), "utf8");
    const m = html.match(/候选池 (\d+)/);
    if (m) pool = m[1];
  } catch {}
  return { date, file: f, pool };
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 新项目崛起榜</title>
<style>${getCss()}</style>
</head>
<body>
<div class="container">
  <header class="header">
    <h1>🔥 AI 新项目崛起榜</h1>
    <p class="sub">每天 12:00 发现近 60 天新建、星数最高的 AI 项目 + 重点关注</p>
  </header>

  <div class="actions">
    <a class="btn primary" href="watchlist.html">⭐ 关注管理</a>
    <a class="btn" href="https://github.com/mmlong818/ai-trending" target="_blank">源代码 ↗</a>
  </div>

  <section>
    <h2>📅 历史报告 <span class="count">${items.length} 篇</span></h2>
    ${
      items.length === 0
        ? `<p class="empty">暂无报告。运行 <code>node collect.mjs</code> 后再 <code>node render-report.mjs</code>。</p>`
        : `<div class="report-list">${items
            .map(
              (it) => `<a class="report-item" href="${it.file}">
        <span class="report-date">${it.date}</span>
        ${it.pool ? `<span class="report-meta">候选池 ${it.pool}</span>` : ""}
        <span class="report-go">→</span>
      </a>`,
            )
            .join("")}</div>`
    }
  </section>

  <footer class="footer">
    <p>数据源 GitHub Search API · 每天 12:00 更新</p>
  </footer>
</div>
</body>
</html>`;

writeFileSync(OUT, html);
console.log(`✓ 首页已生成: ${OUT} (${items.length} 篇报告)`);

function getCss() {
return `
:root {
  --bg:#0d1117; --panel:#161b22; --panel2:#1c2128; --border:#30363d;
  --text:#c9d1d9; --muted:#8b949e; --accent:#58a6ff; --green:#3fb950; --star:#e3b341;
}
* { box-sizing: border-box; }
body {
  margin:0; background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;
  font-size:15px; line-height:1.6;
}
.container { max-width:760px; margin:0 auto; padding:40px 20px 80px; }
.header h1 { margin:0 0 6px; font-size:26px; }
.header .sub { margin:0; color:var(--muted); font-size:14px; }
.actions { display:flex; gap:10px; margin:20px 0; }
.btn {
  display:inline-block; padding:8px 16px; border-radius:8px; text-decoration:none;
  font-size:14px; background:var(--panel2); border:1px solid var(--border); color:var(--text);
}
.btn.primary { background:var(--accent); color:#000; font-weight:600; border-color:var(--accent); }
section { margin:28px 0; }
h2 { font-size:18px; border-bottom:1px solid var(--border); padding-bottom:8px; margin:0 0 16px; }
h2 .count { color:var(--muted); font-size:13px; font-weight:normal; }
.empty { color:var(--muted); }
code { background:var(--panel2); padding:2px 6px; border-radius:4px; font-size:13px; }
.report-list { display:flex; flex-direction:column; gap:8px; }
.report-item {
  display:flex; align-items:center; gap:14px; padding:14px 18px;
  background:var(--panel); border:1px solid var(--border); border-radius:10px;
  text-decoration:none; color:var(--text); transition:border-color .15s;
}
.report-item:hover { border-color:var(--accent); }
.report-date { font-size:17px; font-weight:600; font-variant-numeric:tabular-nums; }
.report-meta { color:var(--muted); font-size:13px; }
.report-go { margin-left:auto; color:var(--accent); font-size:18px; }
.footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--border); color:var(--muted); font-size:12px; text-align:center; }
@media (max-width:600px){ .container{padding:24px 14px 60px;} .header h1{font-size:22px;} }
`;
}
