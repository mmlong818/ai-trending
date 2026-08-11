// GitHub Trending 抓取器:解析 github.com/trending HTML,提取项目 + 今日新增星数。
// GitHub 没有官方 Trending API,这里抓 HTML 页面解析。
// 零依赖:用 curl(走代理)抓 HTML,正则解析。

import { execFileSync } from "node:child_process";

const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:7897";
const TRENDING_URL = "https://github.com/trending?since=daily";

// 用 curl 抓取 HTML(走代理,零依赖)
export function fetchTrendingHTML() {
  try {
    return execFileSync("curl", [
      "-s", "--proxy", PROXY, "--max-time", "30",
      "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "-H", "Accept-Language: en-US,en;q=0.9",
      TRENDING_URL,
    ], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`curl 抓取 Trending 失败: ${e?.message || e}`);
  }
}

// 从 HTML 解析出项目列表
export function parseTrending(html) {
  const items = [];
  const rowRe = /<article[^>]*class="Box-row"[^>]*>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const block = m[1];
    // repo 路径:h2 > a href="/owner/repo"
    const repoM = block.match(/<h2[^>]*>\s*<a[^>]*href="\/([^"]+)"/);
    if (!repoM) continue;
    const fullName = repoM[1].trim();

    // 描述:<p class="col-9 ...">text</p>(Trending 页描述专用 class)
    let desc = "";
    const descM = block.match(/<p\s+class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
    if (descM) desc = descM[1].replace(/<[^>]+>/g, "").trim();

    // 今日新增星:"X stars today"
    let todayStars = 0;
    const todayM = block.match(/([\d,]+)\s+stars\s+(today|this week|this month)/);
    if (todayM) todayStars = parseInt(todayM[1].replace(/,/g, ""), 10);

    // 总星数:stargazers 链接后的 SVG + 数字,匹配 class 里的文本
    let totalStars = 0;
    const totalM = block.match(/\/stargazers"[^>]*>[\s\S]*?(?:aria-label|class)[^>]*>[\s\S]*?(\d[\d,]*)/);
    if (totalM) {
      totalStars = parseInt(totalM[1].replace(/,/g, ""), 10);
    } else {
      // 备用:直接找 ★ 后跟数字的模式
      const altM = block.match(/aria-label="[^"]*star[^"]*"[^>]*>\s*(\d[\d,]*)/i);
      if (altM) totalStars = parseInt(altM[1].replace(/,/g, ""), 10);
    }

    // 语言
    let language = "";
    const langM = block.match(/<span itemprop="programmingLanguage">([^<]+)<\/span>/);
    if (langM) language = langM[1].trim();

    items.push({
      full_name: fullName,
      url: `https://github.com/${fullName}`,
      description: desc,
      today_stars: todayStars,
      total_stars: totalStars,
      language,
    });
  }
  return items;
}

// 完整流程:抓取 + 解析
export function getTrending() {
  const html = fetchTrendingHTML();
  return parseTrending(html);
}
