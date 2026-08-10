// 关注列表:读 watchlist.json、独立拉取关注项目、算 diff、变化检测。
// 关注项目即使没进候选池也走专用 /repos 路径拉取。

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getRepo, getReadmeExcerpt } from "./github.mjs";
import { readProfile, detectChange, guessReleaseFromReadme, updateProfile } from "./profile.mjs";
import { slimRepo } from "./filter.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const WATCHLIST_PATH = join(ROOT, "data", "watchlist.json");
const CHANGES_PATH = join(ROOT, "data", "watchlist-changes.json");

export function readWatchlist() {
  if (!existsSync(WATCHLIST_PATH)) return { items: [], updated_at: null };
  try {
    const data = JSON.parse(readFileSync(WATCHLIST_PATH, "utf8"));
    return { items: data.items || [], updated_at: data.updated_at || null };
  } catch {
    return { items: [], updated_at: null };
  }
}

export function writeWatchlist(items) {
  const data = {
    items,
    updated_at: new Date().toISOString(),
  };
  writeFileSync(WATCHLIST_PATH, JSON.stringify(data, null, 2));
  return data;
}

// 读取页面待合流的变更队列
export function readChanges() {
  if (!existsSync(CHANGES_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(CHANGES_PATH, "utf8"));
    return data.pending || [];
  } catch {
    return [];
  }
}

// 把 changes 应用到 watchlist,返回新的 items
export function applyChanges(items, changes) {
  const map = new Map(items.map((it) => [it.full_name.toLowerCase(), it]));
  for (const ch of changes) {
    const key = (ch.full_name || "").toLowerCase();
    if (!key) continue;
    if (ch.op === "add" && !map.has(key)) {
      map.set(key, {
        full_name: ch.full_name,
        added_at: ch.added_at || new Date().toISOString(),
        note: ch.note || "",
      });
    } else if (ch.op === "remove" && map.has(key)) {
      map.delete(key);
    } else if (ch.op === "note" && map.has(key)) {
      const cur = map.get(key);
      cur.note = ch.note ?? cur.note;
      map.set(key, cur);
    }
  }
  return Array.from(map.values());
}

// 清空 changes 队列(合流后调用)
export function clearChanges() {
  writeFileSync(
    CHANGES_PATH,
    JSON.stringify(
      {
        pending: [],
        note: "由管理页面写入的待合流操作队列;collect.mjs 启动时消费并清空。",
      },
      null,
      2,
    ),
  );
}

// 合流入口:read changes → apply → write watchlist → clear changes
// 返回 { applied, before, after }
export function mergePendingChanges() {
  const wl = readWatchlist();
  const changes = readChanges();
  if (changes.length === 0) {
    return { applied: 0, before: wl.items.length, after: wl.items.length };
  }
  const merged = applyChanges(wl.items, changes);
  writeWatchlist(merged);
  clearChanges();
  return {
    applied: changes.length,
    before: wl.items.length,
    after: merged.length,
  };
}

// 独立拉取关注项目并组装成与榜单同构的记录
// yesterdayMap: 顶层快照(用于算 delta)
// rankingSet: 今日进入榜单的 full_name 集合(用于标注"榜内/榜外")
export async function collectWatchlist({ yesterdayMap, rankingSet, isFirstRun = false }) {
  const { items } = readWatchlist();
  if (items.length === 0) return [];

  const results = [];
  for (const item of items) {
    try {
      const repo = await getRepo(item.full_name);
      if (!repo || repo._error || repo.message) {
        results.push({
          full_name: item.full_name,
          watched_since: item.added_at,
          note: item.note,
          in_ranking: false,
          error: repo?._error || repo?.message || "not found",
        });
        continue;
      }
      const slim = slimRepo(repo);
      const y = yesterdayMap[slim.full_name];
      const profile = readProfile(slim.full_name);
      const isNewWatched = !profile || !profile.watched_since;
      // 首日无历史 → delta 置 null(不伪造);非首日且快照有记录才算真实 diff
      const delta = isFirstRun ? null : (y === undefined ? null : slim.stars - y);

      // 关注项目有变化时才抓 README(首日新增关注也抓,建立基线)
      let readme = "";
      let releaseGuess = null;
      if (isNewWatched || (delta != null && delta > 0)) {
        const r = await getReadmeExcerpt(slim.full_name, 3000);
        readme = r.text;
        releaseGuess = guessReleaseFromReadme(readme);
      }

      const change = detectChange(
        {
          is_new: isNewWatched,
          delta,
          release_guess: releaseGuess,
          today_stars: slim.stars,
        },
        profile,
        { watched: true },
      );

      // 更新画像
      updateProfile(slim.full_name, {
        watched_since: profile?.watched_since || item.added_at,
        last_stars: slim.stars,
        last_delta: delta,
        last_release_guess: releaseGuess || profile?.last_release_guess || null,
        last_report_date: new Date().toISOString().slice(0, 10),
      });

      results.push({
        ...slim,
        watched_since: item.added_at,
        note: item.note,
        yesterday_stars: y ?? null,
        delta,
        is_new_watched: isNewWatched,
        in_ranking: rankingSet.has(slim.full_name),
        is_changed: change.is_changed,
        change_reason: change.change_reason,
        release_guess: releaseGuess,
        readme_excerpt: readme,
        prev_summary: profile?.last_summary || null,
      });
    } catch (e) {
      results.push({
        full_name: item.full_name,
        watched_since: item.added_at,
        note: item.note,
        in_ranking: false,
        error: String(e?.message || e),
      });
    }
  }
  return results;
}
