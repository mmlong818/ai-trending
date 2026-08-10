// AI 相关性后处理:筛出广义 AI 工具、去重、排除黑名单与教程清单类内容。

import { EXCLUDE_REPOS, EXCLUDE_DESC_HINTS } from "./keywords.mjs";

const AI_HINTS = [
  // 大模型 / 对话
  "llm", "large language model", "language model", "chatgpt", "gpt",
  "claude", "gemini", "llama", "qwen", "deepseek", "mistral",
  // Agent / 自动化
  "agent", "ai-agent", "autonomous", "ai-assistant", "browser-use",
  "computer use", "copilot", "agentic",
  // LLM 应用 / RAG
  "langchain", "llamaindex", "rag", "retrieval", "prompt", "mcp",
  "model context protocol", "ai-sdk", "ai workflow",
  // 生成 / 多模态
  "stable-diffusion", "diffusion", "comfyui", "text-to-image",
  "text-to-video", "image generation", "video generation",
  "tts", "text-to-speech", "whisper", "voice clone", "multimodal",
  "flux", "ai art",
  // 推理 / 部署
  "ollama", "vllm", "inference", "vector", "embedding", "model serving",
  // 训练 / 评估
  "fine-tun", "lora", "rlhf", "llm-eval", "ai-eval",
  // AI 应用 / 工具(广义)
  "ai coding", "code assistant", "ai ide", "ai chatbot",
  "ai writing", "ai presentation", "ai design", "ai productivity",
  "ai automation", "ai search", "conversational ai",
  // 通用 AI 提法
  "artificial intelligence", "ai-powered", "ai tool", "ai app",
];

// 非 AI 工具的强信号(即便命中关键词也排除)
const NON_AI_HINTS = [
  "data analysis notebook", "statistics", "linear algebra",
  "data visualization library", "dataframe", "scientific computing",
];

function normalize(s) {
  return (s || "").toLowerCase();
}

// 判断一个 repo 是否属于广义 AI 工具方向
export function isAITool(repo) {
  const fn = (repo.full_name || "").toLowerCase();
  if (EXCLUDE_REPOS.has(fn)) return false;

  const blob = [
    repo.name,
    repo.description,
    (repo.topics || []).join(" "),
  ]
    .map(normalize)
    .join(" ");

  // 排除教程/清单/面试题类(它们常命中 ai 关键词但不是工具)
  if (EXCLUDE_DESC_HINTS.some((k) => blob.includes(k))) return false;

  if (!AI_HINTS.some((k) => blob.includes(k))) return false;

  if (NON_AI_HINTS.some((k) => blob.includes(k))) return false;

  return true;
}

// 兼容旧名(其他模块可能引用)
export const isGenAI = isAITool;

// 从 Search items 里筛出 AI 工具,去重(以 full_name 为键)
export function filterAndDedup(items) {
  const map = new Map();
  for (const it of items) {
    if (!it || !it.full_name) continue;
    if (!isAITool(it)) continue;
    if (map.has(it.full_name)) continue;
    map.set(it.full_name, it);
  }
  return Array.from(map.values());
}

// 把 GitHub repo 精简为本地需要的字段
export function slimRepo(repo) {
  return {
    full_name: repo.full_name,
    name: repo.name,
    url: repo.html_url,
    stars: repo.stargazers_count ?? 0,
    description: repo.description || "",
    topics: repo.topics || [],
    language: repo.language || "",
    license: repo.license?.spdx_id || repo.license?.name || null,
    pushed_at: repo.pushed_at || null,
    created_at: repo.created_at || null,
    homepage: repo.homepage || null,
  };
}
