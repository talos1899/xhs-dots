// 跨平台配置：端口、配置目录、浏览器可执行文件定位、脱离父进程启动。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const PORT = Number(process.env.XHS_PORT || 9223);
export const PROFILE = process.env.XHS_PROFILE || path.join(os.homedir(), '.xhs-dots', 'profile');
export const HOME_URL = 'https://www.xiaohongshu.com/ai_chat?from=sidebar';
export const BASE_URL = `http://127.0.0.1:${PORT}`;

const CANDIDATES = {
  win32: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ],
  darwin: [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

/** 返回浏览器可执行文件路径；显式指定用 XHS_BROWSER=... */
export function resolveBrowser() {
  if (process.env.XHS_BROWSER) return process.env.XHS_BROWSER;
  for (const p of CANDIDATES[process.platform] || []) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

export function browserArgs() {
  return [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    HOME_URL,
  ];
}

/**
 * 以「脱离当前进程树」的方式启动浏览器：
 * - Windows 用 PowerShell Start-Process，否则浏览器会挂在调用方任务树里，父进程被 kill 时一起死；
 * - macOS/Linux 用 detached + unref。
 * 返回后不会等待浏览器退出。
 */
export function launchDetached(browser, args) {
  if (process.platform === 'win32') {
    const list = args.map(a => `'${a.replace(/'/g, "''")}'`).join(',');
    const ps = `Start-Process -FilePath '${browser}' -ArgumentList ${list}`;
    const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return child;
  }
  const child = spawn(browser, args, { stdio: 'ignore', detached: true });
  child.unref();
  return child;
}

export async function probe() {
  try {
    const r = await fetch(`${BASE_URL}/json/version`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return j.Browser || 'unknown';
  } catch {
    return null;
  }
}
