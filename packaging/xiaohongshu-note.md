# 小红书发布文案

## 标题（≤20 字，选一个）

1. 让 AI 自己去查小红书
2. 让 AI 去小红书扒消费趋势
3. 我让 AI 自己去翻小红书了

## 正文

做财经、做消费、写选题的人，最缺的不是数据，是「普通人到底在说什么」。

现在可以让 AI 自己去小红书翻 👇

**跟钱有关的四件事**

- 每日财经：金价、房贷、存款利率，早上让它看一遍评论区情绪
- 消费趋势：给个品类，扒最近一个月的爆款笔记和差评点
- 爆款选题：同类笔记的标题套路 + 评论区情绪，直接抄结构
- 避坑：某家店、某个产品的真实差评，比评分站诚实

**它是怎么做到的**

不爬数据、不用 API：用你电脑上已登录的小红书网页版，需要的时候去问「点点 AI」，它自己检索几十条笔记再总结。只读、限速，不点赞不评论。

**装法（一行）**

Windows（Node 22+）：

```
irm https://raw.githubusercontent.com/talos1899/xhs-dots/main/install.ps1 | iex
```

macOS / Linux：

```
curl -fsSL https://raw.githubusercontent.com/talos1899/xhs-dots/main/install.sh | bash
```

装完对 AI 说一句「用 xhs-dots 查最近一个月的防晒消费趋势」，它自己开浏览器去翻。

实测：问「上海适合一个人周末逛的老街区」，它检索了 25 条笔记，给出愚园路、武康路、哈尔滨路，还有铁手咖啡制造局、永平里、多抓鱼这些原帖点名的店。

开源 MIT：github.com/talos1899/xhs-dots

## 标签

#AI #人工智能 #小红书 #消费趋势 #数据分析 #效率工具 #DeepSeek #开源 #自动化 #独立开发

## 配图（按顺序，1080×1440）

1. `packaging/cover.png` — 封面：让 AI 自己去查小红书
2. `packaging/card2.png` — 跟钱有关的四件事
3. `packaging/card3.png` — 实测：25 条笔记
4. `packaging/card4.png` — 一行装好 + 装完说一句话
