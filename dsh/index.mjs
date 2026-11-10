// DeepSeek Harness 插件外壳：把 xhs-dots 的 CLI 注册成三个工具，装上后
// 模型在对话里就能直接调用（不用先记着去跑 node scripts/…）。
// 插件只做「参数 → 子进程 → 结构化结果」，真正的浏览器操作仍在 scripts/ 里，
// 这样 CLI 用法和插件用法共享同一份代码。
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS = new URL('../scripts/', import.meta.url);

export const name = 'xhs-dots';
export const inject = ['tools'];

function runNode(script, args, signal) {
  const file = fileURLToPath(new URL(script, SCRIPTS));
  return new Promise(resolve => {
    const child = spawn(process.execPath, [file, ...args], {
      signal,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', e => resolve({ code: -1, stdout, stderr: String(e && e.message || e) }));
    child.on('close', code => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

function parseJson(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const start = s.search(/[[{]/);
  if (start < 0) return null;
  try { return JSON.parse(s.slice(start)); } catch { return null; }
}

const ASK = {
  name: 'xhs_ask',
  description:
    'Ask 小红书「点点 AI」a real question (it searches dozens of real notes and summarizes). Use when the user wants real-people experience: 消费趋势、口碑、避坑、爆款选题、某个城市/门店的真实评价。Reads only; the local browser must be logged in. First run may need a one-time QR scan in the opened window (pass waitLogin to pause for it).',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '自然语言问题，越具体越好（带品类、时间范围、城市）' },
      timeoutSeconds: { type: 'number', description: '最长等待秒数，默认 150' },
      waitLoginSeconds: { type: 'number', description: '如果弹出扫码登录，等用户扫码的秒数；默认 0（直接报错提示）' },
    },
    required: ['question'],
  },
  async execute(args, exec) {
    const cli = [
      'ask', String(args.question),
      '--timeout', String(Math.max(30, Number(args.timeoutSeconds) || 150)),
    ];
    if (Number(args.waitLoginSeconds) > 0) cli.push('--wait-login', String(Number(args.waitLoginSeconds)));
    const { code, stdout, stderr } = await runNode('dots.mjs', cli, exec && exec.signal);
    const data = parseJson(stdout);
    if (!data) {
      throw new Error(`xhs-dots 失败（exit ${code}）：${(stderr || stdout || '').trim().slice(0, 500)}`);
    }
    return {
      question: data.question,
      answer: data.answer || '',
      sources: Array.isArray(data.notes) ? data.notes : [],
      progress: data.progress || '',
      conversationId: data.conversationId || '',
    };
  },
  output: {
    schema: { type: 'json' },
    render: (_args, value) => [{
      type: 'text',
      text: [
        value.answer,
        value.sources && value.sources.length ? '\n笔记链接：\n' + value.sources.map((n, i) => `${i + 1}. ${n.title || n.url || n}`).join('\n') : '',
      ].filter(Boolean).join('\n'),
    }],
  },
  presentCall: args => ({ card: 'generic', title: 'xhs_ask', kind: 'search', rawInput: args }),
  timeoutMs: 300000,
};

const SEARCH = {
  name: 'xhs_search',
  description:
    'Search 小红书 notes by keyword and get structured cards (title, author, likes, date, link). Use when you need a list of raw notes rather than a summary; add detail>0 to also read the first N notes\' full text/tags.',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string', description: '搜索词' },
      limit: { type: 'number', description: '返回条数，默认 10，最多 30' },
      detail: { type: 'number', description: '再读前 N 条的正文/标签，默认 0' },
    },
    required: ['keyword'],
  },
  async execute(args, exec) {
    const cli = [
      'search', String(args.keyword),
      '--limit', String(Math.min(30, Math.max(1, Number(args.limit) || 10))),
      '--detail', String(Math.max(0, Math.min(10, Number(args.detail) || 0))),
    ];
    const { code, stdout, stderr } = await runNode('xhs.mjs', cli, exec && exec.signal);
    const data = parseJson(stdout);
    if (!data) {
      throw new Error(`xhs-dots 失败（exit ${code}）：${(stderr || stdout || '').trim().slice(0, 500)}`);
    }
    return data;
  },
  output: {
    schema: { type: 'json' },
    render: (_args, value) => [{
      type: 'text',
      text: (value.items || []).map((n, i) =>
        `${i + 1}. ${n.title} — ${n.author || ''} ${n.liked ? '· ' + n.liked + ' 赞' : ''} ${n.time || ''}\n   ${n.url || ''}${n.desc ? '\n   ' + String(n.desc).slice(0, 160) : ''}`
      ).join('\n') || '（没有结果：可能触发了风控或关键词太窄）',
    }],
  },
  presentCall: args => ({ card: 'generic', title: 'xhs_search', kind: 'search', rawInput: args }),
  timeoutMs: 180000,
};

export function apply(ctx) {
  ctx.tools.register(ASK);
  ctx.tools.register(SEARCH);
}
