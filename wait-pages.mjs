#!/usr/bin/env node
// wait-pages.mjs — 推送后轮询线上,确认 Pages 已更新到最新版本。
// 学习自 ai-pulse:读取本地 docs/index.html 算 sha256 指纹,
// 每 10 秒 fetch 线上同路径(带缓存破坏参数),直到指纹匹配或超时。
// 用法: node wait-pages.mjs [commit-hash]
// 退出码: 0=已上线 1=超时未确认

import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_INDEX = join(__dirname, "docs", "index.html");

// 线上地址(可被环境变量覆盖)
const BASE_URL = process.env.PAGES_URL || "https://mmlong818.github.io/ai-trending/";
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || "http://127.0.0.1:7897";

const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS = 12 * 60_000; // 最多等 12 分钟

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

async function fetchLive(url) {
  // 优先用代理(本地网络环境),CI 环境无代理则直连
  const opts = {};
  if (PROXY && !process.env.CI) {
    const { ProxyAgent } = await import("node:https").then(() => ({})).catch(() => ({}));
    // Node 18+ 全局 fetch 不直接支持 proxy,简单用 undici(若可用);否则直连
    try {
      const { ProxyAgent: PA } = await import("undici");
      opts.dispatcher = new PA(PROXY);
    } catch {
      // undici 不可用,直连(CI 环境通常不需要代理)
    }
  }
  const cacheBust = `${url}${url.includes("?") ? "&" : "?"}deploy=${Date.now()}`;
  const res = await fetch(cacheBust, opts);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  if (!existsSync(LOCAL_INDEX)) {
    console.error("✗ 本地 docs/index.html 不存在,先运行 site-builder.mjs");
    process.exit(1);
  }
  const localBuf = readFileSync(LOCAL_INDEX);
  const localHash = sha256(localBuf);
  console.log(`▶ 等待线上 Pages 更新`);
  console.log(`  本地指纹: ${localHash}`);
  console.log(`  线上地址: ${BASE_URL}`);

  const indexUrl = BASE_URL.endsWith("/") ? BASE_URL + "index.html" : BASE_URL;
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < MAX_WAIT_MS) {
    attempt++;
    try {
      const live = await fetchLive(indexUrl);
      if (live) {
        const liveHash = sha256(live);
        if (liveHash === localHash) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(0);
          console.log(`✓ 线上已更新到最新版本(第 ${attempt} 次轮询,耗时 ${elapsed}s)`);
          process.exit(0);
        }
        console.log(`  [${attempt}] 线上指纹 ${liveHash} ≠ 本地 ${localHash},继续等…`);
      } else {
        console.log(`  [${attempt}] 线上未响应(可能部署中),继续等…`);
      }
    } catch (e) {
      console.log(`  [${attempt}] fetch 失败: ${(e?.message || e).slice(0, 80)},继续等…`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  const waited = (MAX_WAIT_MS / 60000);
  console.error(`✗ 等待 ${waited} 分钟后线上仍未更新,放弃(本地指纹 ${localHash})`);
  console.error(`  这不一定代表部署失败——GitHub Pages 偶尔延迟。可稍后手动检查 ${BASE_URL}`);
  process.exit(1);
}

main();
