// 小红书关键词搜索 / 单篇笔记，走本机已登录的浏览器。
// usage: node scripts/xhs.mjs status
//        node scripts/xhs.mjs search "关键词" [--limit 10] [--detail 3]
//        node scripts/xhs.mjs note <url|id> [--xsec <token>]
import { page, evaluate, waitFor, sleep } from './cdp.mjs';

const CARDS = `(() => {
  const cards = [...document.querySelectorAll('section.note-item')];
  return cards.map(el => {
    const a = el.querySelector('a.cover');
    const href = a ? (a.getAttribute('href') || '') : '';
    const m = href.match(/xsec_token=([^&]*)/);
    const id = el.getAttribute('data-note-id') || (href.match(/([0-9a-f]{24})/) || [])[1] || '';
    const titleEl = el.querySelector('.footer .title, .title');
    const img = el.querySelector('img[data-xhs-img], img');
    return {
      id,
      xsec_token: m ? decodeURIComponent(m[1]) : '',
      title: titleEl ? titleEl.innerText.replace(/\\s+/g, ' ').trim() : '',
      author: ((el.querySelector('.author .name') || {}).innerText || '').trim(),
      time: ((el.querySelector('.author .time, .time') || {}).innerText || '').trim(),
      liked: ((el.querySelector('.like-wrapper .count') || {}).innerText || '').trim(),
      cover: img ? (img.getAttribute('src') || '') : '',
    };
  }).filter(x => x.id);
})()`;

const LOGGED_OUT = `document.body.innerText.includes('登录后查看搜索结果')`;

const noteUrl = (id, token) => token
  ? `https://www.xiaohongshu.com/explore/${id}?xsec_token=${encodeURIComponent(token)}&xsec_source=pc_search`
  : `https://www.xiaohongshu.com/explore/${id}`;

async function noteDetail(p, id, token) {
  await p.send('Page.navigate', { url: noteUrl(id, token) });
  const ok = await waitFor(p, `(() => {
    const s = window.__INITIAL_STATE__ || {};
    const m = s.note && s.note.noteDetailMap;
    return !!(m && m[${JSON.stringify(id)}] && m[${JSON.stringify(id)}].note);
  })()`, { timeout: 20000 });

  if (ok) {
    return evaluate(p, `(() => {
      const n = window.__INITIAL_STATE__.note.noteDetailMap[${JSON.stringify(id)}].note;
      const t = n.time ? new Date(Number(n.time)) : null;
      return {
        title: n.title || '',
        desc: (n.desc || '').replace(/\\s+/g, ' ').trim(),
        tags: (n.tagList || []).map(x => x.name).filter(Boolean),
        publishTime: t ? t.toISOString().slice(0, 10) : '',
        ipLocation: n.ipLocation || '',
      };
    })()`);
  }

  const dom = await waitFor(p, `!!document.querySelector('#detail-desc, .note-text, .desc')`, { timeout: 10000 });
  if (!dom) {
    // 风控：小红书会把可疑请求/无 token 的笔记跳到 404?error_code=300031「当前笔记暂时无法浏览」
    const block = await evaluate(p, `(() => {
      const t = document.body ? document.body.innerText : '';
      const u = location.href;
      const m = u.match(/error_msg=([^&]+)/);
      return {
        risk: /300031|sec_|\\/404/.test(u) || /暂时无法浏览|安全验证|扫码登录/.test(t),
        reason: m ? decodeURIComponent(m[1]) : '',
        url: u.slice(0, 120),
      };
    })()`).catch(() => null);
    if (block && block.risk) {
      throw new Error(
        '被风控拦了：' + (block.reason || '当前笔记暂时无法浏览') +
        (token ? '（token 已失效，重新 search 拿新链接）' : '（这个笔记需要带 xsec_token 的链接：用 search 结果里的 url，或加 --xsec）')
      );
    }
    throw new Error('详情页没加载出来（需要登录，或链接缺少 xsec_token）');
  }
  return evaluate(p, `(() => ({
    title: ((document.querySelector('#detail-title, .title') || {}).innerText || '').trim(),
    desc: ((document.querySelector('#detail-desc, .note-text, .desc') || {}).innerText || '').replace(/\\s+/g, ' ').trim(),
    tags: [],
    publishTime: ((document.querySelector('.bottom-container .date, .date') || {}).innerText || '').trim(),
    ipLocation: '',
  }))()`);
}

async function search(keyword, { limit = 10, detail = 0 } = {}) {
  const p = await page();
  try {
    const url = `https://www.xiaohongshu.com/search_result/?keyword=${encodeURIComponent(keyword)}&source=web_search_result_notes`;
    await p.send('Page.navigate', { url });

    const got = await waitFor(p, `document.querySelectorAll('section.note-item').length > 0`, { timeout: 25000 });
    if (!got) {
      if (await evaluate(p, LOGGED_OUT)) throw new Error('未登录：先运行 node scripts/ensure-browser.mjs，用小红书 App 扫码');
      throw new Error('搜索页没有渲染出笔记卡片（风控或页面改版）');
    }

    let cards = await evaluate(p, CARDS);
    for (let i = 0; i < 6 && cards.length < limit; i++) {
      await evaluate(p, `window.scrollTo(0, document.body.scrollHeight)`);
      await sleep(1600);
      const next = await evaluate(p, CARDS);
      if (next.length === cards.length) break;
      cards = next;
    }

    const seen = new Set();
    const items = [];
    for (const c of cards) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      items.push(c);
      if (items.length >= limit) break;
    }
    for (const it of items) it.url = noteUrl(it.id, it.xsec_token);

    for (let i = 0; i < Math.min(detail, items.length); i++) {
      try {
        Object.assign(items[i], await noteDetail(p, items[i].id, items[i].xsec_token));
      } catch (e) {
        items[i].desc = `(详情失败: ${e.message})`;
      }
      await sleep(1500);
    }
    return { keyword, count: items.length, items };
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
      loggedOut: document.body.innerText.includes('登录后查看搜索结果') || !!document.querySelector('.login-container'),
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
  if (cmd === 'search') {
    console.log(JSON.stringify(await search(positional[0], {
      limit: Number(flags.limit || 10),
      detail: Number(flags.detail || 0),
    }), null, 2));
  } else if (cmd === 'note') {
    const arg = positional[0] || '';
    const id = (arg.match(/[0-9a-f]{24}/) || [])[0];
    const token = decodeURIComponent((arg.match(/xsec_token=([^&]+)/) || [])[1] || flags.xsec || '');
    if (!id) throw new Error('需要笔记 id 或链接');
    const p = await page();
    try {
      console.log(JSON.stringify({ id, ...(await noteDetail(p, id, token)) }, null, 2));
    } finally {
      p.close();
    }
  } else if (cmd === 'status') {
    console.log(JSON.stringify(await status(), null, 2));
  } else {
    console.log('usage: node scripts/xhs.mjs status | search "kw" [--limit 10] [--detail 3] | note <url|id>');
  }
} catch (e) {
  console.error('ERROR: ' + e.message);
  process.exit(2);
}
process.exit(0);
