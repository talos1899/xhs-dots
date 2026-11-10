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

## 跟钱有关的四个用法

| 用法 | 怎么问 | 你会得到 |
|---|---|---|
| 每日财经 | 「汇总今天小红书上关于金价/房贷/存款利率的讨论」 | 普通人在评论区到底怎么想，而不是财经号的通稿 |
| 消费趋势 | 「最近一个月防晒品类的爆款笔记和差评点」 | 什么在涨、什么在崩、差评集中在哪 |
| 爆款选题 | 「最近一周同类笔记的标题套路和评论区情绪」 | 能直接抄的标题结构 |
| 避坑 | 「某家店 / 某个产品的真实差评」 | 比评分站更早的翻车信号 |

## 一键安装

任何系统、只要装了 Node 22+（不用注册、不用 API Key）：

```bash
npx -y github:talos1899/xhs-dots
```

Windows 也可以用 PowerShell 原生方式（不用管理员权限）：

```powershell
irm https://raw.githubusercontent.com/talos1899/xhs-dots/main/install.ps1 | iex
```

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/talos1899/xhs-dots/main/install.sh | bash
```

它会：检查 Node ≥ 22 → 下载解压到 `~/.xhs-dots-src` → 装成技能目录并注册开机自启 → 打开浏览器等你扫码。装完直接：

```bash
xhs-dots ask "最近一个月防晒的消费趋势"
```

只想手动来一遍？三个命令：

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
会，小红书有反爬。脚本按人类节奏走：串行请求、详情页之间停 1.5 秒、一次任务建议 2–3 问；已经在点点页就不重复整页刷新。真被拦时的表现和对策：

- 弹出「扫码登录 / 安全验证」→ 在窗口里用小红书 App 扫一下，然后 `ask "问题" --wait-login 90`，它会等你扫完再继续。
- 笔记详情跳 `/404?error_code=300031`（当前笔记暂时无法浏览）→ 这个链接的 `xsec_token` 过期了，重新 `search` 拿新链接；只给 id 是打不开的（平台要求 token）。
- 一晚上反复测试最容易触发，隔一段时间再跑通常就恢复。

**长时间高频用会不会被封号？**
风险自负。建议把它当「偶尔查一下真实口碑」的工具，而不是监控/爬虫：单次跑 2–3 个问题，别连续跑几十次。

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
