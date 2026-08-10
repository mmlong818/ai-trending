// 快照读写 + 日涨星 diff 计算。
// 快照格式:data/snapshots/YYYY-MM-DD.json = { full_name: stars }

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SNAP_DIR = join(ROOT, "data", "snapshots");

export function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function snapshotPath(dateStr) {
  return join(SNAP_DIR, `${dateStr}.json`);
}

export function ensureDirs() {
  if (!existsSync(SNAP_DIR)) mkdirSync(SNAP_DIR, { recursive: true });
}

// 读某日快照;不存在返回 {}
export function readSnapshot(dateStr) {
  const p = snapshotPath(dateStr);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

// 写今日快照:{ full_name: stars }
export function writeSnapshot(dateStr, map) {
  ensureDirs();
  writeFileSync(snapshotPath(dateStr), JSON.stringify(map, null, 2));
}

// 找最近一份历史快照(排除 today),返回 { date, map }
export function latestSnapshotBefore(dateStr) {
  if (!existsSync(SNAP_DIR)) return { date: null, map: {} };
  const files = readdirSync(SNAP_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((d) => d < dateStr)
    .sort();
  if (files.length === 0) return { date: null, map: {} };
  const date = files[files.length - 1];
  return { date, map: readSnapshot(date) };
}

// 计算今日 vs 昨日 的涨星 diff
// 输入:今日候选 list(含 stars)、昨日快照 map
// 返回:[{ full_name, today_stars, yesterday_stars, delta, is_new }]
export function computeDiffs(todayRepos, yesterdayMap) {
  const hasHistory = Object.keys(yesterdayMap).length > 0;
  return todayRepos.map((r) => {
    const y = yesterdayMap[r.full_name];
    // 首日无历史快照:delta 置 null(语义=基线收录),不伪造涨星数字。
    if (!hasHistory) {
      return {
        full_name: r.full_name,
        today_stars: r.stars,
        yesterday_stars: null,
        delta: null, // 首日无涨星可比
        is_new: true,
        is_baseline: true,
      };
    }
    if (y === undefined) {
      // 有历史但该仓库此前不在候选池 → 视为新入榜,delta 用当前星数作下限估计
      return {
        full_name: r.full_name,
        today_stars: r.stars,
        yesterday_stars: null,
        delta: r.stars,
        is_new: true,
        is_baseline: false,
      };
    }
    return {
      full_name: r.full_name,
      today_stars: r.stars,
      yesterday_stars: y,
      delta: r.stars - y,
      is_new: false,
      is_baseline: false,
    };
  });
}
