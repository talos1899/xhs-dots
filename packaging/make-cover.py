# 生成小红书封面图 1080x1440
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1440

# 背景：竖向渐变
top = (18, 14, 24)
bottom = (40, 26, 52)
bg = Image.new("RGB", (W, H), top)
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / (H - 1)
    c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    d.line([(0, y), (W, y)], fill=c)

# 右上角红色光晕
glow = Image.new("RGB", (W, H), (0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([W - 520, -420, W + 320, 420], fill=(255, 46, 77))
glow = glow.filter(ImageFilter.GaussianBlur(180))
bg = Image.blend(bg, Image.composite(glow, bg, glow.convert("L")), 0.55)
d = ImageDraw.Draw(bg)

FONT_DIR = r"C:\Windows\Fonts"
def font(name, size):
    for f in ([name] if isinstance(name, str) else name):
        p = os.path.join(FONT_DIR, f)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise SystemExit("字体缺失: " + str(name))

f_label = font(["msyh.ttc", "msyhbd.ttc"], 40)
f_title = font(["msyhbd.ttc", "msyh.ttc"], 148)
f_sub = font(["msyh.ttc"], 42)
f_foot = font(["consola.ttf", "msyh.ttc"], 34)

MARGIN = 96
WHITE = (255, 255, 255)
GREY = (196, 186, 210)
RED = (255, 74, 100)

# 顶部标签
label = "AI  ×  小红书"
d.rounded_rectangle([MARGIN, 120, MARGIN + 330, 200], radius=40, fill=(255, 255, 255, 0), outline=RED, width=3)
d.text((MARGIN + 34, 136), label, font=f_label, fill=RED)

# 主标题
y = 330
for line in ["让 AI", "自己去查", "小红书"]:
    d.text((MARGIN, y), line, font=f_title, fill=WHITE)
    y += 190

# 分隔线
d.line([(MARGIN, y + 40), (MARGIN + 240, y + 40)], fill=RED, width=6)

# 副标题
subs = ["CDP 驱动本机已登录浏览器", "点点 AI 检索几十条真实笔记", "只读 · 限速 · 不碰账号"]
y += 100
for s in subs:
    d.text((MARGIN, y), s, font=f_sub, fill=GREY)
    y += 68

# 底部
d.text((MARGIN, H - 150), "xhs-dots  ·  open source", font=f_foot, fill=(140, 130, 155))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cover.png")
bg.save(out, "PNG")
print(out, bg.size)
