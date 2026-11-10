# xhs-dots

把 **小红书** 接成 AI 助手的信息源：需要「真实用户经验」的时候，让 AI 自己去小红书查——问问「点点 AI」（它自己检索几十条笔记再总结），或者直接关键词搜笔记。

不抓包、不逆向签名、不存 cookie。用的是你自己电脑上**已经登录的浏览器**，通过 CDP 驱动，行为和你手动点开小红书网页版一模一样。

```
你 → AI 助手 → node scripts/dots.mjs ask "杭州西湖边适合一个人待的咖啡馆"
                     ↓  CDP :9223
              真实 Edge/Chrome（独立配置，已登录）
                     ↓
              点点 AI：检索 25 条笔记 → 总结回答
```

## 为什么需要它

搜索引擎给小红书内容的往往是 SEO 搬运号；小红书原帖里有具体的店名、价格、排队时间、踩坑记录。对「本地生活 / 测评 / 避坑 / 穿搭 / 菜谱」这类问题，它比通用搜索更接近真实体验。

## 快速开始

要求：Node.js **≥ 22**（用到内置 WebSocket）、本机装有 Edge 或 Chrome、能扫码登录小红书。

```bash
git clone https://github.com/talos1899/xhs-dots.git
cd xhs-dots

# 1) 启动专用浏览器窗口（第一次会让你扫码登录）
node scripts/ensure-browser.mjs

# 2) 问点点
node scripts/dots.mjs ask "上海适合一个人周末逛的老街区，要有真实笔记里的店名"

# 3) 或者搜索笔记
node scripts/xhs.mjs search "露营 装备 避坑" --limit 8 --detail 3
```

输出都是 JSON，方便管道给别的程序：

```jsonc
// dots.mjs
{ "question": "…", "progress": "搜索并总结25人真实经验…", "answer": "…", "notes": [{ "title": "…", "url": "…" }] }

// xhs.mjs search
{ "keyword": "…", "count": 8, "items": [{ "id": "…", "title": "…", "author": "…", "liked": "1.6万", "desc": "…", "tags": ["…"], "url": "…" }] }
```

## 接到 AI 助手里

仓库本身就是一份 **skill**：`SKILL.md` 描述了什么时候该用它、怎么用、有哪些边界。支持 skills 目录的 agent（Claude Code、Cursor、DeepSeek Harness 等）把它放进去即可：

```bash
node scripts/install.mjs --target ~/.claude/skills     # 或任意 skills 目录
node scripts/install.mjs --autostart                   # 可选：登录系统时自动拉起浏览器
```

`install.mjs` 会打印装到哪、以及该用哪条绝对路径去调用脚本。

## 它是怎么工作的

| 环节 | 做法 | 为什么这么做 |
|---|---|---|
| 浏览器 | 独立 `--user-data-dir` + `--remote-debugging-port` | 不污染日常浏览器；Chrome 136+ 也禁止对默认 profile 开调试端口 |
| 登录 | 你自己扫码，登录态留在 profile 目录 | 不碰账号密码，不存 token |
| 输入文字 | CDP `Input.insertText` | 直接改 `value` 会被前端框架重置 |
| 点点的回答 | 轮询 `.xhs-ai-message-copy-wrapper`，等「正在思考」消失且文本稳定 | 流式渲染，没有可靠的完成事件 |
| 笔记列表 | DOM `section.note-item` | 新版搜索页的 `__INITIAL_STATE__.search.feeds` 已不是数组 |
| 笔记正文 | `__INITIAL_STATE__.note.noteDetailMap[id].note` | 比 DOM 干净，还带发布时间、IP 属地 |

踩过的坑（也写进代码注释了）：

- Windows 上直接 `spawn` 浏览器会让它留在父进程的任务树里，父进程被 kill 时浏览器一起死 → 改用 PowerShell `Start-Process` 脱离。
- 浏览器在受限沙箱（如某些 agent 的文件沙箱）内会因缓存目录无权限而崩溃 → 要在正常用户会话里启动。
- 换平台：`XHS_BROWSER` 指定可执行文件，`XHS_PORT` 换端口，`XHS_PROFILE` 换配置目录。

## 常见问题

**要一直开着浏览器窗口吗？**
是。关掉窗口自动化就断了，重新 `node scripts/ensure-browser.mjs` 即可，登录态还在。嫌麻烦就 `--autostart`。

**会不会被风控？**
脚本按人类节奏走：串行请求、详情页之间停 1.5 秒、一次任务建议 2–3 问。别拿去批量刷数据，那是另一回事。

**无头服务器 / Docker 能用吗？**
不能直接跑：需要真实登录态和图形会话。Linux 桌面 + Xvfb 可以，容器里基本没戏。

**页面改版了怎么办？**
选择器都在 `scripts/dots.mjs`、`scripts/xhs.mjs` 顶部，改版时按报错调整即可；`cdp.mjs` 可以直接拿来手动探查页面。

**和官方 API 的关系？**
没有关系。这是浏览器自动化，走的是网页版本身。请遵守小红书的用户协议，只读、限速、个人研究使用。

## 合规

- **只读**：不点赞、不收藏、不评论、不关注、不发布。
- 引用内容时注明「来自小红书用户笔记」，不要整段搬运、不要商用分发。
- 仅限个人研究与信息检索；由使用者自行承担平台条款相关的责任。

## 目录

```
SKILL.md              给 AI agent 的技能说明
scripts/config.mjs    端口 / profile / 浏览器定位 / 脱离进程启动
scripts/cdp.mjs       极简 CDP 客户端（原生 WebSocket）
scripts/dots.mjs      点点 AI 问答
scripts/xhs.mjs       搜索 / 笔记详情
scripts/ensure-browser.mjs  幂等启动浏览器
scripts/install.mjs   安装技能目录 / 注册开机自启
```

## License

MIT
