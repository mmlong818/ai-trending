// AI 相关性后处理:从 Search 原始 items 里筛出生成式 AI 方向、去重、排除黑名单。

import { EXCLUDE_REPOS } from "./keywords.mjs";

const GENAI_HINTS = [
  "llm", "large language model", "language model", "chatgpt", "gpt",
  "claude", "gemini", "llama", "mistral", "qwen", "deepseek",
  "transformer", "langchain", "llamaindex", "agent", "rag",
  "retrieval", "prompt", "stable-diffusion", "diffusion", "comfyui",
  "text-to-image", "text-to-speech", "tts", "whisper", "multimodal",
  "ollama", "vllm", "vector", "embedding", "inference", "fine-tun",
  "lora", "peft", "rlhf", "copilot", "mcp", "model-context-protocol",
  "autogen", "crewai", "semantic", "chatbot", "assistant",
];

// 非生成式 AI 的强信号(即便命中关键词也排除)
const NON_GENAI_HINTS = [
  "data analysis notebook", "statistics", "linear algebra",
  "data visualization library", "dataframe", "scientific computing",
];

function normalize(s) {
  return (s || "").toLowerCase();
}

// 判断一个 repo 是否属于生成式 AI 方向
export function isGenAI(repo) {
  const fn = (repo.full_name || "").toLowerCase();
  if (EXCLUDE_REPOS.has(fn)) return false;

  const blob = [
    repo.name,
    repo.description,
    (repo.topics || []).join(" "),
  ]
    .map(normalize)
    .join(" ");

  const hitsGenAI = GENAI_HINTS.some((k) => blob.includes(k));
  if (!hitsGenAI) return false;

  const hitsNon = NON_GENAI_HINTS.some((k) => blob.includes(k));
  if (hitsNon) return false;

  return true;
}

// 从 Search items 里筛出 AI 相关,去重(以 full_name 为键),保留首次出现的最新字段
export function filterAndDedup(items) {
  const map = new Map();
  for (const it of items) {
    if (!it || !it.full_name) continue;
    if (!isGenAI(it)) continue;
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
    homepage: repo.homepage || null,
  };
}
