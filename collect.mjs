#!/usr/bin/env node
// collect.mjs — 主入口
// 流程:
//   1. 合流 watchlist changes
//   2. 搜索候选池(Search API,关键词组合)
//   3. AI 相关性过滤 + 去重
//   4. 写今日快照
//   5. 算 top10 日涨星 diff
//   6. 独立拉取 watchlist 关注项目
//   7. 对"需详述"项目抓 README
//   8. 变化检测
//   9. 产出 ranking-YYYY-MM-DD.json

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { searchRepos, getReadmeExcerpt, getRepo, HAS_TOKEN, rateLimitStatus } from "./lib/github.mjs";
import { KEYWORD_GROUPS, buildQuery } from "./lib/keywords.mjs";
import { filterAndDedup, slimRepo, isAITool } from "./lib/filter.mjs";
import {
  todayStr,
  writeSnapshot,
  readSnapshot,
  latestSnapshotBefore,
  computeDiffs,
  ensureDirs,
} from "./lib/snapshot.mjs";
import {
  readProfile,
  detectChange,
  guessReleaseFromReadme,
  updateProfile,
} from "./lib/profile.mjs";
import {
  mergePendingChanges,
  readWatchlist,
  collectWatchlist,
} from "./lib/watchlist.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DATA_DIR = join(ROOT, "data");
const RANKING_DIR = DATA_DIR;

const TOP_N = 10;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

async function main() {
  const dateStr = todayStr();
  log(`▶ 开始采集,日期 ${dateStr}, Token=${HAS_TOKEN ? "已配置" : "匿名"}`);

  ensureDirs();
  if (!existsSync(RANKING_DIR)) mkdirSync(RANKING_DIR, { recursive: true });

  // 1. 合流 watchlist changes
  const mergeResult = mergePendingChanges();
  if (mergeResult.applied > 0) {
    log(`✓ watchlist 合流: 应用 ${mergeResult.applied} 条, ${mergeResult.before}→${mergeResult.after}`);
  }

  // 2. 搜索候选池
  log(`▶ 开始搜索,共 ${KEYWORD_GROUPS.length} 组关键词...`);
  const rawItems = [];
  const failedKeywords = [];
  for (let i = 0; i < KEYWORD_GROUPS.length; i++) {
    const kws = KEYWORD_GROUPS[i];
    const query = buildQuery(kws);
    try {
      const items = await searchRepos(query, { perPage: 100 });
      log(`  [${i + 1}/${KEYWORD_GROUPS.length}] "${kws.join("/")}" → ${items.length} 条`);
      rawItems.push(...items);
    } catch (e) {
      log(`  [${i + 1}/${KEYWORD_GROUPS.length}] "${kws.join("/")}" ✗ ${e?.message || e}`);
      failedKeywords.push(kws.join("/"));
    }
  }
  log(`✓ 搜索完成,原始 ${rawItems.length} 条,失败 ${failedKeywords.length} 组`);

  // 3. AI 过滤 + 去重
  const deduped = filterAndDedup(rawItems);
  log(`✓ 过滤去重后 ${deduped.length} 条 AI 相关仓库`);

  const slimmed = deduped.map(slimRepo);

  // 4. 写今日快照
  const todayMap = Object.fromEntries(slimmed.map((r) => [r.full_name, r.stars]));
  writeSnapshot(dateStr, todayMap);
  log(`✓ 已写快照 ${dateStr}.json`);

  // 5. 算 diff(关注项目变化检测仍需要;榜单排序用 stars)
  const { date: prevDate, map: prevMap } = latestSnapshotBefore(dateStr);
  const isFirstRun = prevDate === null;
  log(`  最近历史快照: ${prevDate || "无(首次运行·基线收录)"}`);
  const diffs = computeDiffs(slimmed, prevMap);

  // 新项目崛起榜:始终按总星降序取 Top10(新项目总星=累计崛起热度)。
  // 不按 delta 排序——新项目里高星的才是"最猛崛起",delta 只用于变化检测(排名跃升/新进入)。
  // 标记"新进入":昨天不在 Top10 集合里的项目(用昨日快照比对)。
  const prevTopSet = (() => {
    // 读昨日 ranking 的 top10 full_name 集合(若存在)
    try {
      const prevRanking = JSON.parse(
        readFileSync(join(RANKING_DIR, `ranking-${prevDate}.json`), "utf8"),
      );
      return new Set((prevRanking.top10 || []).map((t) => t.full_name));
    } catch {
      return new Set();
    }
  })();

  // 昨日涨星榜集合(用于判断今日 trending 新进榜)
  const prevTrendingSet = (() => {
    try {
      const prevRanking = JSON.parse(
        readFileSync(join(RANKING_DIR, `ranking-${prevDate}.json`), "utf8"),
      );
      return new Set((prevRanking.trending_top10 || []).map((t) => t.full_name));
    } catch {
      return new Set();
    }
  })();

  const ranked = diffs
    .filter((d) => d.today_stars > 0)
    .sort((a, b) => b.today_stars - a.today_stars)
    .slice(0, TOP_N)
    .map((d) => ({
      ...d,
      // is_new 语义重定义:今天进榜但昨天不在榜 = 新进入(真信号)
      is_new: !prevTopSet.has(d.full_name),
      is_baseline: isFirstRun,
    }));

  // 6 & 7 & 8. 对 topN 组装详情 + 抓 README + 变化检测
  const slimMap = new Map(slimmed.map((r) => [r.full_name, r]));
  const rankingSet = new Set(ranked.map((r) => r.full_name));
  const topDetail = [];
  for (let i = 0; i < ranked.length; i++) {
    const d = ranked[i];
    const slim = slimMap.get(d.full_name) || {};
    const profile = readProfile(d.full_name);

    // 需要详述的:新入榜 或 大变化
    const needsReadme = d.is_new || !profile;
    let readme = "";
    let readmeReason = null;
    let releaseGuess = null;
    if (needsReadme) {
      const r = await getReadmeExcerpt(d.full_name, 3500);
      readme = r.text;
      readmeReason = r.reason;
      if (r.skipped) {
        log(`  ⚠️ ${d.full_name} README 跳过: ${r.reason}`);
      } else if (!readme && readmeReason) {
        log(`  • ${d.full_name} README: ${readmeReason}`);
      }
      releaseGuess = guessReleaseFromReadme(readme);
    } else if (profile?.last_release_guess) {
      releaseGuess = profile.last_release_guess;
    }

    const change = detectChange(
      {
        ...d,
        is_new: d.is_new,
        release_guess: releaseGuess,
      },
      profile,
      {
        prevRank: profile?.last_rank ?? null,
        curRank: i + 1,
      },
    );

    // 连续上榜天数:昨日也在榜(prevDate 当天有记录)则 +1,否则重置为 1
    const consecutive =
      profile?.last_report_date === prevDate
        ? (profile.consecutive_days || 0) + 1
        : 1;

    // 更新画像
    updateProfile(d.full_name, {
      last_stars: d.today_stars,
      last_delta: d.delta,
      last_rank: i + 1,
      last_release_guess: releaseGuess || profile?.last_release_guess || null,
      last_report_date: dateStr,
      consecutive_days: consecutive,
    });

    topDetail.push({
      rank: i + 1,
      ...d,
      ...slim,
      release_guess: releaseGuess,
      is_changed: change.is_changed,
      change_reason: change.change_reason,
      consecutive_days: consecutive,
      readme_excerpt: readme,
      prev_summary: profile?.last_summary || null,
      topics: slim.topics || [],
      description: slim.description || "",
      language: slim.language || "",
      license: slim.license || null,
      pushed_at: slim.pushed_at || null,
      homepage: slim.homepage || null,
    });
  }

  // 9. 独立拉取 watchlist
  const watchlistSection = await collectWatchlist({
    yesterdayMap: prevMap,
    rankingSet,
    isFirstRun,
  });
  const wlInfo = readWatchlist();
  log(`✓ 关注列表: ${wlInfo.items.length} 项, 成功拉取 ${watchlistSection.filter((w) => !w.error).length}`);

  // 10. 抓取 GitHub Trending 今日榜 → 过滤 AI → 补总星/README → 涨星榜
  log(`▶ 抓取 GitHub Trending 今日榜...`);
  let trendingTop10 = [];
  try {
    const { getTrending } = await import("./lib/trending.mjs");
    const trending = getTrending();
    log(`  抓到 ${trending.length} 个 trending 项目`);

    // AI 相关性过滤(复用 filter)
    const aiTrending = trending
      .filter((t) => isAITool({
        full_name: t.full_name,
        name: t.full_name.split("/")[1],
        description: t.description,
        topics: [],
      }))
      .sort((a, b) => b.today_stars - a.today_stars)
      .slice(0, 10);
    log(`  过滤出 ${aiTrending.length} 个 AI 项目`);

    // 用 API 补总星和 created_at(逐个,/repos 路径)
    for (const t of aiTrending) {
      try {
        const repo = await getRepo(t.full_name);
        t.total_stars = repo?.stargazers_count ?? t.total_stars;
        t.created_at = repo?.created_at ?? null;
        t.pushed_at = repo?.pushed_at ?? null;
        t.license = repo?.license?.spdx_id || null;
        t.topics = repo?.topics || [];
        t.url = repo?.html_url || `https://github.com/${t.full_name}`;
        // 新进榜判断:昨天 trending 榜里有没有它
        t.is_new = !prevTrendingSet.has(t.full_name);
      } catch (e) {
        t.total_stars = t.total_stars || 0;
        t.is_new = true;
      }
    }
    trendingTop10 = aiTrending;
    log(`✓ 涨星榜完成: ${trendingTop10.length} 个项目`);
  } catch (e) {
    log(`⚠️ Trending 抓取失败: ${e?.message || e}`);
  }

  // 产出 ranking 文件
  const rlStatus = rateLimitStatus();
  const ranking = {
    date: dateStr,
    generated_at: new Date().toISOString(),
    data_source: HAS_TOKEN ? "github-api(token)" : "github-api(anonymous)",
    prev_snapshot_date: prevDate,
    is_first_run: isFirstRun,
    keywords: KEYWORD_GROUPS.map((k) => k.join("/")),
    candidate_pool_size: slimmed.length,
    raw_search_count: rawItems.length,
    failed_keywords: failedKeywords,
    top10: topDetail,
    trending_top10: trendingTop10,
    watchlist_section: watchlistSection,
    watchlist_count: wlInfo.items.length,
    rate_limit_at_end: rlStatus,
  };

  const outPath = join(RANKING_DIR, `ranking-${dateStr}.json`);
  writeFileSync(outPath, JSON.stringify(ranking, null, 2));
  log(`✓ 已产出 ranking: ${outPath}`);
  log(
    `  额度: core剩余=${rlStatus.core_remaining ?? "?"} ${rlStatus.core_exhausted ? "(已耗尽)" : ""} · search剩余=${rlStatus.search_remaining ?? "?"}`,
  );

  // 摘要打印
  const deltaStr = (d) => (d == null ? "—" : `+${d}`);
  console.log(`\n========== 今日 Top 10 ${isFirstRun ? "(基线收录·首日无涨星可比)" : ""} ==========`);
  for (const t of topDetail) {
    const tag = isFirstRun ? "📋" : t.is_new ? "🆕" : t.is_changed ? "🔥" : "  ";
    console.log(
      `${tag} #${t.rank} ${t.full_name}  ${deltaStr(t.delta)} (总 ${t.today_stars})  ${t.change_reason || ""}`,
    );
  }
  if (watchlistSection.length > 0) {
    console.log("\n---------- ⭐ 重点关注 ----------");
    for (const w of watchlistSection) {
      if (w.error) {
        console.log(`  ${w.full_name}  ⚠️ ${w.error}`);
      } else {
        console.log(
          `  ${w.in_ranking ? "📍榜内" : "榜外"} ${w.full_name}  ${deltaStr(w.delta)} (总 ${w.stars})  ${w.change_reason || "持平"}`,
        );
      }
    }
  }
  console.log("\n▶ 完成。ranking 文件交给 agent 写报告。");
}

main().catch((e) => {
  console.error("✗ 采集失败:", e);
  process.exit(1);
});
