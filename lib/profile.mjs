// per-repo 画像:记录上次报告时该项目的关键状态,用于"变化检测"。
// 画像格式:data/profiles/{owner}-{name}.json
// {
//   full_name, last_summary, last_stars, last_delta,
//   last_report_date, last_release_guess,
//   consecutive_days (连续上榜天数),
//   watched_since (若被关注)
// }

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROFILE_DIR = join(ROOT, "data", "profiles");

function safeName(fullName) {
  return fullName.replace(/[\\/]/g, "-");
}

function profilePath(fullName) {
  return join(PROFILE_DIR, `${safeName(fullName)}.json`);
}

export function ensureProfileDir() {
  if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true });
}

export function readProfile(fullName) {
  const p = profilePath(fullName);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeProfile(fullName, data) {
  ensureProfileDir();
  writeFileSync(profilePath(fullName), JSON.stringify(data, null, 2));
}

// 从 README 前段文本粗略猜最新版本号(找 v\d 或 x.y.z 模式)
export function guessReleaseFromReadme(readme) {
  if (!readme) return null;
  const head = readme.slice(0, 1500);
  const patterns = [
    /\bv?(\d+\.\d+\.\d+(?:[-.\w]*)?)\b/,
    /release[^\n]{0,40}?(\d+\.\d+\.\d+)/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m) return m[1];
  }
  return null;
}

// 变化检测:决定该 repo 今天是"需详述"还是"无变化"。
// 返回 { is_changed, change_reason, rank_change }
// 规则:
//   - is_new(首日上榜) → 大变化
//   - 当日 delta 较昨日 delta 翻倍且为正 → 大变化
//   - README 最新版本号与 profile 记录不同 → 大变化
//   - 排名跃升 ≥3 → 大变化
//   - watched 且今日 delta > 0 → 视为有变化(关注项目门槛更低)
//   - 其余 → 无变化
export function detectChange(repoWithDiff, profile, opts = {}) {
  const { is_new, delta } = repoWithDiff;
  const reasons = [];

  if (is_new) {
    return {
      is_changed: true,
      change_reason: "新进入榜单",
      prev_release: profile?.last_release_guess ?? null,
    };
  }

  if (profile) {
    // 排名跃升(由调用方传入 prev_rank/cur_rank)
    if (
      typeof opts.prevRank === "number" &&
      typeof opts.curRank === "number" &&
      opts.prevRank - opts.curRank >= 3
    ) {
      reasons.push(`排名跃升 ${opts.prevRank}→${opts.curRank}`);
    }

    // delta 翻倍
    if (
      profile.last_delta > 0 &&
      delta > 0 &&
      delta >= profile.last_delta * 2
    ) {
      reasons.push(`涨星加速 ${profile.last_delta}→${delta}`);
    }

    // 版本变化
    const newRel = repoWithDiff.release_guess || null;
    if (newRel && profile.last_release_guess && newRel !== profile.last_release_guess) {
      reasons.push(`疑似新版本 ${profile.last_release_guess}→${newRel}`);
    }
  }

  // 关注项目门槛降低:有正向涨星即标记
  if (opts.watched && delta > 0 && reasons.length === 0) {
    return {
      is_changed: true,
      change_reason: `关注项目·今日 +${delta}`,
      prev_release: profile?.last_release_guess ?? null,
    };
  }

  if (reasons.length > 0) {
    return {
      is_changed: true,
      change_reason: reasons.join(" / "),
      prev_release: profile?.last_release_guess ?? null,
    };
  }

  return {
    is_changed: false,
    change_reason: null,
    prev_release: profile?.last_release_guess ?? null,
  };
}

// 更新画像(写回)
export function updateProfile(fullName, patch) {
  const prev = readProfile(fullName) || { full_name: fullName };
  const next = { ...prev, ...patch, full_name: fullName, updated_at: new Date().toISOString() };
  writeProfile(fullName, next);
  return next;
}
