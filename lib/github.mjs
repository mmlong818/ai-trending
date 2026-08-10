// GitHub API 封装:限流、重试、Token 可选、统一错误处理。
// 匿名:REST 60 req/h,Search 10 req/min。配 GITHUB_TOKEN 后分别升至 5000/h、30/min。

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.github.com";

// 读取 Token(优先环境变量,其次本目录 .env)
function loadToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const envPaths = [
    join(process.cwd(), ".env"),
    join(process.cwd(), "tools", "github-ai-daily", ".env"),
    join(homedir(), ".github-ai-daily.env"),
  ];
  for (const p of envPaths) {
    if (existsSync(p)) {
      const txt = readFileSync(p, "utf8");
      const m = txt.match(/^GITHUB_TOKEN\s*=\s*(.+)\s*$/m);
      if (m && m[1].trim()) return m[1].trim();
    }
  }
  return null;
}

const TOKEN = loadToken();
export const HAS_TOKEN = !!TOKEN;

function headers(extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-ai-daily/0.1",
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...extra,
  };
}

// 限流间隔:匿名 Search 10/min(6s/req),有 Token 30/min(2s/req)
const SEARCH_INTERVAL_MS = HAS_TOKEN ? 2000 : 6500;
// REST(core) 匿名 60/h,保守 65s/req;有 Token 5000/h 可快
const REST_INTERVAL_MS = HAS_TOKEN ? 1500 : 65000;

let lastSearchAt = 0;
let lastRestAt = 0;

// 全局额度状态:检测到耗尽后跳过同类请求,避免无谓重试/卡死
let coreRemaining = null; // number | null(未知)
let coreResetAt = null; // epoch sec | null
let searchRemaining = null;

function isCoreExhausted() {
  if (coreRemaining !== null && coreRemaining <= 0) {
    // 已过重置时间则解除
    if (coreResetAt && Date.now() / 1000 > coreResetAt) {
      coreRemaining = null;
      coreResetAt = null;
      return false;
    }
    return true;
  }
  return false;
}

async function throttle(kind) {
  const minInterval = kind === "search" ? SEARCH_INTERVAL_MS : REST_INTERVAL_MS;
  const last = kind === "search" ? lastSearchAt : lastRestAt;
  const wait = minInterval - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  if (kind === "search") lastSearchAt = Date.now();
  else lastRestAt = Date.now();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 带重试的 fetch:处理 403/429 限流与 5xx
async function fetchJson(url, kind, opts = {}) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await throttle(kind);
    let res;
    try {
      res = await fetch(url, { headers: headers(opts.headers), ...opts });
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      await sleep(2000 * attempt);
      continue;
    }

    if (res.status === 200) {
      const remaining = Number(res.headers.get("x-ratelimit-remaining"));
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      if (!Number.isNaN(remaining)) {
        if (kind === "rest") coreRemaining = remaining;
        else searchRemaining = remaining;
      }
      if (!Number.isNaN(reset) && kind === "rest") coreResetAt = reset;
      // raw Accept 返回纯文本,不能调 json()
      const acceptRaw = opts.headers?.Accept?.includes("raw") || opts.headers?.Accept?.includes("vnd.github.raw");
      const data = acceptRaw ? await res.text() : await res.json();
      return {
        data,
        remaining: res.headers.get("x-ratelimit-remaining"),
        reset: res.headers.get("x-ratelimit-reset"),
      };
    }

    // 限流:读 reset 头,等到重置(但有上限,避免卡死)
    if (res.status === 403 || res.status === 429) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const reset = res.headers.get("x-ratelimit-reset");
      if (remaining === "0" && reset) {
        const waitSec = Math.max(1, Number(reset) - Math.floor(Date.now() / 1000));
        const cappedWait = Math.min(waitSec * 1000, 60_000); // 最多等 60s
        if (attempt < maxAttempts && cappedWait < 60_000) {
          await sleep(cappedWait + 500);
          continue;
        }
      }
      if (attempt < maxAttempts) {
        await sleep(3000 * attempt);
        continue;
      }
    }

    // 404 等
    if (res.status === 404) return { data: null, status: 404 };

    if (attempt < maxAttempts && res.status >= 500) {
      await sleep(2000 * attempt);
      continue;
    }

    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${url}: ${body.slice(0, 200)}`);
  }
}

// Search repositories:返回 items 原始数组
export async function searchRepos(query, { perPage = 100, sort = "stars" } = {}) {
  const url = `${API}/search/repositories?q=${encodeURIComponent(
    query,
  )}&sort=${sort}&order=desc&per_page=${perPage}`;
  const { data } = await fetchJson(url, "search");
  return data?.items ?? [];
}

// 取单个仓库最新信息(用于 watchlist 独立拉取)
export async function getRepo(fullName) {
  const url = `${API}/repos/${fullName}`;
  const { data } = await fetchJson(url, "rest");
  return data;
}

// 批量取多个仓库(逐个调,自动限流)
export async function getRepos(fullNames) {
  const out = [];
  for (const fn of fullNames) {
    try {
      out.push(await getRepo(fn));
    } catch (e) {
      out.push({ full_name: fn, _error: String(e?.message || e) });
    }
  }
  return out;
}

// 取 README 前若干字符。
// 返回 { text, skipped, reason }:
//   - core 额度耗尽 → skipped=true,跳过不浪费请求
//   - 404/抓取失败 → text="", reason 记录
export async function getReadmeExcerpt(fullName, maxChars = 3500) {
  if (isCoreExhausted()) {
    return { text: "", skipped: true, reason: "core额度耗尽,跳过" };
  }
  const url = `${API}/repos/${fullName}/readme`;
  try {
    const { data, status } = await fetchJson(url, "rest", {
      headers: { Accept: "application/vnd.github.raw" },
    });
    if (status === 404 || !data) {
      return { text: "", skipped: false, reason: "无README" };
    }
    const text = typeof data === "string" ? data : String(data);
    return { text: text.slice(0, maxChars), skipped: false, reason: null };
  } catch (e) {
    return { text: "", skipped: false, reason: String(e?.message || e).slice(0, 80) };
  }
}

// 供外部查询当前额度状态
export function rateLimitStatus() {
  return {
    core_remaining: coreRemaining,
    core_reset_at: coreResetAt,
    core_exhausted: isCoreExhausted(),
    search_remaining: searchRemaining,
    has_token: HAS_TOKEN,
  };
}
