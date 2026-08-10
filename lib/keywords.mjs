// AI 工具方向关键词表 + GitHub Search query 构造
// 定位「新项目崛起榜」:只索引近 N 天【新建】的 AI 项目,按总星排序,
// 天然反映"最近哪些新项目在快速积累热度"。老牌项目不再占榜。
// 范围:广义 AI 工具(生成式AI + Agent + AI开发工具 + AI应用 + MLOps 轻量)。

// 用于 GitHub Search 的关键词组。每组构造一条 query,串行执行(匿名限流 10 req/min)。
// 命中 name/description/topics/readme 任一字段即可。
export const KEYWORD_GROUPS = [
  // 大模型 / 对话 / 模型生态
  ["llm", "large-language-model"],
  ["chatgpt"],
  ["gpt"],
  ["claude"],
  ["gemini"],
  ["llama"],
  ["qwen"],
  ["deepseek"],
  ["ai-chatbot"],
  ["conversational-ai"],

  // Agent / 自动化(当下最活跃赛道)
  ["ai-agent"],
  ["autonomous-agent"],
  ["ai-assistant"],
  ["agent-framework"],
  ["computer-use"],
  ["browser-use"],
  ["agent"],

  // LLM 应用 / RAG / 知识库
  ["langchain"],
  ["llamaindex"],
  ["rag"],
  ["retrieval-augmented-generation"],
  ["knowledge-graph"],
  ["prompt-engineering"],
  ["ai-sdk"],
  ["mcp", "model-context-protocol"],
  ["ai-workflow"],
  ["ai-playground"],

  // 代码 / 开发工具(AI coding 赛道)
  ["ai-coding"],
  ["copilot"],
  ["code-assistant"],
  ["ai-ide"],
  ["code-agent"],
  ["vibe-coding"],

  // 多模态 / 图像 / 视频 / 音频生成
  ["stable-diffusion"],
  ["comfyui"],
  ["diffusion"],
  ["text-to-image"],
  ["text-to-video"],
  ["image-generation"],
  ["video-generation"],
  ["flux"],
  ["ai-art"],
  ["whisper"],
  ["text-to-speech", "tts"],
  ["voice-clone"],
  ["multimodal"],

  // 推理 / 部署 / 向量 / 模型服务
  ["ollama"],
  ["inference"],
  ["vector-database"],
  ["vector-db"],
  ["embedding"],
  ["model-serving"],

  // AI 应用 / 垂直场景
  ["ai-writing"],
  ["ai-presentation"],
  ["ai-design"],
  ["ai-productivity"],
  ["ai-automation"],
  ["ai-search"],

  // MLOps / 训练(轻量,只追新工具不追老框架)
  ["fine-tuning"],
  ["model-training"],
  ["ai-eval", "llm-eval"],
  ["ai-observability"],
];

// 排除名单:老牌或非工具类(即便新建也排除)
export const EXCLUDE_REPOS = new Set([
  "pandas-dev/pandas",
  "numpy/numpy",
  "scikit-learn/scikit-learn",
  "matplotlib/matplotlib",
  "scipy/scipy",
  "tensorflow/tensorflow",
  "pytorch/pytorch",
  "keras-team/keras",
  "jupyter/notebook",
  "jupyterlab/jupyterlab",
  "apache/spark",
  "dmlc/xgboost",
  "microsoft/lightgbm",
  "opencv/opencv",
  "huggingface/transformers", // 老牌框架,常驻高星,不属于"新项目"
]);

// 排除关键词:出现在描述里则不像 AI 工具(教程/清单/面试题等)
export const EXCLUDE_DESC_HINTS = [
  "awesome-list", "面试", "interview question", "学习笔记", "tutorial",
  "course", "roadmap", "cheatsheet", "简历", "resume",
];

// 构造单条 GitHub Search query —— 新项目崛起榜专用
// q = 关键词 created:>窗口 stars:>门槛
// 新项目门槛低(50星即可,新项目2个月攒50星就值得看),按 stars 排序
export function buildQuery(keywords, opts = {}) {
  const minStars = opts.minStars ?? 50;
  const createdSince = opts.createdSince ?? defaultCreatedSince();
  const kwClause = keywords.map((k) => `${k}`).join(" ");
  return `${kwClause} stars:>${minStars} created:>${createdSince}`;
}

// 默认只索引近 60 天新建的项目(可配置,见 config)
function defaultCreatedSince() {
  const d = new Date();
  d.setDate(d.getDate() - CREATED_WINDOW_DAYS);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// 新项目窗口:60 天。越大候选越多但可能混入非"新";越小越聚焦"刚冒头"。
export const CREATED_WINDOW_DAYS = 60;
