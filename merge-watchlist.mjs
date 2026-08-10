#!/usr/bin/env node
// merge-watchlist.mjs
// 把管理页面产生的待合流变更(watchlist-changes.json)应用到 watchlist.json。
// collect.mjs 启动时会自动调用一次,也可单独手动运行:
//   node merge-watchlist.mjs              # 消费 data/watchlist-changes.json
//   node merge-watchlist.mjs --from-file path/to/downloaded.json  # 用页面下载的文件

import { mergePendingChanges, readChanges, applyChanges, readWatchlist, writeWatchlist } from "./lib/watchlist.mjs";
import { readFileSync, existsSync } from "node:fs";

function parseArgs() {
  const args = process.argv.slice(2);
  let fromFile = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from-file" && args[i + 1]) {
      fromFile = args[++i];
    }
  }
  return { fromFile };
}

async function main() {
  const { fromFile } = parseArgs();

  if (fromFile) {
    // 页面下载的文件可能是完整 watchlist,也可能是 changes 队列,都尝试处理
    if (!existsSync(fromFile)) {
      console.error(`✗ 文件不存在: ${fromFile}`);
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(fromFile, "utf8"));
    const wl = readWatchlist();
    let next;
    if (Array.isArray(data.pending)) {
      // changes 队列:直接写到 changes 路径再合流
      console.log(`• 从文件读到 ${data.pending.length} 条 changes`);
      next = applyChanges(wl.items, data.pending);
    } else if (Array.isArray(data.items)) {
      // 完整 watchlist:以页面为准替换
      console.log(`• 从文件读到完整 watchlist(${data.items.length} 项),覆盖本地`);
      next = data.items;
    } else {
      console.error("✗ 文件格式无法识别(既不是 changes 也不是 watchlist)");
      process.exit(1);
    }
    writeWatchlist(next);
    console.log(`✓ watchlist.json 已更新: ${wl.items.length} → ${next.length}`);
    return;
  }

  // 默认:消费 data/watchlist-changes.json
  const pending = readChanges();
  if (pending.length === 0) {
    console.log("• 没有待合流变更。");
    return;
  }
  console.log(`• 待合流变更 ${pending.length} 条,开始应用...`);
  const result = mergePendingChanges();
  console.log(
    `✓ 合流完成:应用 ${result.applied} 条,关注列表 ${result.before} → ${result.after}`,
  );
}

main().catch((e) => {
  console.error("✗ 合流失败:", e?.message || e);
  process.exit(1);
});
