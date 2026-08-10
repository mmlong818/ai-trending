// 生成式 AI 方向关键词表 + GitHub Search query 构造
// 聚焦生成式 AI(大模型/LLM 应用/Agent/RAG/多模态/提示工程/推理/微调),
// 排除传统数据科学/ML 基础设施库(在 filter.mjs 里做后处理)。

// 用于 GitHub Search 的关键词组。每组构造一条 query,串行执行(匿名限流 10 req/min)。
// 命中 name/description/topics/readme 任一字段即可。
export const KEYWORD_GROUPS = [
  // 大模型本体与生态
  ["llm", "large-language-model"],
  ["chatgpt"],
  ["gpt"],
  ["claude"],
  ["gemini"],
  ["llama"],
  ["mistral"],
  ["qwen"],
  ["deepseek"],
  ["transformer"],

  // LLM 应用框架 / Agent / RAG
  ["langchain"],
  ["llamaindex"],
  ["agent", "ai-agent"],
  ["autonomous-agent"],
  ["rag", "retrieval-augmented-generation"],
  ["prompt-engineering"],
  ["ai-sdk", "openai-sdk"],
  ["function-calling"],
  ["mcp", "model-context-protocol"],

  // 多模态 / 图像 / 语音生成
  ["stable-diffusion"],
  ["comfyui"],
  ["diffusion"],
  ["text-to-image"],
  ["text-to-video"],
  ["midjourney"],
  ["sora"],
  ["flux", "image-generation"],
  ["whisper"],
  ["text-to-speech", "tts"],
  ["multimodal"],

  // 推理 / 部署 / 向量
  ["ollama"],
  ["llama.cpp"],
  ["vllm"],
  ["text-generation-inference"],
  ["vector-database", "vector-db"],
  ["embedding"],
  ["inference-server"],

  // 微调 / 训练 / 数据
  ["fine-tuning", "finetuning"],
  ["peft", "lora"],
  ["rlhf"],
  ["dataset", "instruction-tuning"],

  // 工程工具链
  ["ai-coding", "copilot"],
  ["ai-workflow"],
  ["ai-playground"],
];

// 排除名单:虽然星多但属于传统数据科学/ML 基础设施,不纳入生成式 AI 榜单。
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
]);

// 构造单条 GitHub Search query
// q = (keyword组合 OR) stars:>MIN pushed:>SINCE
export function buildQuery(keywords, opts = {}) {
  const minStars = opts.minStars ?? 300;
  const pushedSince = opts.pushedSince ?? defaultPushedSince();
  const kwClause = keywords.map((k) => `${k}`).join(" ");
  return `${kwClause} stars:>${minStars} pushed:>${pushedSince}`;
}

// 默认只看近 60 天有 push 的活跃仓库
function defaultPushedSince() {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
