// 极简 CDP 客户端：只用 Node 内置 WebSocket（Node >= 22），无第三方依赖。
import { BASE_URL } from './config.mjs';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function version() {
  const r = await fetch(`${BASE_URL}/json/version`);
  return r.json();
}

export async function browserWs() {
  return (await version()).webSocketDebuggerUrl;
}

export async function listTargets() {
  const r = await fetch(`${BASE_URL}/json/list`);
  return r.json();
}

export function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', e => reject(new Error('WebSocket 连接失败: ' + (e.message || 'unknown'))));
  });
  ws.addEventListener('message', ev => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  });
  return {
    ready,
    send(method, params = {}) {
      const mid = ++id;
      return new Promise((resolve, reject) => {
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
        setTimeout(() => {
          if (pending.has(mid)) {
            pending.delete(mid);
            reject(new Error('CDP 超时: ' + method));
          }
        }, 60000);
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    close() { try { ws.close(); } catch {} },
  };
}

async function attach(target) {
  const p = connect(target.webSocketDebuggerUrl);
  await p.ready;
  await p.send('Page.enable');
  await p.send('Runtime.enable');
  return p;
}

/** 优先复用已打开的小红书标签页，否则用任意一个标签页 */
export async function findPage() {
  const targets = await listTargets();
  const t = targets.find(x => x.type === 'page' && /xiaohongshu\.com/.test(x.url || ''))
    || targets.find(x => x.type === 'page');
  if (!t || !t.webSocketDebuggerUrl) {
    throw new Error('浏览器没在调试端口上跑，先执行：node scripts/ensure-browser.mjs');
  }
  return t;
}

export async function page() {
  return attach(await findPage());
}

export async function evaluate(p, expression) {
  const r = await p.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (r.exceptionDetails) {
    throw new Error('页面脚本出错: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result?.value;
}

export async function waitFor(p, expr, { timeout = 20000, interval = 600 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await evaluate(p, expr).catch(() => null);
    if (v) return v;
    await sleep(interval);
  }
  return null;
}
