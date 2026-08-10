#!/usr/bin/env node
// site-builder.mjs — 静态站点生成器(参考 ai-pulse 的 build.mjs 模式)
// 读 data/ranking-*.json → 产出 docs/ 下完整站点:
//   首页(头条+时间线)、月历存档、日归档(每份报告)、RSS、sitemap、robots
// 零依赖,纯 Node.js ESM。用法: node site-builder.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DATA_DIR = join(ROOT, "data");
const DOCS = join(ROOT, "docs");

// ---------- 收集所有 ranking ----------
function loadAllRankings() {
  if (!existsSync(DATA_DIR)) return [];
  const files = readdirSync(DATA_DIR)
    .filter((f) => /^ranking-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => ({ file: f, date: f.replace(/^ranking-|\.json$/g, "") }))
    .sort((a, b) => b.date.localeCompare(a.date)); // 倒序(最新在前)
  return files.map(({ file, date }) => {
    try {
      return { date, data: JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) };
    } catch (e) {
      return { date, data: null, error: String(e) };
    }
  }).filter((x) => x.data);
}

// ---------- 工具 ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmtStars = (n) => { if (n == null) return "—"; if (n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,"")+"k"; return String(n); };
const fmtDelta = (d) => { if (d == null) return "—"; if (d === 0) return "持平"; return (d>0?"+":"")+d; };

// 生成日期的"头条描述":榜单第一名 + 新进榜数
function headline(ranking) {
  const top = ranking.top10?.[0];
  if (!top) return "今日榜单为空";
  const newCount = ranking.top10?.filter(t => t.is_new && !t.is_baseline).length || 0;
  const parts = [`${top.full_name} 领跑(★${fmtStars(top.today_stars)})`];
  if (newCount > 0) parts.push(`${newCount} 个新进榜`);
  if (ranking.watchlist_count > 0) parts.push(`关注 ${ranking.watchlist_count} 项`);
  return parts.join(" · ");
}

// ---------- 页面片段 ----------
function masthead(activeNav = "") {
  const navItem = (key, label, href) =>
    `<a class="nav-item ${activeNav === key ? "active" : ""}" href="${href}">${label}</a>`;
  return `<header class="masthead">
  <div class="wrap masthead-inner">
    <div class="brand">
      <h1 class="logo">🔥 <a href="index.html">AI 新项目崛起榜</a></h1>
      <p class="tagline">每天发现近 60 天新建、星数最高的 AI 项目</p>
    </div>
    <nav class="nav">${navItem("home","首页","index.html")}${navItem("archive","存档","archive.html")}${navItem("watch","关注","watchlist.html")}${navItem("src","源码","https://github.com/mmlong818/ai-trending")}</nav>
  </div>
</header>`;
}

function footer() {
  return `<footer class="foot">
  <div class="wrap">
    <p>每天 12:00 自动更新 · 数据源 GitHub Search API · <a href="https://github.com/mmlong818/ai-trending">源代码</a></p>
    <p class="muted">候选池:近 60 天新建的 AI 项目 · 按总星排序 = 崛起热度</p>
  </div>
</footer>`;
}

// 渲染单个项目卡片(用于日归档页的榜单)
function repoCard(t, opts = {}) {
  const intro = t.zh_intro || "";
  const showIntro = intro && intro.trim().length > 20;
  const tags = [];
  if (t.is_baseline) tags.push(`<span class="badge badge-base">📋 基线</span>`);
  else if (t.is_new) tags.push(`<span class="badge badge-new">🆕 新进榜</span>`);
  if (t.is_changed && !t.is_new && !t.is_baseline) tags.push(`<span class="badge badge-hot">🔥 ${esc(t.change_reason||"有变化")}</span>`);
  if (opts.watched && t.in_ranking) tags.push(`<span class="badge badge-rank">📍榜内</span>`);
  if (opts.watched && !t.in_ranking) tags.push(`<span class="badge">榜外</span>`);
  const topics = (t.topics||[]).slice(0,6).map(tp=>`<span class="topic">${esc(tp)}</span>`).join("");
  const stars = t.today_stars ?? t.stars;
  const delta = t.delta;
  return `<article class="card${opts.changed?" card-changed":""}${opts.watched?" card-watched":""}">
  <div class="card-head">
    <div class="card-title">
      ${opts.rank?`<span class="rank">#${opts.rank}</span>`:""}
      <a href="${esc(t.url||"https://github.com/"+t.full_name)}" target="_blank" rel="noopener">${esc(t.full_name)}</a>
      ${tags.join("")}
    </div>
    <div class="card-stats"><span class="stat-delta">${fmtDelta(delta)}</span><span class="stat-stars">★ ${fmtStars(stars)}</span></div>
  </div>
  ${t.description?`<p class="desc">${esc(t.description)}</p>`:""}
  ${showIntro?`<div class="intro">${intro}</div>`:""}
  <div class="card-meta">
    ${t.language?`<span>${esc(t.language)}</span>`:""}
    ${t.license?`<span>${esc(t.license)}</span>`:""}
    ${t.created_at?`<span>建于 ${esc(t.created_at.slice(0,10))}</span>`:""}
    <a class="gh-link" href="${esc(t.url||"https://github.com/"+t.full_name)}" target="_blank" rel="noopener">GitHub ↗</a>
  </div>
  ${topics?`<div class="topics">${topics}</div>`:""}
</article>`;
}

// ---------- 各类页面 ----------
function renderHome(rankings) {
  const latest = rankings[0];
  const hero = latest ? `
    <section class="hero">
      <p class="hero-date">${latest.date}</p>
      <h2 class="hero-title"><a href="day/${latest.date}.html">今日榜单 · ${headline(latest.data)}</a></h2>
      <p class="hero-sub">${esc(headline(latest.data))} · 候选池 ${latest.data.candidate_pool_size} 个新项目</p>
      <a class="hero-cta" href="day/${latest.date}.html">查看完整榜单 →</a>
    </section>` : `<section class="hero"><p class="muted">暂无报告,等待首次运行。</p></section>`;

  // 时间线:最近 14 份
  const recent = rankings.slice(1, 14);
  const timeline = recent.length === 0 ? "" : `
    <section class="timeline-section">
      <h3 class="section-title">近期报告</h3>
      <div class="feed">
        ${recent.map(r => {
          const newCount = r.data.top10?.filter(t=>t.is_new&&!t.is_baseline).length||0;
          const top1 = r.data.top10?.[0];
          return `<article class="feed-card">
            <div class="feed-date">${r.date}</div>
            <div class="feed-body">
              <a class="feed-title" href="day/${r.date}.html">${top1?esc(top1.full_name)+" 领跑":"榜单"}</a>
              <p class="feed-sub">${newCount>0?newCount+" 个新进榜 · ":""}候选池 ${r.data.candidate_pool_size}</p>
            </div>
          </article>`;
        }).join("")}
      </div>
    </section>`;

  return page("首页", `${masthead("home")}
<main class="wrap">
  ${hero}
  ${timeline}
  <p class="archive-link"><a href="archive.html">📚 查看完整历史记录 →</a></p>
</main>
${footer()}`);
}

function renderDay(ranking) {
  const { date, data: r } = ranking;
  const isFirst = r.is_first_run;
  const banner = isFirst ? `<div class="banner">📋 <strong>基线收录日</strong>:首次收录近 60 天新建的 AI 项目,按总星排序。明天起会标注「🆕 新进榜」。</div>` : "";
  const changed = r.top10?.filter(t=>t.is_new||t.is_baseline||t.is_changed) || [];
  const tableRows = (r.top10||[]).map(t => {
    const st = t.is_baseline?"📋":t.is_new?"🆕":t.is_changed?"🔥":"";
    return `<tr><td class="col-rank">${t.rank}</td>
      <td><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.full_name)}</a></td>
      <td class="num">★ ${fmtStars(t.today_stars)}</td>
      <td class="num">${fmtDelta(t.delta)}</td>
      <td>${esc(t.language||"")}</td><td>${st}</td></tr>`;
  }).join("");

  const table = tableRows ? `<section><h2 class="section-title">📊 Top 10 速览</h2>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>项目</th><th>总星数</th><th>日涨星</th><th>语言</th><th>状态</th></tr></thead>
    <tbody>${tableRows}</tbody></table></div></section>` : "";

  const detail = changed.length ? `<section><h2 class="section-title">${isFirst?"🆕 基线项目详解":"🆕 新进榜 / 重大变化"}</h2>${changed.map(t=>repoCard(t,{rank:t.rank,changed:true})).join("")}</section>` : "";

  const watchCards = (r.watchlist_section||[]).map(w=>{
    if (w.error) return `<article class="card card-error"><div class="card-title">${esc(w.full_name)} <span class="badge badge-err">⚠️ ${esc(w.error)}</span></div></article>`;
    return repoCard(w,{watched:true,changed:w.is_changed});
  }).join("");
  const watchSection = (r.watchlist_section||[]).length ? `<section><h2 class="section-title">⭐ 重点关注 <span class="count">${r.watchlist_count}</span></h2>${watchCards}</section>` : "";

  const meta = `<section class="meta-section"><h2 class="section-title">📈 追踪元数据</h2><ul>
    <li>候选池:<strong>${r.candidate_pool_size}</strong> 个 AI 相关新项目(原始 ${r.raw_search_count})</li>
    <li>关键词:<strong>${(r.keywords||[]).length}</strong> 组 · 失败 ${(r.failed_keywords||[]).length} 组</li>
    <li>关注池:<strong>${r.watchlist_count||0}</strong> 项</li>
    <li>数据源:${esc(r.data_source)} · 生成于 ${esc((r.generated_at||"").slice(0,16).replace("T"," "))}</li>
  </ul></section>`;

  return page(`${date} 报告`, `${masthead()}
<main class="wrap">
  <p class="breadcrumbs"><a href="index.html">首页</a> / <a href="archive.html">存档</a> / ${date}</p>
  <h2 class="day-title">${date} AI 新项目崛起榜</h2>
  ${banner}${table}${detail}${watchSection}${meta}
  <p class="archive-link"><a href="archive.html">← 返回存档</a></p>
</main>
${footer()}`);
}

function renderArchive(rankings) {
  // 按月分组的日历
  const byMonth = {};
  for (const r of rankings) {
    const ym = r.date.slice(0,7);
    (byMonth[ym] = byMonth[ym] || []).push(r);
  }
  const months = Object.keys(byMonth).sort((a,b)=>b.localeCompare(a));

  const calendars = months.map(ym => {
    const [y,m] = ym.split("-").map(Number);
    const days = byMonth[ym];
    const dayMap = new Map(days.map(d=>[d.date.slice(8),d]));
    // 该月日历网格
    const first = new Date(Date.UTC(y, m-1, 1));
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let startWeekday = first.getUTCDay(); // 0=Sun
    // 转成周一起头
    startWeekday = (startWeekday + 6) % 7;
    const cells = [];
    for (let i=0;i<startWeekday;i++) cells.push(`<div class="cal-cell empty"></div>`);
    for (let d=1; d<=lastDay; d++) {
      const ds = String(d).padStart(2,"0");
      const fullDate = `${ym}-${ds}`;
      const r = dayMap.get(ds);
      if (r) {
        const newCount = r.data.top10?.filter(t=>t.is_new&&!t.is_baseline).length||0;
        cells.push(`<a class="cal-cell has-report" href="day/${fullDate}.html"><span class="cal-day">${d}</span><span class="cal-count">${newCount>0?newCount+"🆕":"报告"}</span></a>`);
      } else {
        cells.push(`<div class="cal-cell"><span class="cal-day">${d}</span></div>`);
      }
    }
    return `<div class="cal-month"><h3 class="cal-title">${y}年${m}月</h3>
      <div class="cal-grid"><div class="cal-dow">一</div><div class="cal-dow">二</div><div class="cal-dow">三</div><div class="cal-dow">四</div><div class="cal-dow">五</div><div class="cal-dow">六</div><div class="cal-dow">日</div>${cells.join("")}</div></div>`;
  }).join("");

  return page("历史存档", `${masthead("archive")}
<main class="wrap">
  <h2 class="page-title">📚 历史存档</h2>
  <div class="search-box"><input id="search" type="text" placeholder="🔍 搜索项目名 / 关键词…" /><div id="search-results" class="search-results"></div></div>
  <div id="calendars">${calendars || "<p class='muted'>暂无历史报告。</p>"}</div>
</main>
<script>
const RANKINGS = [${rankings.map(r=>{
  const top = r.data.top10||[];
  return `{date:"${r.date}",items:[${top.map(t=>`{t:${JSON.stringify(t.full_name)},d:${JSON.stringify((t.description||"").slice(0,80))},n:${t.is_new&&!t.is_baseline?"true":"false"}}`).join(",")}]}`;
}).join(",")}];
document.getElementById('search').addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  const box = document.getElementById('search-results');
  if (!q) { box.innerHTML=''; return; }
  const words = q.split(/\\s+/);
  const hits = [];
  for (const r of RANKINGS) for (const it of r.items) {
    const blob = (it.t+' '+it.d).toLowerCase();
    if (words.every(w=>blob.includes(w))) hits.push({date:r.date, ...it});
  }
  box.innerHTML = hits.length ? hits.slice(0,30).map(h=>'<a class="search-hit" href="day/'+h.date+'.html">'+h.date+' · '+h.t+(h.n?' 🆕':'')+'</a>').join('') : '<p class="muted">无匹配</p>';
});
</script>
${footer()}`);
}

function renderWatchlistPage(rankings) {
  const latest = rankings[0];
  const note = `<div class="banner">关注列表在本地管理。打开仓库的 <a href="https://github.com/mmlong818/ai-trending/blob/main/web/index.html">web/index.html</a> 添加关注,导出 changes 后由下次运行合流。老牌项目(不在新项目窗口内)只能通过关注追踪。</div>`;
  const watchSection = latest?.data?.watchlist_section || [];
  const cards = watchSection.length ? watchSection.map(w=>{
    if (w.error) return `<article class="card card-error"><div class="card-title">${esc(w.full_name)} <span class="badge badge-err">⚠️ ${esc(w.error)}</span></div></article>`;
    return repoCard(w,{watched:true,changed:w.is_changed});
  }).join("") : "<p class='muted'>暂无关注项目,或今日未运行。</p>";
  return page("重点关注", `${masthead("watch")}
<main class="wrap">
  <h2 class="page-title">⭐ 重点关注</h2>
  ${note}
  <p class="muted">截至 ${latest?.date||"—"},共 ${latest?.data?.watchlist_count||0} 项。</p>
  ${cards}
</main>
${footer()}`);
}

function renderRSS(rankings) {
  const items = rankings.slice(0,20).map(r => `    <item>
      <title>${esc(r.date)} AI 新项目崛起榜 · ${esc(headline(r.data))}</title>
      <link>https://mmlong818.github.io/ai-trending/day/${r.date}.html</link>
      <guid isPermaLink="true">https://mmlong818.github.io/ai-trending/day/${r.date}.html</guid>
      <pubDate>${new Date(r.date+"T12:00:00+08:00").toUTCString()}</pubDate>
      <description>${esc((r.data.top10||[]).slice(0,3).map(t=>t.full_name+" (★"+fmtStars(t.today_stars)+")").join("; "))}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>AI 新项目崛起榜</title>
  <link>https://mmlong818.github.io/ai-trending/</link>
  <description>每天发现近 60 天新建、星数最高的 AI 项目</description>
  <language>zh-CN</language>
${items}
</channel></rss>`;
}

function renderSitemap(rankings) {
  const urls = [`https://mmlong818.github.io/ai-trending/`,`https://mmlong818.github.io/ai-trending/archive.html`];
  for (const r of rankings) urls.push(`https://mmlong818.github.io/ai-trending/day/${r.date}.html`);
  return urls.map(u=>`<url><loc>${u}</loc></url>`).join("");
}
function sitemapWrap(urls){return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;}

// ---------- 页面外壳 ----------
function page(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} · AI 新项目崛起榜</title>
<meta name="description" content="每天发现近 60 天新建、星数最高的 AI 项目">
<link rel="alternate" type="application/rss+xml" title="AI 新项目崛起榜" href="rss.xml">
<style>${getCss()}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function getCss() {
  return `
:root{--bg:#fbfaf7;--surface:#ffffff;--border:#e8e5de;--ink:#1b1a17;--ink-2:#5c5951;--ink-3:#8f8b80;--accent:#b8451f;--accent-soft:#faf1ee;--serif:Georgia,"Times New Roman",serif;--sans:-apple-system,"Segoe UI","Noto Sans SC",sans-serif;--green:#2d7a4f;}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.7;}
a{color:var(--accent);text-decoration:none;}
a:hover{text-decoration:underline;}
.muted{color:var(--ink-3);font-size:14px;}
.wrap{max-width:760px;margin:0 auto;padding:0 20px;}
.masthead{border-bottom:3px double var(--border);padding:24px 0 16px;margin-bottom:8px;}
.masthead-inner{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;}
.logo{margin:0;font-family:var(--serif);font-size:26px;font-weight:normal;}
.logo a{color:var(--ink);}
.tagline{margin:4px 0 0;color:var(--ink-2);font-size:13px;}
.nav{display:flex;gap:18px;font-size:14px;}
.nav-item{color:var(--ink-2);}
.nav-item.active{color:var(--accent);font-weight:600;}
.foot{border-top:3px double var(--border);margin-top:48px;padding:20px 0;font-size:13px;color:var(--ink-3);text-align:center;}
.foot a{color:var(--ink-2);}
main{padding:16px 0 32px;}
.hero{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:28px 28px 24px;margin:8px 0 28px;}
.hero-date{margin:0;color:var(--ink-3);font-size:13px;font-variant-numeric:tabular-nums;}
.hero-title{font-family:var(--serif);font-size:28px;font-weight:normal;margin:8px 0 6px;line-height:1.3;}
.hero-title a{color:var(--ink);}
.hero-sub{margin:0 0 14px;color:var(--ink-2);font-size:15px;}
.hero-cta{display:inline-block;background:var(--accent);color:#fff;padding:8px 18px;border-radius:6px;font-size:14px;}
.hero-cta:hover{background:#9c3a19;text-decoration:none;}
.section-title{font-family:var(--serif);font-size:20px;font-weight:normal;border-bottom:1px solid var(--border);padding-bottom:8px;margin:32px 0 16px;}
.section-title .count{color:var(--ink-3);font-size:14px;font-family:var(--sans);}
.page-title{font-family:var(--serif);font-size:26px;font-weight:normal;margin:8px 0 20px;}
.day-title{font-family:var(--serif);font-size:24px;font-weight:normal;margin:8px 0 16px;}
.breadcrumbs{font-size:13px;color:var(--ink-3);margin:4px 0 8px;}
.banner{background:var(--accent-soft);border:1px solid #e8c9c0;border-radius:8px;padding:12px 16px;margin:12px 0 20px;font-size:14px;}
.feed{display:flex;flex-direction:column;gap:0;}
.feed-card{display:flex;gap:16px;padding:14px 0;border-bottom:1px solid var(--border);}
.feed-date{color:var(--ink-3);font-size:13px;font-variant-numeric:tabular-nums;min-width:90px;padding-top:2px;}
.feed-title{color:var(--ink);font-weight:600;}
.feed-title:hover{color:var(--accent);}
.feed-sub{margin:2px 0 0;color:var(--ink-3);font-size:13px;}
.archive-link{margin:28px 0;text-align:center;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 20px;margin-bottom:14px;}
.card-changed{border-left:4px solid var(--accent);}
.card-watched{border-left:4px solid #c9a227;}
.card-error{border-left:4px solid #c0392b;}
.card-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.card-title{font-size:16px;font-weight:600;}
.card-title a{color:var(--ink);}
.card-title a:hover{color:var(--accent);}
.card-title .rank{color:var(--ink-3);margin-right:6px;}
.card-stats{display:flex;gap:14px;font-variant-numeric:tabular-nums;white-space:nowrap;}
.stat-delta{color:var(--green);font-weight:600;}
.stat-stars{color:#c9a227;}
.desc{color:var(--ink-2);margin:8px 0 0;font-size:14px;}
.intro{margin:12px 0 8px;padding:12px 14px;background:var(--bg);border-radius:8px;font-size:14.5px;}
.intro p{margin:0 0 8px;}
.intro p:last-child{margin-bottom:0;}
.intro strong{color:var(--accent);}
.card-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--ink-3);margin-top:10px;}
.gh-link{margin-left:auto;color:var(--accent);}
.topics{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;}
.topic{font-size:11px;padding:2px 8px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--ink-3);}
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;background:var(--bg);border:1px solid var(--border);margin-left:6px;font-weight:normal;vertical-align:middle;}
.badge-new{color:var(--accent);border-color:var(--accent);}
.badge-base{color:var(--ink-3);border-color:var(--ink-3);}
.badge-hot{color:#c0392b;border-color:#c0392b;}
.badge-rank{color:var(--green);border-color:var(--green);}
.badge-err{color:#c0392b;border-color:#c0392b;}
.table-wrap{overflow-x:auto;}
table{width:100%;border-collapse:collapse;font-size:14px;}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--border);}
th{color:var(--ink-3);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;}
td.num{text-align:right;font-variant-numeric:tabular-nums;}
.col-rank{color:var(--ink-3);width:32px;}
td a{color:var(--accent);}
.meta-section ul{list-style:none;padding:0;font-size:14px;color:var(--ink-2);}
.meta-section li{padding:4px 0;}
.meta-section strong{color:var(--ink);}
.search-box{margin:0 0 28px;}
.search-box input{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:15px;background:var(--surface);color:var(--ink);font-family:var(--sans);}
.search-box input:focus{outline:none;border-color:var(--accent);}
.search-results{margin-top:8px;}
.search-hit{display:block;padding:8px 12px;border-bottom:1px solid var(--border);font-size:14px;}
.search-hit:hover{background:var(--accent-soft);text-decoration:none;}
.cal-month{margin-bottom:36px;}
.cal-title{font-family:var(--serif);font-size:18px;font-weight:normal;margin:0 0 12px;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}
.cal-dow{text-align:center;font-size:12px;color:var(--ink-3);padding:4px 0;font-weight:600;}
.cal-cell{min-height:64px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px;display:flex;flex-direction:column;justify-content:space-between;font-size:13px;}
.cal-cell.empty{background:transparent;border:1px dashed var(--border);opacity:.4;}
.cal-cell.has-report{color:var(--ink);}
.cal-cell.has-report:hover{border-color:var(--accent);text-decoration:none;background:var(--accent-soft);}
.cal-day{font-variant-numeric:tabular-nums;color:var(--ink-2);}
.cal-count{font-size:11px;color:var(--accent);}
@media(max-width:640px){.masthead-inner{flex-direction:column;align-items:flex-start;}.logo{font-size:22px;}.hero-title{font-size:23px;}.nav{flex-wrap:wrap;gap:14px;}.feed-date{min-width:78px;}.cal-cell{min-height:52px;font-size:11px;}td .feed-sub{display:none;}}
`;
}

// ---------- 主流程 ----------
function main() {
  const rankings = loadAllRankings();
  console.log(`▶ 加载 ${rankings.length} 份 ranking`);

  // 清空并重建 docs/
  if (existsSync(DOCS)) rmSync(DOCS, { recursive: true, force: true });
  mkdirSync(join(DOCS, "day"), { recursive: true });
  writeFileSync(join(DOCS, ".nojekyll"), "");

  // 首页
  writeFileSync(join(DOCS, "index.html"), renderHome(rankings));
  // 存档
  writeFileSync(join(DOCS, "archive.html"), renderArchive(rankings));
  // 关注
  writeFileSync(join(DOCS, "watchlist.html"), renderWatchlistPage(rankings));
  // 每份报告的日页
  for (const r of rankings) {
    writeFileSync(join(DOCS, "day", `${r.date}.html`), renderDay(r));
  }
  // RSS / sitemap / robots
  writeFileSync(join(DOCS, "rss.xml"), renderRSS(rankings));
  writeFileSync(join(DOCS, "sitemap.xml"), sitemapWrap(renderSitemap(rankings)));
  writeFileSync(join(DOCS, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: https://mmlong818.github.io/ai-trending/sitemap.xml\n`);

  console.log(`✓ 站点已生成到 docs/ (${rankings.length} 份日页 + 首页 + 存档 + 关注 + RSS + sitemap)`);
}

main();
