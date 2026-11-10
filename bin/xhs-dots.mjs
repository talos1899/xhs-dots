#!/usr/bin/env node
// xhs-dots CLI：装技能 / 开浏览器 / 直接问点点 / 搜笔记
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const script = f => path.join(root, 'scripts', f);

const [cmd, ...rest] = process.argv.slice(2);
const node = process.execPath;

function run(file, args = []) {
  const r = spawnSync(node, [script(file), ...args], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

switch (cmd) {
  case undefined:
  case 'install': {
    console.log('\n  xhs-dots · 让 AI 自己去查小红书\n');
    run('install.mjs', ['--autostart', ...rest]);
    run('ensure-browser.mjs');
    console.log('\n  装好了。试试：');
    console.log('    xhs-dots ask "最近一个月防晒的消费趋势"\n');
    break;
  }
  case 'browser':
    run('ensure-browser.mjs', rest);
    break;
  case 'ask':
    run('dots.mjs', ['ask', ...rest]);
    break;
  case 'status':
    run('dots.mjs', ['status', ...rest]);
    break;
  case 'search':
    run('xhs.mjs', ['search', ...rest]);
    break;
  case 'note':
    run('xhs.mjs', ['note', ...rest]);
    break;
  case '-h':
  case '--help':
  case 'help':
    console.log(`xhs-dots — 让 AI 自己去查小红书

  xhs-dots                 装成技能 + 打开浏览器（首次扫码登录）
  xhs-dots install         只装技能
  xhs-dots browser         启动浏览器（保持登录态）
  xhs-dots ask "问题"       问「点点 AI」，它会自己检索几十条笔记
  xhs-dots search "关键词"  搜笔记（--limit 10 --detail 3）
  xhs-dots note <url|id>   读单篇笔记正文
  xhs-dots status          看登录状态

环境变量：XHS_PORT（默认 9223）、XHS_PROFILE、XHS_BROWSER`);
    break;
  default:
    console.error(`未知命令：${cmd}\n用 xhs-dots --help 看用法`);
    process.exit(1);
}
