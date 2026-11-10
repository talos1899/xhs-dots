// 问小红书「点点 AI」：它会自己检索平台笔记并总结成回答。
// usage: node scripts/dots.mjs ask "问题" [--timeout 120] [--wait-login 120]
//        node scripts/dots.mjs status
import { page, evaluate, waitFor, sleep } from './cdp.mjs';

const HOME = 'https://www.xiaohongshu.com/ai_chat?from=sidebar';

const SNAP = `(() => {
  const wrappers = [...document.querySelectorAll('.xhs-ai-message-copy-wrapper')];
  const last = wrappers[wrappers.length - 1];
  const body = document.body ? document.body.innerText : '';
  return {
    busy: /正在思考|正在搜|正在生成/.test(body),
    count: wrappers.length,
    text: last ? last.innerText.replace(/\\s+/g, ' ').trim() : '',
  };
})()`;

async function ask(question, { timeout = 120, waitLogin = 0 } = {}) {
  const p = await page();
  try {
    // 已经在点点页就不要重复导航：反复整页刷新最容易触发风控
    const onDots = await evaluate(p, `location.href.includes('/ai_chat') && !!document.querySelector('textarea')`);
    if (!onDots) await p.send('Page.navigate', { url: HOME });

    // 风控/登录墙检测：被要求扫码时，等用户扫（--wait-login）或直接报清楚
    const walled = async () => evaluate(p, `(() => {
      const t = document.body ? document.body.innerText : '';
      return /扫码登录|登录后查看|请先登录|安全验证|滑动验证/.test(t) || /\\/login/.test(location.href);
    })()`).catch(() => false);

    if (await walled()) {
      if (!waitLogin) {
        throw new Error('小红书要求登录/验证：请在弹出的浏览器窗口里用 App 扫码，然后重跑（或加 --wait-login 120 让我等你扫）');
      }
      const t0 = Date.now();
      process.stderr.write('[xhs-dots] 需要扫码：请在浏览器窗口里用小红书 App 扫一下，我在等你…\n');
      while (Date.now() - t0 < waitLogin * 1000) {
        await sleep(3000);
        if (!(await walled())) break;
      }
      if (await walled()) throw new Error(`等了 ${waitLogin} 秒还没扫码成功，先手动登一下再跑`);
      if (!/\/ai_chat/.test(await evaluate(p, 'location.href'))) await p.send('Page.navigate', { url: HOME });
    }

    // 输入框是 textarea[name=aiSearchTextarea]；页面上有两个，真正的那个不带 aria-hidden
    const ready = await waitFor(p, `(() => {
      const el = [...document.querySelectorAll('textarea')].find(e => !e.getAttribute('aria-hidden') && e.offsetParent);
      if (!el) return false;
      [...document.querySelectorAll('button')].filter(b => /我知道了/.test(b.innerText || '')).forEach(b => b.click());
      el.focus();
      return true;
    })()`, { timeout: 20000 });
    if (!ready) throw new Error('没找到点点输入框：可能未登录，或页面改版');

    // 必须用 Input.insertText 走真实输入事件；直接改 value 会被前端框架重置
    await p.send('Input.insertText', { text: question });
    await sleep(600);

    const typed = await evaluate(p, `[...document.querySelectorAll('textarea')].some(e => (e.value || '').length > 1)`);
    if (!typed) throw new Error('文字没输进去（输入框没聚焦？）');

    const sent = await evaluate(p, `(() => {
      const btn = [...document.querySelectorAll('.wendian-btn--sendable, .bottom-box button')]
        .filter(b => b.offsetParent)
        .find(b => /sendable/.test(b.className) || /send|arrow/i.test((b.querySelector('use') || {}).getAttribute?.('href') || ''));
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (!sent) throw new Error('没找到发送按钮（页面改版？）');

    let last = '';
    let stable = 0;
    let started = false;
    const t0 = Date.now();
    while (Date.now() - t0 < timeout * 1000) {
      await sleep(1200);
      const s = await evaluate(p, SNAP).catch(() => null);
      if (!s) continue;
      if (s.text) started = true;
      if (started && !s.busy && s.text === last) stable++;
      else stable = 0;
      last = s.text || last;
      if (started && stable >= 2) break;
    }

    const detail = await evaluate(p, `(() => {
      const wrappers = [...document.querySelectorAll('.xhs-ai-message-copy-wrapper')];
      const last = wrappers[wrappers.length - 1];
      if (!last) return null;
      const seen = new Set();
      const notes = [...last.querySelectorAll('a[href*="/explore/"]')]
        .map(a => ({
          title: (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          url: a.getAttribute('href'),
        }))
        .filter(n => n.title && n.url && !seen.has(n.url) && seen.add(n.url));
      const text = last.innerText.replace(/\\s+/g, ' ').trim();
      const idx = text.lastIndexOf('已完成');
      return {
        progress: idx > -1 ? text.slice(0, idx + 3) : '',
        answer: idx > -1 ? text.slice(idx + 3).trim() : text,
        notes: notes.slice(0, 20),
        conversationId: (location.search.match(/conversationId=([^&]+)/) || [])[1] || '',
      };
    })()`);

    if (!detail) throw new Error('没拿到点点回复（可能超时）');
    return { question, ...detail };
  } finally {
    p.close();
  }
}

async function status() {
  const p = await page();
  try {
    return await evaluate(p, `(() => ({
      url: location.href,
      title: document.title,
      loggedOut: document.body.innerText.includes('登录后查看搜索结果'),
    }))()`);
  } finally {
    p.close();
  }
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {};
const positional = [];
for (let i = 1; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1]; i++; }
  else positional.push(argv[i]);
}

try {
  if (cmd === 'ask') {
    const r = await ask(positional.join(' '), { timeout: Number(flags.timeout || 120), waitLogin: Number(flags['wait-login'] || 0) });
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === 'status') {
    console.log(JSON.stringify(await status(), null, 2));
  } else {
    console.log('usage: node scripts/dots.mjs ask "问题" [--timeout 120] [--wait-login 120] | status');
  }
} catch (e) {
  console.error('ERROR: ' + e.message);
  process.exit(2);
}
process.exit(0);
