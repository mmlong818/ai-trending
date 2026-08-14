# 🔥 AI 新项目崛起榜

每天中午 12:00 自动产出 AI 双榜:【涨星榜】(GitHub Trending 今日 AI 项目,按今日新增星)+【崛起榜】(近 60 天新建、星数最高的 AI 项目)。每个项目配中文解读(是什么 / 哪里好 / 应用场景),单页展示完整内容。

线上: **https://mmlong818.github.io/ai-trending/**

- **榜单定位**:只看近 60 天**新建**的项目,按总星排序 = 崛起热度。老牌高星项目不再霸榜,每天都是「最近刚冒头的新项目」。
- **新进榜信号**:每天标注哪些是「🆕 新进榜」(昨天不在 Top10、今天杀进来)——这才是值得关注的崛起信号。
- **报告网站**:首页(完整双榜单页)+ 月历存档(每日条数 + 本地搜索)+ 日归档 + RSS。暖白纸张 + 砖红 + Georgia 衬线的编辑刊物美学。
- **匿名友好**:无需 Token 即可运行;配置 Token 后自动提升额度。
- **零依赖**:纯 Node.js (ESM, Node 18+ 内置 fetch),无 npm install。

---

## 目录结构

```
ai-trending/
├── collect.mjs                # 数据采集:搜索近60天新建AI项目 + GitHub Trending → 双榜 ranking JSON
├── site-builder.mjs           # ★ 静态站点生成器:ranking JSON → 完整网站(reports/)
├── wait-pages.mjs             # 推送后指纹轮询,确认线上已更新
├── lib/
│   ├── github.mjs             # GitHub API 封装(限流/重试/Token可选)
│   ├── trending.mjs           # GitHub Trending 抓取与解析
│   ├── keywords.mjs           # AI关键词表 + 候选池窗口配置
│   ├── filter.mjs             # AI相关性过滤 + 去重 + 排除黑名单
│   ├── snapshot.mjs           # 快照读写 + diff
│   └── profile.mjs            # per-repo 画像 + 变化检测
├── data/                      # 运行产物(.gitignore,不入库)
│   ├── ranking-YYYY-MM-DD.json   # 每日双榜(含 zh_intro 中文解读)
│   └── snapshots / profiles
└── reports/                   # ★ 站点产物(入库,GitHub Pages 部署)
    ├── index.html             # 首页(=最新日报完整内容:双榜+详解)
    ├── archive.html           # 月历存档(7列网格 + 每日条数 + 搜索)
    ├── report-YYYY-MM-DD.html # 日归档(当天完整双榜 + 中文解读)
    └── rss.xml / sitemap.xml / robots.txt
```

---

## 快速开始

### 1. 手动运行一次(立即产出今日报告)

```bash
cd D:/codex/ai-trending
node collect.mjs          # 采集 → 产出 data/ranking-今日.json
# 之后由 cron 的 agent 写中文解读(zh_intro)并渲染 HTML;手动测试可跳过
```

首次运行(基线日):
- 全部项目标记为「📋 基线收录」,`delta` 为空(无昨日可比);
- **真正的涨星排名从第二天开始**(次日与今日快照 diff)。

### 2. 查看报告网站

线上: **https://mmlong818.github.io/ai-trending/**

网站由 `site-builder.mjs` 从所有 `data/ranking-*.json` 生成,含:
- **首页**:最新日报的完整内容单页(🔥涨星榜表格+详解 + 🚀崛起榜表格+详解 + 元数据 + 往期入口)
- **存档页**(archive.html):月历网格,每日显示条数,内置本地搜索(输入项目名/关键词即时筛选)
- **日归档**(report-YYYY-MM-DD.html):当天完整双榜 + 每个项目的中文解读(是什么/哪里好/应用场景)
- **RSS**:https://mmlong818.github.io/ai-trending/rss.xml

手动重新生成站点(改了 ranking JSON 后):
```bash
node site-builder.mjs    # 重新生成整个 reports/ 站点
```

### 3. 自动运行(cron,每天 12:00)

通过 ZCode 注册定时任务。每天中午自动:
1. 采集并产出双榜 ranking;
2. agent 为每个项目写中文解读;
3. 渲染完整站点;
4. 提交推送到仓库(触发 GitHub Pages 部署);
5. 简报今日双榜。

---

## 数据口径与准确性

| 维度 | 说明 |
|------|------|
| 涨星榜 | GitHub Trending 今日榜,过滤 AI 项目,按今日新增星排序 |
| 崛起榜 | 每日快照对比 + 近60天新建 `created:>窗口 stars:>50`,按总星排序 |
| 范围 | 广义 AI 工具(LLM/Agent/RAG/多模态/编码工具/垂直应用等),排除传统数据科学库与教程清单 |
| 变化判定 | 新进榜 / 涨星翻倍 / 排名跃升≥3 / 疑似新版本 |
| 详述触发 | 仅「新进榜/重大变化」的项目才抓 README 详解,其余继承已有解读 |

---

## 配置 GitHub Token(可选,强烈推荐)

匿名调用:REST 60 次/小时,Search 10 次/分钟。脚本已内置限流,正常运行够用,但:
- 高峰期匿名 Search 偶发限流。

配置 Token(只需 **public_repo / 公开读** 权限,免费)后:REST 升至 5000/h,Search 30/min。

```bash
# 方式1:环境变量
export GITHUB_TOKEN=ghp_xxxxx

# 方式2:本目录 .env(复制 .env.example)
echo "GITHUB_TOKEN=ghp_xxxxx" > .env
```

脚本自动检测 Token 并切换限流策略。

获取 Token:https://github.com/settings/tokens (Fine-grained,选 Public Repositories read-only)。

---

## 关键词调整

生成式 AI 范围由 `lib/keywords.mjs` 的 `KEYWORD_GROUPS` 决定。每组是一条 GitHub Search query,串行执行。想扩大或收窄范围,直接增删数组项即可,例如:

```js
export const KEYWORD_GROUPS = [
  // ...已有
  ["你的新关键词", " synonym"],
];
```

`EXCLUDE_REPOS` 是黑名单(传统数据科学库),也可增删。

---

## 网页部署(GitHub Pages)

报告 HTML 已配置为自动部署到 GitHub Pages,在线访问。本仓库是 **public**,Pages 免费可用。

### 启用步骤

1. **仓库设置**:打开 https://github.com/mmlong818/ai-trending → **Settings → Pages** → **Source** 选择 **"GitHub Actions"**。
2. **工作流已就绪**:`.github/workflows/deploy.yml` 已配置,当你 push 含 `reports/` 改动到 `main` 时自动部署。
3. **cron 自动推送**:每天 12:00 的 cron 会生成报告并 push,自动触发部署。

### 部署后访问

配置成功后,线上地址为:`https://mmlong818.github.io/ai-trending/`(首页含今日头条 + 近期时间线,存档页 archive.html 有月历 + 搜索)。

### 手动触发部署

在 https://github.com/mmlong818/ai-trending/actions 找到 "Deploy" 工作流,点 **Run workflow** 可手动触发。

---

## 故障排查

| 现象 | 原因 / 处理 |
|------|------------|
| 首日榜单 delta 为空 | 正常。首日=基线收录,次日才有真实涨星 |
| 某关键词返回 0 条 | GitHub Search 语法差异,属正常(如 `ai-sdk` 命中少) |
| 大量关键词失败/超时 | 匿名 Search 限流;等几分钟重跑,或配 Token |
| Trending 抓取失败 | 网络/反爬波动;当日跳过涨星榜只发崛起榜 |
| 机器关机错过 12:00 | 脚本幂等,随时手动 `node collect.mjs` 补当天(diff 跨天数累计) |
| README 抓取慢(~10分钟) | 匿名 REST 65s/req。配 Token 后 ~30s |

---

## 定时任务(ZCode cron)

已注册每天 12:00(本地时区)运行。如需调整时间或查看:

```
每天中午12点:cd 工具目录 → node collect.mjs → 读 ranking 写报告 → 简报
```

机器需开机;休眠/关机则当天不跑,可手动补跑(幂等,覆盖当天产物)。

---

## 不做的事

- 不做实时追踪(每日一次快照);
- 不做账号体系;
- 暂不做后端服务(纯前端方案,已预留升级接口);
- 不接入其他项目(yuandian / shotcat),保持独立。
