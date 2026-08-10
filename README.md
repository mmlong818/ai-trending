# GitHub AI 每日涨星追踪 · 重点关注

每天中午 12:00 自动追踪 GitHub **生成式 AI** 方向日涨星前 10 的仓库,产出中文 Markdown 报告;并支持对任意项目「重点关注」,关注项目**即使未上榜**也会每日独立追踪变化。

- **数据口径**:GitHub Search API 快照增量(每日存快照,次日算真实 diff),聚焦生成式 AI。
- **匿名友好**:无需 Token 即可运行;配置 Token 后自动提升额度与限流。
- **关注能力**:纯前端管理页面 + localStorage,关注项目走独立 API 路径拉取。
- **零依赖**:纯 Node.js (ESM, Node 18+ 内置 fetch),无 npm install。

---

## 目录结构

```
github-ai-daily/
├── collect.mjs                # 主入口:搜索→快照→diff→关注→README→ranking
├── render-report.mjs          # ranking JSON → 自包含 HTML 报告
├── build-index.mjs            # 扫描 reports/ 生成首页 index.html
├── merge-watchlist.mjs        # 手动合流 watchlist 变更(可选)
├── lib/
│   ├── github.mjs             # GitHub API 封装(限流/重试/Token可选)
│   ├── keywords.mjs           # 生成式AI关键词表(可自行增删)
│   ├── filter.mjs             # AI相关性过滤 + 去重 + 排除黑名单
│   ├── snapshot.mjs           # 快照读写 + 日涨星 diff
│   ├── profile.mjs            # per-repo 画像 + 变化检测
│   └── watchlist.mjs          # 关注列表读写 + 独立拉取 + 合流
├── web/
│   ├── index.html             # 重点关注管理页面(浏览器打开即用)
│   ├── app.css
│   └── app.js
├── data/                      # 运行产物(.gitignore,不入库)
│   ├── snapshots/YYYY-MM-DD.json
│   ├── profiles/{owner}-{name}.json
│   ├── ranking-YYYY-MM-DD.json   # 含 zh_intro 字段(agent 填充中文解读)
│   ├── watchlist.json         # 关注列表真相源(collect 只读它)
│   └── watchlist-changes.json # 页面待合流的变更队列
└── reports/                   # 报告产物(HTML+MD 入库,供 Pages 部署)
    ├── index.html             # 首页(列出所有历史报告)
    ├── YYYY-MM-DD.html        # 每日 HTML 报告(含每个项目中文解读)
    └── github-ai-daily-YYYY-MM-DD.md  # Markdown 备份
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

### 2. 查看报告网页

每天 cron 产出两类报告,都在 `reports/` 下:
- **`YYYY-MM-DD.html`** — 可在浏览器直接打开的自包含网页(深色主题,含每个项目的中文解读:是什么/哪里好/应用场景)。双击即可查看。
- **`github-ai-daily-YYYY-MM-DD.md`** — Markdown 备份。

首页 `reports/index.html` 列出所有历史报告,点击进入。

手动重渲染(改了 ranking JSON 后刷新 HTML):
```bash
node render-report.mjs 2026-08-10   # 指定日期
node build-index.mjs                # 更新首页
```

### 3. 打开关注管理页面

直接用浏览器打开 `web/index.html`(双击或拖入浏览器),无需起服务:
- **我的关注** tab:输入 `owner/repo` 添加关注;每项可备注、取消关注。
- **今日榜单** tab:读取最新 ranking,一键关注榜单中的项目。
- **导入/导出** tab:备份、跨浏览器迁移、合流 changes。

### 4. 自动运行(cron,每天 12:00)

通过 ZCode 注册定时任务(见下「定时任务」一节)。每天中午自动:
1. 合流 watchlist 变更;
2. 采集并产出 ranking;
3. agent 为每个项目写中文解读;
4. 渲染 HTML 报告 + 首页;
5. 提交推送到仓库(触发 GitHub Pages 部署);
6. 简报今日榜单。

### 2. 打开关注管理页面

直接用浏览器打开 `web/index.html`(双击或拖入浏览器),无需起服务。

---

## 重点关注机制(必读)

浏览器**不能直接写本地文件**,所以关注列表采用 **localStorage(工作副本)+ watchlist.json(真相源)** 双层:

| 操作 | 发生了什么 |
|------|-----------|
| 页面加/取消关注 | 立即写 localStorage(刷新仍在),同时记入待合流队列 |
| 「⬇ 导出待合流 changes」 | 下载 `watchlist-changes.json`,请覆盖到 `data/` 下 |
| collect 启动(或 `node merge-watchlist.mjs`) | 自动读取 `data/watchlist-changes.json` → 应用到 `watchlist.json` → 清空队列 |

**关键保证**:即便忘了导出 changes,localStorage 永远保留你的最新关注,下次打开页面仍在;collect 运行前只要手动跑一次 `node merge-watchlist.mjs` 或导出覆盖即可。

### 工作流推荐

1. 在页面加/取消关注后,点「⬇ 导出待合流 changes」,把下载的文件覆盖 `data/watchlist-changes.json`;
2. 下次 cron(或手动 `node collect.mjs`)会自动合流,关注项目从此每日被独立追踪。

> 如希望完全无感(无需手动导出),未来可升级为轻量本地后端;当前为纯前端方案,代码已预留接口。

---

## 数据口径与准确性

| 维度 | 说明 |
|------|------|
| 涨星 | 每日快照 `stars` 的差值;首日无 diff |
| 范围 | 生成式 AI(LLM/Agent/RAG/多模态/推理/微调等),排除传统数据科学库 |
| 候选池 | GitHub Search 关键词组合 + `stars:>300 pushed:>近60天`,去重过滤 |
| 关注池 | watchlist 中的项目走**独立 `/repos` 路径**拉取,不依赖是否进候选池 |
| 变化判定 | 新入榜 / 涨星翻倍 / 排名跃升≥3 / 疑似新版本;关注项目门槛更低(有涨星即记) |
| 详述触发 | 仅「新入榜/重大变化」的项目才抓 README 写 500 字简介,其余一行带过 |

---

## 配置 GitHub Token(可选,强烈推荐)

匿名调用:REST 60 次/小时,Search 10 次/分钟。脚本已内置限流,正常运行够用,但:
- 关注项目多(>30)时,`/repos` 串行拉取会变慢;
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

配置成功后,线上地址为:`https://mmlong818.github.io/ai-trending/`(首页 index.html 列出所有历史报告)。

### 手动触发部署

在 https://github.com/mmlong818/ai-trending/actions 找到 "Deploy" 工作流,点 **Run workflow** 可手动触发。

---

## 故障排查

| 现象 | 原因 / 处理 |
|------|------------|
| 首日榜单 delta 为空 | 正常。首日=基线收录,次日才有真实涨星 |
| 某关键词返回 0 条 | GitHub Search 语法差异,属正常(如 `ai-sdk` 命中少) |
| 大量关键词失败/超时 | 匿名 Search 限流;等几分钟重跑,或配 Token |
| 关注项目拉取报错 | 仓库名拼错或已删除;页面取消关注即可 |
| 页面加的关注没生效 | 未导出 changes 覆盖到 `data/`;跑一次 `node merge-watchlist.mjs` |
| 机器关机错过 12:00 | 脚本幂等,随时手动 `node collect.mjs` 补当天 |
| README 抓取慢(首日~10分钟) | 匿名 REST 65s/req;首日 top10 都要建画像基线。配 Token 后 ~30s |

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
- 不做账号体系(关注列表本机本地);
- 暂不做后端服务(纯前端方案,已预留升级接口);
- 不接入其他项目(yuandian / shotcat),保持独立。
