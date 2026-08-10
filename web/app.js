// 关注列表管理页面逻辑
// localStorage 为工作副本, watchlist.json 为真相源(collect 读取)。
// 操作 → 写 localStorage + push 到本地 changes 队列 → 提示导出给 collect 合流。

const LS_KEY = "github-ai-daily:watchlist";
const LS_CHANGES = "github-ai-daily:changes";
const LS_INITED = "github-ai-daily:inited";

// ---------- 状态 ----------
let state = {
  watchlist: [], // [{full_name, added_at, note}]
  changes: [], // [{op, full_name, note, added_at}]
  today: null, // 最新 ranking 的 top10
};

// ---------- 工具 ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = "toast"; }, 2500);
}

function normalizeRepo(input) {
  const s = (input || "").trim();
  // 接受 owner/repo 或完整 url
  const m = s.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s#?]+?)(?:\/?|[\/#.].*)?$/i);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  if (!owner || !repo) return null;
  return `${owner}/${repo}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtStars(n) {
  if (n == null) return "-";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ---------- localStorage ----------
function loadState() {
  try {
    state.watchlist = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch { state.watchlist = []; }
  try {
    state.changes = JSON.parse(localStorage.getItem(LS_CHANGES) || "[]");
  } catch { state.changes = []; }
}

function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify(state.watchlist));
  localStorage.setItem(LS_CHANGES, JSON.stringify(state.changes));
  localStorage.setItem(LS_INITED, "1");
}

function pushChange(change) {
  state.changes.push({ ...change, added_at: new Date().toISOString() });
  persist();
  renderSyncStatus();
}

// 首次打开:从同目录 data/watchlist.json 灌入(localStorage 空时)
async function bootstrapFromFile() {
  if (localStorage.getItem(LS_INITED) === "1") return; // 已初始化过
  try {
    const res = await fetch("../data/watchlist.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.items) && data.items.length > 0) {
      state.watchlist = data.items.map((it) => ({
        full_name: it.full_name,
        added_at: it.added_at || new Date().toISOString(),
        note: it.note || "",
      }));
      persist();
      toast(`从 watchlist.json 导入 ${state.watchlist.length} 项`);
    }
  } catch (e) {
    // file:// 下 fetch 同目录文件通常可用;失败则忽略(空表)
  }
}

// ---------- 渲染 ----------
function renderSyncStatus() {
  const el = $("#sync-status");
  const n = state.changes.length;
  if (n === 0) {
    el.textContent = "✅ 已同步";
    el.className = "sync-status ok";
  } else {
    el.textContent = `⏳ ${n} 条待合流(去「导入/导出」导出 changes)`;
    el.className = "sync-status pending";
  }
}

function renderWatchlist() {
  const list = $("#watchlist-list");
  const q = ($("#search-input").value || "").toLowerCase().trim();
  $("#wl-count").textContent = state.watchlist.length;

  let items = [...state.watchlist];
  if (q) {
    items = items.filter(
      (it) => it.full_name.toLowerCase().includes(q) || (it.note || "").toLowerCase().includes(q),
    );
  }
  items.sort((a, b) => (a.full_name > b.full_name ? 1 : -1));

  if (items.length === 0) {
    list.innerHTML = `<div class="empty">${q ? "没搜到匹配项" : "暂无关注项目。在上方输入 <code>owner/repo</code> 添加,或去「今日榜单」一键关注。"}</div>`;
    return;
  }

  // 若有 today 数据,把 stars/delta 注入
  const todayMap = new Map((state.today?.top10 || []).map((t) => [t.full_name, t]));
  const wlTodayMap = new Map((state.today?.watchlist_section || []).map((w) => [w.full_name, w]));

  list.innerHTML = items
    .map((it) => {
      const inRanking = todayMap.get(it.full_name);
      const wlExtra = wlTodayMap.get(it.full_name);
      const stars = wlExtra?.stars ?? inRanking?.today_stars;
      const delta = wlExtra?.delta ?? (inRanking && !inRanking.is_new ? inRanking.delta : null);
      const desc = wlExtra?.description || inRanking?.description || "";
      const lang = wlExtra?.language || inRanking?.language || "";
      const tags = [];
      if (inRanking) tags.push(`<span class="tag">📍榜内 #${inRanking.rank}</span>`);
      if (wlExtra?.is_changed) tags.push(`<span class="tag">🔥${wlExtra.change_reason || "有变化"}</span>`);

      return `
      <div class="repo-card ${inRanking ? "in-ranking" : ""}">
        <div class="repo-main">
          <p class="repo-name"><a href="https://github.com/${it.full_name}" target="_blank" rel="noopener">${it.full_name}</a></p>
          ${desc ? `<p class="repo-desc">${escapeHtml(desc)}</p>` : ""}
          <div class="repo-meta">
            <span class="star">★ ${fmtStars(stars)}</span>
            ${delta != null ? `<span class="delta-up">今日 +${delta}</span>` : ""}
            ${lang ? `<span>${escapeHtml(lang)}</span>` : ""}
            <span>关注于 ${fmtDate(it.added_at)}</span>
            ${tags.join("")}
          </div>
          ${it.note ? `<p class="repo-note">📝 ${escapeHtml(it.note)}</p>` : ""}
        </div>
        <div class="repo-actions">
          <button class="btn small" data-edit="${escapeAttr(it.full_name)}">备注</button>
          <button class="btn small danger" data-remove="${escapeAttr(it.full_name)}">取消关注</button>
        </div>
      </div>`;
    })
    .join("");
}

function renderToday() {
  const list = $("#today-list");
  const hint = $("#today-hint");
  if (!state.today) {
    hint.textContent = "未找到 ranking 文件(可能今日还未运行 collect)。运行 node collect.mjs 后刷新。";
    list.innerHTML = "";
    return;
  }
  hint.innerHTML = `📅 <b>${state.today.date}</b> · 候选池 ${state.today.candidate_pool_size} · 关注 ${state.today.watchlist_count} · 数据源 ${escapeHtml(state.today.data_source)}`;
  const wlSet = new Set(state.watchlist.map((w) => w.full_name.toLowerCase()));

  if (!state.today.top10 || state.today.top10.length === 0) {
    list.innerHTML = `<div class="empty">今日榜单为空(首日无 diff 属正常,次日才有真实涨星排名)。</div>`;
    return;
  }

  list.innerHTML = state.today.top10
    .map((t) => {
      const watched = wlSet.has(t.full_name.toLowerCase());
      return `
      <div class="repo-card ${t.is_new ? "in-ranking" : ""}">
        <div class="repo-main">
          <p class="repo-name">
            <span style="color:var(--muted)">#${t.rank}</span>
            <a href="https://github.com/${t.full_name}" target="_blank" rel="noopener">${t.full_name}</a>
            ${t.is_new ? '<span class="tag">🆕新入榜</span>' : ""}
          </p>
          ${t.description ? `<p class="repo-desc">${escapeHtml(t.description)}</p>` : ""}
          <div class="repo-meta">
            <span class="delta-up">今日 +${t.delta}</span>
            <span class="star">★ ${fmtStars(t.today_stars)}</span>
            ${t.language ? `<span>${escapeHtml(t.language)}</span>` : ""}
            ${t.change_reason ? `<span class="tag">${escapeHtml(t.change_reason)}</span>` : ""}
          </div>
        </div>
        <div class="repo-actions">
          <button class="btn small ${watched ? "" : "primary"}" data-watch="${escapeAttr(t.full_name)}" ${watched ? "disabled" : ""}>
            ${watched ? "✓ 已关注" : "⭐ 关注"}
          </button>
        </div>
      </div>`;
    })
    .join("");
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}

// ---------- 操作 ----------
function addWatch(repoInput, note = "") {
  const fn = normalizeRepo(repoInput);
  if (!fn) { toast("格式无效,请用 owner/repo", true); return false; }
  if (state.watchlist.some((w) => w.full_name.toLowerCase() === fn.toLowerCase())) {
    toast("已在关注列表", true);
    return false;
  }
  state.watchlist.push({ full_name: fn, added_at: new Date().toISOString(), note });
  pushChange({ op: "add", full_name: fn, note });
  toast(`已关注 ${fn}`);
  renderWatchlist();
  renderToday();
  return true;
}

function removeWatch(fullName) {
  if (!confirm(`确定取消关注 ${fullName}?`)) return;
  state.watchlist = state.watchlist.filter((w) => w.full_name.toLowerCase() !== fullName.toLowerCase());
  pushChange({ op: "remove", full_name: fullName });
  toast(`已取消关注 ${fullName}`);
  renderWatchlist();
  renderToday();
}

function editNote(fullName) {
  const cur = state.watchlist.find((w) => w.full_name.toLowerCase() === fullName.toLowerCase());
  const note = prompt(`备注 for ${fullName}:`, cur?.note || "");
  if (note === null) return;
  if (cur) cur.note = note;
  pushChange({ op: "note", full_name: fullName, note });
  toast("备注已更新");
  renderWatchlist();
}

// ---------- 导入导出 ----------
function download(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportWatchlist() {
  download("watchlist.json", {
    items: state.watchlist,
    updated_at: new Date().toISOString(),
  });
  toast("已导出 watchlist.json");
}

function exportChanges() {
  download("watchlist-changes.json", {
    pending: state.changes,
    note: "由管理页面导出;覆盖到 data/watchlist-changes.json 后 collect 会自动合流。",
  });
  toast("已导出 changes(请覆盖到 data/)");
}

async function importFromFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    let added = 0;
    if (Array.isArray(data.items)) {
      // 完整 watchlist
      for (const it of data.items) {
        if (it.full_name && !state.watchlist.some((w) => w.full_name.toLowerCase() === it.full_name.toLowerCase())) {
          state.watchlist.push({ full_name: it.full_name, added_at: it.added_at || new Date().toISOString(), note: it.note || "" });
          pushChange({ op: "add", full_name: it.full_name, note: it.note || "" });
          added++;
        }
      }
    } else if (Array.isArray(data.pending)) {
      // changes 队列:直接并入
      for (const ch of data.pending) {
        state.changes.push(ch);
      }
      // 重新 apply
      for (const ch of data.pending) {
        if (ch.op === "add") {
          if (!state.watchlist.some((w) => w.full_name.toLowerCase() === ch.full_name.toLowerCase())) {
            state.watchlist.push({ full_name: ch.full_name, added_at: ch.added_at || new Date().toISOString(), note: ch.note || "" });
            added++;
          }
        } else if (ch.op === "remove") {
          state.watchlist = state.watchlist.filter((w) => w.full_name.toLowerCase() !== ch.full_name.toLowerCase());
        }
      }
      persist();
    } else {
      throw new Error("格式不识别");
    }
    $("#import-msg").textContent = `✓ 导入完成,新增 ${added} 项,当前共 ${state.watchlist.length} 项`;
    toast(`导入完成,新增 ${added} 项`);
    renderWatchlist();
    renderSyncStatus();
  } catch (e) {
    $("#import-msg").textContent = "✗ " + (e.message || e);
    toast("导入失败", true);
  }
}

// 加载最新 ranking 文件(用于今日榜单 + 注入 stars)
async function loadLatestRanking() {
  // 尝试常见路径:优先按日期倒序找。file:// 下无法列目录,故尝试最近若干天。
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    try {
      const res = await fetch(`../data/ranking-${ds}.json`, { cache: "no-store" });
      if (res.ok) {
        state.today = await res.json();
        return;
      }
    } catch {}
  }
  state.today = null;
}

// ---------- 事件绑定 ----------
function bindEvents() {
  // tabs
  $$(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.remove("active"));
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      $(`#tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  $("#add-btn").addEventListener("click", () => {
    const ok = addWatch($("#add-input").value, $("#add-note").value);
    if (ok) { $("#add-input").value = ""; $("#add-note").value = ""; }
  });
  $("#add-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#add-btn").click();
  });
  $("#search-input").addEventListener("input", renderWatchlist);

  // 委托:关注列表里的按钮
  $("#watchlist-list").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.remove) removeWatch(t.dataset.remove);
    else if (t.dataset.edit) editNote(t.dataset.edit);
  });
  // 今日榜单里的关注按钮
  $("#today-list").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.watch) addWatch(t.dataset.watch);
  });

  $("#export-wl").addEventListener("click", exportWatchlist);
  $("#export-changes").addEventListener("click", exportChanges);
  $("#import-btn").addEventListener("click", () => {
    const f = $("#import-file").files[0];
    if (f) importFromFile(f);
  });
}

// ---------- 启动 ----------
(async function init() {
  loadState();
  await bootstrapFromFile();
  bindEvents();
  await loadLatestRanking();
  renderSyncStatus();
  renderWatchlist();
  renderToday();
})();
