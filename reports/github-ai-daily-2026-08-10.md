# GitHub 生成式 AI 每日涨星追踪 · 2026-08-10

> 📋 **基线收录日(首次运行)**:今天是系统首次运行,尚无昨日数据可比,因此本日无「涨星」数字。下面按**总星数**展示当前生成式 AI 领域星数最高的项目作为基线。**真正的日涨星排名从明天开始**(届时与今日快照做 diff)。
>
> **数据口径**:GitHub Search API 快照增量 · **范围**:生成式 AI(LLM/Agent/RAG/多模态/推理/微调) · **数据源**:匿名调用 · **运行时间**:2026-08-10

---

## 📊 今日 Top 10 速览(基线·按总星排序)

| # | 项目 | 今日涨星 | 总星数 | 语言 | License | 状态 |
|---|------|---------|--------|------|---------|------|
| 1 | [affaan-m/ECC](https://github.com/affaan-m/ECC) | — | 239,184 | JavaScript | MIT | 📋基线 |
| 2 | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | — | 228,344 | Python | MIT | 📋基线 |
| 3 | [n8n-io/n8n](https://github.com/n8n-io/n8n) | — | 200,104 | TypeScript | 其他 | 📋基线 |
| 4 | [Significant-Gravitas/AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | — | 186,494 | Python | 其他 | 📋基线 |
| 5 | [ollama/ollama](https://github.com/ollama/ollama) | — | 178,208 | Go | MIT | 📋基线 |
| 6 | [microsoft/markitdown](https://github.com/microsoft/markitdown) | — | 172,887 | Python | MIT | 📋基线 |
| 7 | [f/prompts.chat](https://github.com/f/prompts.chat) | — | 166,964 | HTML | 其他 | 📋基线 |
| 8 | [huggingface/transformers](https://github.com/huggingface/transformers) | — | 163,546 | Python | Apache-2.0 | 📋基线 |
| 9 | [Snailclimb/JavaGuide](https://github.com/Snailclimb/JavaGuide) | — | 157,662 | JavaScript | Apache-2.0 | ⚠️见说明 |
| 10 | [langflow-ai/langflow](https://github.com/langflow-ai/langflow) | — | 153,023 | Python | MIT | 📋基线 |

> ⚠️ **#9 Snailclimb/JavaGuide 说明**:该项目本质是「Java 面试与后端通用指南」,近期在描述和 topics 中加入了 `ai/springai/mcp/deepseek/context-engineering` 等 AI 相关标签,因而被候选池纳入。它并非纯粹的生成式 AI 项目,只是"向 AI 方向扩展"。**如不希望此类项目出现,可在 `lib/keywords.mjs` 的 `EXCLUDE_REPOS` 中添加 `Snailclimb/JavaGuide` 排除。**

---

## 🆕 重点基线项目简介(选介)

> 首日全部为基线收录。下面挑几个最具代表性的项目作简介,演示报告格式;从明天起,只有"新入榜/重大变化"的项目才会写 ~500 字简介,无变化的仅一行带过。

### affaan-m/ECC — 总 239,184 ⭐ (基线 #1)

**是什么**:ECC(Essential Claude Code 的缩写,亦称"the agent harness operating system")是一套面向 AI 编码代理(Claude Code、Codex、OpenCode、Cursor 等)的**性能优化与增强系统**。它为这些编码 Agent 提供"技能(skills)、直觉(instincts)、记忆(memory)、安全(security)"等外挂能力,定位为 Agent 运行的"操作系统"层。

**核心优势**:把分散的 Agent 增强能力(上下文管理、记忆持久化、工具技能库、安全沙箱)整合成统一框架,让用户不必为每个 Agent 单独配置。作为 Claude Code 生态的配套项目,它抓住了"Agent 工程化"这一当下最热方向,提供开箱即用的工程实践模板。社区活跃,文档完善,支持多语言(中/英/日/韩/葡)。

**典型应用场景**:重度使用 Claude Code / Codex 等 AI 编程工具的开发者,想给 Agent 加上长期记忆、自定义技能、更可控的执行边界;或团队希望统一 AI 编码工作流、沉淀可复用的 Agent 能力。

**为何位列基线之首**:总星数近 24 万,且近期 push 极活跃(今日仍有提交),说明是当前 AI 编码 Agent 生态中关注度最高的配套项目。

🔗 https://github.com/affaan-m/ECC · MIT · JavaScript · topics: ai-agents, claude, claude-code, llm, mcp

---

### ollama/ollama — 总 178,208 ⭐ (基线 #5)

**是什么**:Ollama 是本地运行大模型的标杆工具,让你在自己的机器上**一行命令拉起** Llama 3、GLM-5.2、DeepSeek、Qwen、Gemma、gpt-oss、Kimi-K2.6 等开源模型。它把模型权重下载、量化、推理引擎、API 服务打包成极简体验,是"本地 LLM"领域事实上的入口。

**核心优势**:体验极简(装完即用,无需懂量化/部署细节),跨平台(macOS/Windows/Linux),提供兼容 OpenAI 的 REST API,可直接对接 LangChain、各类 Chat UI 和开发框架。模型生态丰富,社区持续贡献 Modelfile。今日描述已更新,点名支持 GLM-5.2、Kimi-K2.6、MiniMax 等最新国产模型。

**典型应用场景**:隐私敏感场景(医疗/金融/法务)的本地推理;开发调试时不想付费调云 API;离线环境下的 AI 助手;作为 RAG/Agent 应用的本地推理后端。

🔗 https://github.com/ollama/ollama · MIT · Go · topics: llama, llm, deepseek, glm, qwen, gpt-oss

---

### Significant-Gravitas/AutoGPT — 总 186,494 ⭐ (基线 #4)

**是什么**:AutoGPT 是 2023 年引爆"自主 AI Agent"概念的元老级项目,目标是让 LLM 自主分解任务、调用工具、循环执行直到完成目标("AI agents that finish the work")。现已演进为完整的 Agent 平台,提供可视化构建与部署。

**核心优势**:最早验证"LLM + 工具 + 循环"自主 Agent 范式的开源实现,品牌认知度极高。新版强调"每周省 10 小时"的生产力定位,提供平台化能力。社区庞大,衍生生态丰富。

**典型应用场景**:需要多步骤自主完成的自动化任务(调研、数据处理、内容生成流水线);学习 Agent 架构设计的参考实现;快速搭建原型 Agent。

🔗 https://github.com/Significant-Gravitas/AutoGPT · Python · topics: autonomous-agents, llm, gpt, claude, llama-api

---

## ⭐ 重点关注(你标记的项目)

> 当前关注列表 **2 项**。首日为基线收录,无涨星可比;明日起此处将显示每个关注项目的当日变化。

### 📍 ollama/ollama — 总 178,208 ⭐ (榜内 #5)
- 📋 基线收录,首次纳入追踪。备注:本地推理,长期关注。
- 明日起将显示日涨星与变化。
🔗 https://github.com/ollama/ollama

### 榜外 browser-use/browser-use — 总 108,621 ⭐ (榜外)
- 📋 基线收录。该项目**未进入今日 Top10**(总星量级低于上榜项目),但因被你关注而独立追踪。
- 备注:浏览器 Agent。
🔗 https://github.com/browser-use/browser-use

---

## 📈 追踪元数据

- **候选池规模**:1,760 个 AI 相关仓库(原始搜索 2,728 条,去重过滤后)
- **关键词覆盖**:44 组(llm/chatgpt/gpt/claude/gemini/llama/mistral/qwen/deepseek/transformer/langchain/llamaindex/agent/rag/prompt/mcp/stable-diffusion/comfyui/diffusion/text-to-image/text-to-video/whisper/tts/multimodal/ollama/vllm/vector-db/embedding/inference/fine-tuning/lora/rlhf/copilot 等)
- **失败关键词**:0 组(全部成功)
- **关注池**:2 项(ollama/ollama · browser-use/browser-use)
- **API 额度**:匿名模式,core 剩余 57/60,search 剩余 6/10(运行正常)
- **首日说明**:今日为基线日,所有项目 delta 为空;**明日 12:00 起将出现真实日涨星排名与变化检测**

---

*由 collect.mjs 采集 + agent 成文 · 数据源 GitHub Search API(匿名) · 每日 12:00 自动运行*
