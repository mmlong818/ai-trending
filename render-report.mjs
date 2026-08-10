#!/usr/bin/env node
// render-report.mjs — 把 ranking JSON 渲染成自包含 HTML 报告。
// 用法: node render-report.mjs [YYYY-MM-DD]   (默认今天)
// 依赖: ranking JSON 里的 zh_intro 字段(由 agent 填充中文解读)。
//       若 zh_intro 缺失,该卡片只显示基本信息,不显示中文解读块。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DATA_DIR = join(ROOT, "data");
const REPORT_DIR = join(ROOT, "reports");

const targetDate = process.argv[2] || new Date().toISOString().slice(0, 10);
const rankingPath = join(DATA_DIR, `ranking-${targetDate}.json`);

if (!existsSync(rankingPath)) {
  console.error(`✗ 找不到 ranking 文件: ${rankingPath}`);
  console.error(`  先运行: node collect.mjs`);
  process.exit(1);
}

const ranking = JSON.parse(readFileSync(rankingPath, "utf8"));

if (!existsSync(REPORT_DIR)) mkdirSync(REPORT_DIR, { recursive: true });
const outPath = join(REPORT_DIR, `${targetDate}.html`);
const html = renderHtml(ranking);
writeFileSync(outPath, html);
console.log(`✓ 已生成 HTML 报告: ${outPath}`);

// ---------- 渲染 ----------
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtStars(n) {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function fmtDelta(d) {
  if (d == null) return "—";
  if (d === 0) return "持平";
  return (d > 0 ? "+" : "") + d;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function repoCard(item, opts = {}) {
  const intro = item.zh_intro || "";
  const showIntro = intro && intro.trim().length > 20;
  const statusTags = [];
  if (item.is_new || item.is_baseline) statusTags.push(`<span class="tag tag-new">${item.is_baseline ? "📋 基线" : "🆕 新进榜"}</span>`);
  if (item.is_changed && !item.is_new && !item.is_baseline) statusTags.push(`<span class="tag tag-hot">🔥 ${esc(item.change_reason || "有变化")}</span>`);
  if (opts.inRanking) statusTags.push(`<span class="tag tag-rank">📍榜内 #${opts.rank}</span>`);
  if (opts.outRanking) statusTags.push(`<span class="tag">榜外</span>`);

  const topics = (item.topics || []).slice(0, 8).map((t) => `<span class="topic">${esc(t)}</span>`).join("");

  return `
    <article class="card${opts.changed ? " card-changed" : ""}${opts.watched ? " card-watched" : ""}">
      <div class="card-head">
        <div class="card-title">
          ${opts.rank ? `<span class="rank">#${opts.rank}</span>` : ""}
          <a href="${esc(item.url || `https://github.com/${item.full_name}`)}" target="_blank" rel="noopener">${esc(item.full_name)}</a>
          ${statusTags.join("")}
        </div>
        <div class="card-stats">
          <span class="stat-delta">${fmtDelta(item.delta)}</span>
          <span class="stat-stars">★ ${fmtStars(item.today_stars ?? item.stars)}</span>
        </div>
      </div>
      ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ""}
      ${showIntro ? `<div class="intro">${introToHtml(intro)}</div>` : ""}
      <div class="card-meta">
        ${item.language ? `<span>${esc(item.language)}</span>` : ""}
        ${item.license ? `<span>${esc(item.license)}</span>` : ""}
        ${item.pushed_at ? `<span>更新 ${fmtDate(item.pushed_at)}</span>` : ""}
        ${item.release_guess ? `<span>版本 ${esc(item.release_guess)}</span>` : ""}
        ${opts.watched && item.watched_since ? `<span>⭐ 关注于 ${fmtDate(item.watched_since)}</span>` : ""}
        <a class="gh-link" href="${esc(item.url || `https://github.com/${item.full_name}`)}" target="_blank" rel="noopener">GitHub ↗</a>
      </div>
      ${topics ? `<div class="topics">${topics}</div>` : ""}
    </article>`;
}

// 中文解读渲染:支持 "是什么/核心优势/应用场景" 分段
function introToHtml(intro) {
  // 已是 HTML(含标签)直接返回;纯文本则简单分段
  if (/<(p|h\d|ul|div|strong)/i.test(intro)) return intro.trim();
  // 按 **标题**: 或 换行分段
  return intro
    .split(/\n+/)
    .filter((l) => l.trim())
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

function renderHtml(r) {
  const date = r.date;
  const isFirst = r.is_first_run;
  const banner = isFirst
    ? `<div class="banner">📋 <strong>基线收录日(首次运行)</strong>:展示近 60 天新建、目前星数最高的 AI 项目。明天起会标注哪些是「新进榜」(昨日不在榜、今日上榜),这才是真正值得关注的崛起信号。</div>`
    : "";

  // 分类
  const changed = r.top10.filter((t) => t.is_new || t.is_baseline || t.is_changed);
  const stable = r.top10.filter((t) => !(t.is_new || t.is_baseline || t.is_changed));

  // 速览表
  const tableRows = r.top10
    .map((t) => {
      const st = t.is_baseline ? "📋" : t.is_new ? "🆕" : t.is_changed ? "🔥" : "";
      return `<tr>
        <td class="col-rank">${t.rank}</td>
        <td><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.full_name)}</a></td>
        <td class="num">★ ${fmtStars(t.today_stars)}</td>
        <td class="num">${fmtDelta(t.delta)}</td>
        <td>${esc(t.language || "")}</td>
        <td>${st}</td>
      </tr>`;
    })
    .join("");

  // 关注区
  const watchCards = (r.watchlist_section || [])
    .map((w) => {
      if (w.error) {
        return `<article class="card card-error"><div class="card-title">${esc(w.full_name)} <span class="tag tag-err">⚠️ ${esc(w.error)}</span></div></article>`;
      }
      return repoCard(w, {
        inRanking: w.in_ranking,
        outRanking: !w.in_ranking,
        watched: true,
        changed: w.is_changed,
      });
    })
    .join("");
  const watchSection = (r.watchlist_section || []).length > 0
    ? `<section><h2>⭐ 重点关注 <span class="count">${r.watchlist_section.length}</span></h2>${watchCards}</section>`
    : "";

  const stableSection = stable.length > 0
    ? `<section><h2>🔁 持续上榜(无重大变化)</h2><div class="stable-list">${stable
        .map((t) => `<div class="stable-item">
          <a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.full_name)}</a>
          <span class="num">${fmtDelta(t.delta)}</span>
          <span class="num">★ ${fmtStars(t.today_stars)}</span>
          <span class="stable-desc">${esc((t.description || "").slice(0, 80))}</span>
        </div>`)
        .join("")}</div></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GitHub AI 每日追踪 · ${date}</title>
<style>${getCss()}</style>
</head>
<body>
<div class="container">
  <header class="header">
    <h1>🔥 AI 新项目崛起榜</h1>
    <p class="date">${date} · <a href="index.html">← 返回首页</a></p>
    <p class="meta-line">数据口径:GitHub Search API 快照增量 · 范围:生成式AI · 源:${esc(r.data_source)} · 候选池 ${r.candidate_pool_size}</p>
  </header>

  ${banner}

  <section>
    <h2>📊 今日 Top 10 速览</h2>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>项目</th><th>总星数</th><th>日涨星</th><th>语言</th><th>状态</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>
  </section>

  ${changed.length > 0 ? `<section><h2>${isFirst ? "🆕 基线项目详解(近60天新建·按星排序)" : "🆕 新进榜 / 重大变化"}</h2>${changed.map((t) => repoCard(t, { rank: t.rank, changed: true })).join("")}</section>` : ""}

  ${watchSection}
  ${stableSection}

  <section class="metadata">
    <h2>📈 追踪元数据</h2>
    <ul>
      <li>候选池规模:<strong>${r.candidate_pool_size}</strong> 个 AI 相关仓库(原始搜索 ${r.raw_search_count})</li>
      <li>关键词覆盖:<strong>${(r.keywords || []).length}</strong> 组</li>
      <li>失败关键词:<strong>${(r.failed_keywords || []).length}</strong> 组${(r.failed_keywords || []).length > 0 ? " (" + r.failed_keywords.join(", ") + ")" : ""}</li>
      <li>关注池:<strong>${r.watchlist_count}</strong> 项</li>
      <li>API 额度:${r.rate_limit_at_end ? `core 剩余 ${r.rate_limit_at_end.core_remaining ?? "?"} / search 剩余 ${r.rate_limit_at_end.search_remaining ?? "?"}` : "未知"}</li>
      <li>生成时间:${esc(r.generated_at)}</li>
    </ul>
  </section>

  <footer class="footer">
    <p>由 collect.mjs 采集数据 · render-report.mjs 渲染 · 每天 12:00 自动更新</p>
    <p><a href="https://github.com/mmlong818/ai-trending" target="_blank">源代码</a></p>
  </footer>
</div>
</body>
</html>`;
}

function getCss() {
return `
:root {
  --bg: #0d1117; --panel: #161b22; --panel2: #1c2128; --border: #30363d;
  --text: #c9d1d9; --muted: #8b949e; --accent: #58a6ff; --green: #3fb950;
  --danger: #f85149; --warn: #d29922; --star: #e3b341;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  font-size: 15px; line-height: 1.65;
}
.container { max-width: 900px; margin: 0 auto; padding: 24px 20px 80px; }
.header h1 { margin: 0 0 4px; font-size: 26px; }
.header .date { margin: 0 0 4px; color: var(--accent); font-size: 14px; }
.header .date a { color: var(--accent); }
.header .meta-line { margin: 0; color: var(--muted); font-size: 12px; }
.banner {
  background: rgba(210,153,34,0.1); border: 1px solid var(--warn);
  border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 14px;
}
section { margin: 32px 0; }
h2 { font-size: 18px; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin: 0 0 16px; }
h2 .count { color: var(--muted); font-size: 13px; font-weight: normal; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td a { color: var(--accent); text-decoration: none; }
td a:hover { text-decoration: underline; }
.col-rank { color: var(--muted); width: 32px; }

.card {
  background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 18px 20px; margin-bottom: 14px;
}
.card-changed { border-left: 3px solid var(--accent); }
.card-watched { border-left: 3px solid var(--star); }
.card-error { border-left: 3px solid var(--danger); }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.card-title { font-size: 16px; font-weight: 600; }
.card-title a { color: var(--text); text-decoration: none; }
.card-title a:hover { color: var(--accent); }
.card-title .rank { color: var(--muted); margin-right: 6px; }
.card-stats { display: flex; gap: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stat-delta { color: var(--green); font-weight: 600; }
.stat-stars { color: var(--star); }
.desc { color: var(--muted); margin: 8px 0 0; font-size: 13px; }
.intro { margin: 12px 0 8px; padding: 12px 14px; background: var(--panel2); border-radius: 8px; font-size: 14px; }
.intro p { margin: 0 0 8px; }
.intro p:last-child { margin-bottom: 0; }
.intro strong { color: var(--accent); }
.card-meta { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12px; color: var(--muted); margin-top: 10px; align-items: center; }
.card-meta a { color: var(--muted); }
.gh-link { margin-left: auto; color: var(--accent) !important; }
.topics { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.topic { font-size: 11px; padding: 2px 8px; background: var(--panel2); border: 1px solid var(--border); border-radius: 10px; color: var(--muted); }
.tag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; background: var(--panel2); border: 1px solid var(--border); margin-left: 6px; font-weight: normal; vertical-align: middle; }
.tag-new { color: var(--accent); border-color: var(--accent); }
.tag-hot { color: var(--danger); border-color: var(--danger); }
.tag-rank { color: var(--green); border-color: var(--green); }
.tag-err { color: var(--danger); border-color: var(--danger); }
.stable-list { display: flex; flex-direction: column; gap: 8px; }
.stable-item { display: flex; gap: 12px; align-items: baseline; padding: 8px 12px; background: var(--panel); border-radius: 8px; font-size: 14px; }
.stable-item a { color: var(--accent); text-decoration: none; }
.stable-item .num { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.stable-desc { color: var(--muted); font-size: 12px; margin-left: auto; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
.metadata ul { list-style: none; padding: 0; margin: 0; font-size: 13px; color: var(--muted); }
.metadata li { padding: 4px 0; }
.metadata strong { color: var(--text); }
.footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--muted); font-size: 12px; text-align: center; }
.footer a { color: var(--muted); }
@media (max-width: 600px) {
  .container { padding: 16px 12px 60px; }
  .header h1 { font-size: 22px; }
  .stable-desc { display: none; }
  .card-meta { font-size: 11px; gap: 8px; }
}
`;
}
