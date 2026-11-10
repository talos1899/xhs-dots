# 生成小红书 4 张图：封面 / 用途 / 实测 / 安装
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1440
OUT = os.path.dirname(os.path.abspath(__file__))
FONTS = r"C:\Windows\Fonts"
INK = (18, 15, 24)
INK2 = (38, 26, 50)
WHITE = (255, 255, 255)
GREY = (188, 180, 200)
RED = (255, 74, 100)
M = 88


def f(name, size):
    for n in ([name] if isinstance(name, str) else name):
        p = os.path.join(FONTS, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise SystemExit("missing font " + str(name))


BOLD = lambda s: f(["msyhbd.ttc", "msyh.ttc"], s)
REG = lambda s: f(["msyh.ttc", "msyhbd.ttc"], s)
MONO = lambda s: f(["consola.ttf", "msyh.ttc"], s)


def canvas(glow_xy=(W - 480, -460, W + 340, 380)):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(int(INK[i] + (INK2[i] - INK[i]) * t) for i in range(3)))
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(glow).ellipse(glow_xy, fill=RED)
    glow = glow.filter(ImageFilter.GaussianBlur(190))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L")), 0.5)
    return img, ImageDraw.Draw(img)


def pill(d, xy, text, font, color=RED, pad=(30, 16)):
    tw = d.textbbox((0, 0), text, font=font)[2]
    th = d.textbbox((0, 0), text, font=font)[3]
    w, h = tw + pad[0] * 2, th + pad[1] * 2
    x, y = xy
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, outline=color, width=3)
    d.text((x + pad[0], y + pad[1] - 4), text, font=font, fill=color)
    return y + h


def footer(d, text="xhs-dots · github.com/talos1899/xhs-dots"):
    d.text((M, H - 108), text, font=MONO(28), fill=(126, 116, 142))


# ---------- 1 封面 ----------
img, d = canvas()
pill(d, (M, 132), "说一句话 · AI 自己去翻", REG(36))
d.text((M, 330), "让 DeepSeek Harness", font=BOLD(82), fill=WHITE)
d.text((M, 448), "自己去查", font=BOLD(150), fill=WHITE)
d.text((M, 618), "小红书", font=BOLD(190), fill=RED)
d.line([(M, 930), (M + 220, 930)], fill=RED, width=6)
d.text((M, 990), "做财经和消费的人", font=REG(42), fill=GREY)
d.text((M, 1052), "先听到最真实的声音", font=REG(42), fill=GREY)
footer(d)
img.save(os.path.join(OUT, "cover.png"))

# ---------- 2 用途 ----------
img, d = canvas((W - 620, H - 720, W + 260, H + 120))
pill(d, (M, 150), "跟钱有关的四件事", REG(38))
d.text((M, 250), "它不只是搜笔记", font=BOLD(84), fill=WHITE)
d.text((M, 352), "是给你看风声", font=BOLD(84), fill=RED)

rows = [
    ("每日财经", "金价、房贷、存款利率，普通人在评论区怎么说"),
    ("消费趋势", "给一个品类，扒最近一个月的爆款和差评点"),
    ("爆款选题", "同类笔记的标题套路 + 评论区情绪，直接抄结构"),
    ("避坑", "某家店、某个产品的真实差评，比评分站诚实"),
]
y = 510
for head, sub in rows:
    d.text((M, y), head, font=BOLD(52), fill=WHITE)
    d.text((M, y + 70), sub, font=REG(33), fill=GREY)
    y += 190
footer(d)
img.save(os.path.join(OUT, "card2.png"))

# ---------- 3 实测 ----------
img, d = canvas((60, H - 620, 640, H + 100))
pill(d, (M, 150), "实测", REG(38))
d.text((M, 260), "它真的去翻了", font=BOLD(96), fill=WHITE)
d.text((M, 380), "25 条笔记", font=BOLD(96), fill=RED)
d.text((M, 540), "问：上海适合一个人周末逛的老街区？", font=REG(36), fill=GREY)

rows = [
    ("愚园路 武康路 安福路 永嘉路", "笔记里反复出现的梧桐马路"),
    ("铁手咖啡制造局 永平里 多抓鱼", "原帖点名的店，不是榜单抄的"),
    ("哈尔滨路 南昌路 延庆路", "人少出片的冷门路段"),
]
y = 700
for head, sub in rows:
    d.ellipse([M, y + 14, M + 16, y + 30], fill=RED)
    d.text((M + 40, y), head, font=BOLD(44), fill=WHITE)
    d.text((M + 40, y + 62), sub, font=REG(32), fill=GREY)
    y += 150

d.text((M, 1200), "最后按「人少 + 出片」给了排序", font=REG(36), fill=GREY)
footer(d)
img.save(os.path.join(OUT, "card3.png"))

# ---------- 4 安装 ----------
img, d = canvas((W - 700, 60, W + 200, 760))
pill(d, (M, 150), "一行装好", REG(38))
d.text((M, 250), "不用注册", font=BOLD(96), fill=WHITE)
d.text((M, 368), "不用 API Key", font=BOLD(96), fill=RED)

d.text((M, 520), "Windows · PowerShell（Node 22+）", font=REG(34), fill=GREY)
y = 580
d.rounded_rectangle([M - 24, y - 26, W - M + 24, y + 150], radius=22, fill=(30, 24, 38), outline=(70, 58, 84), width=2)
for line in ["irm https://raw.githubusercontent.com/", "  talos1899/xhs-dots/main/install.ps1 | iex"]:
    d.text((M, y), line, font=MONO(29), fill=(150, 240, 190))
    y += 52

d.text((M, 780), "macOS / Linux", font=REG(34), fill=GREY)
d.rounded_rectangle([M - 24, 832, W - M + 24, 952], radius=22, fill=(30, 24, 38), outline=(70, 58, 84), width=2)
d.text((M, 860), "curl -fsSL .../install.sh | bash", font=MONO(29), fill=(150, 240, 190))

d.text((M, 1010), "装完对 AI 说一句：", font=REG(36), fill=GREY)
d.text((M, 1072), "「用 xhs-dots 查最近一个月的防晒趋势」", font=BOLD(38), fill=WHITE)
d.text((M, 1140), "它就会自己开浏览器去翻笔记", font=REG(34), fill=GREY)
footer(d)
img.save(os.path.join(OUT, "card4.png"))

print("ok")
