import struct, zlib, math

W, H = 1280, 800  # 16:10, sharp enough for the card crop
CX = W // 2

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

CREAM   = (250, 241, 220)
WALL    = (243, 226, 205)
TILEBG  = (239, 224, 200)
WOOD    = (217, 160, 102)
WOODD   = (184, 123, 67)
TILES   = [(247, 209, 207), (216, 234, 208), (228, 222, 242), (252, 233, 204)]
YELLOW  = (255, 214, 107)
YELLOWD = (233, 166, 58)
MINT    = (143, 206, 158)
MINTD   = (95, 174, 141)
WHITE   = (255, 255, 255)
INK     = (74, 53, 36)
BLUSH   = (246, 166, 178)
NIGHT   = (51, 41, 90)
GLOW    = (255, 233, 168)
LAV     = (199, 184, 232)
LAVD    = (143, 116, 201)

buf = [[[0, 0, 0] for _ in range(W)] for _ in range(H)]

def px(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        buf[y][x][0], buf[y][x][1], buf[y][x][2] = c

def rrect(x0, y0, x1, y1, r, fill, border=None, bw=5):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx = max(x0 + r - x, x - (x1 - r), 0)
            dy = max(y0 + r - y, y - (y1 - r), 0)
            if dx * dx + dy * dy <= r * r:
                px(x, y, fill)
    if border:
        for y in range(y0 - bw, y1 + bw + 1):
            for x in range(x0 - bw, x1 + bw + 1):
                dx = max(x0 + r - x, x - (x1 - r), 0)
                dy = max(y0 + r - y, y - (y1 - r), 0)
                d = dx * dx + dy * dy
                if r * r <= d <= (r + bw) ** 2 or (y0 - bw <= y <= y0 and x0 <= x <= x1) or (y1 <= y <= y1 + bw and x0 <= x <= x1) or (x0 - bw <= x <= x0 and y0 <= y <= y1) or (x1 <= x <= x1 + bw and y0 <= y <= y1):
                    if d <= (r + bw) ** 2 and (dx > r or dy > r or y < y0 or y > y1 or x < x0 or x > x1):
                        px(x, y, border)

def circle(cx, cy, r, fill):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px(x, y, fill)

def ellipse(cx, cy, rx, ry, fill, rot=0.0):
    for y in range(int(cy - ry * 1.6), int(cy + ry * 1.6) + 1):
        for x in range(int(cx - rx * 1.6), int(cx + rx * 1.6) + 1):
            dx, dy = x - cx, y - cy
            if rot:
                xr = dx * math.cos(rot) + dy * math.sin(rot)
                yr = -dx * math.sin(rot) + dy * math.cos(rot)
                dx, dy = xr, yr
            if (dx / rx) ** 2 + (dy / ry) ** 2 <= 1:
                px(x, y, fill)

# ---------------- background ----------------
# wall
for y in range(0, 560):
    for x in range(W):
        px(x, y, WALL)
# faint tile lines
for gx in range(0, W, 96):
    for y in range(0, 560):
        px(gx, y, (235, 214, 184))
for gy in range(0, 560, 96):
    for x in range(W):
        px(x, gy, (235, 214, 184))
# cupboard
rrect(60, 40, 400, 470, 26, WOOD, border=WOODD, bw=4)
rrect(84, 66, 236, 250, 14, (232, 196, 140))
rrect(252, 66, 376, 250, 14, (232, 196, 140))
rrect(84, 272, 376, 444, 14, (232, 196, 140))
# window: night sky with stars, right of center
rrect(760, 60, 1210, 430, 24, LAV, border=LAVD, bw=5)
sky = rrect(784, 84, 1186, 406, 16, NIGHT)
import random
random.seed(7)
for _ in range(34):
    sx = random.randint(800, 1170); sy = random.randint(96, 250)
    s = random.choice([2, 2, 3])
    for dy in range(s):
        for dx in range(s):
            px(sx + dx, sy + dy, (255, 248, 224))
# moon
circle(1105, 150, 30, (255, 243, 196))
# window cross
for y in range(84, 407):
    px(985, y, LAV); px(984, y, LAV)
for x in range(784, 1187):
    px(x, 245, LAV)
# shelf right under window
rrect(720, 470, 1250, 494, 8, WOODD, border=None)
# jars on shelf
for i, col in enumerate([(224, 125, 139), (95, 174, 141), (155, 116, 210), (201, 138, 75), (233, 166, 58)]):
    rrect(750 + i * 100, 424, 792 + i * 100, 470, 8, col)
    rrect(747 + i * 100, 416, 795 + i * 100, 428, 5, WHITE)
# counter band with pastel tiles
for y in range(560, H):
    for x in range(W):
        px(x, y, TILEBG)
for i in range(0, W // 96 + 1):
    col = TILES[i % 4]
    rrect(i * 96 + 6, 570, i * 96 + 90, 654, 10, col)
for x in range(W):
    px(x, 560, WOODD)
    px(x, 561, WOODD)
# counter wood below tiles
for y in range(660, H):
    for x in range(W):
        px(x, y, WOOD)
for x in range(W):
    px(x, 660, (232, 181, 117))

# ---------------- Ghee ----------------
GX, GY = 330, 640      # feet position on the tile band
BW, BH = 240, 250      # body
# glow
for y in range(GY - BH - 120, GY + 30):
    for x in range(GX - 300, GX + 300):
        d = math.hypot(x - GX, y - (GY - BH // 2))
        if d < 200:
            t = 1 - d / 200
            if t > 0:
                c = px and None
                mix = tuple(int(GLOW[i] * t * 0.35 + buf[y][x][i] * (1 - t * 0.35)) for i in range(3))
                buf[y][x][0], buf[y][x][1], buf[y][x][2] = mix
# feet
ellipse(GX - 52, GY - 10, 42, 24, YELLOWD)
ellipse(GX + 52, GY - 10, 42, 24, YELLOWD)
# body
ellipse(GX, GY - 140, 148, 140, YELLOW)
# arms (small, attached to body sides, angled up)
for sx in (-1, 1):
    for t in range(70):
        t2 = t / 69
        bx = GX + sx * (140 - t2 * 46)
        by = GY - 150 - t2 * 86
        for w in range(16):
            px(int(bx) + w - 8, int(by), YELLOW)
            px(int(bx) + w - 8, int(by) - 1, YELLOW)
# leaf cap
ellipse(GX + 30, GY - 300, 78, 40, MINT, rot=0.35)
for t in range(100):
    t2 = t / 99
    px(int(GX - 30 + t2 * 90), int(GY - 306 + t2 * 16), (78, 122, 91))
# eyes
ellipse(GX - 46, GY - 195, 22, 30, INK)
ellipse(GX + 50, GY - 195, 22, 30, INK)
# eye shine
circle(GX - 52, GY - 208, 7, WHITE)
circle(GX + 44, GY - 208, 7, WHITE)
# blush
ellipse(GX - 88, GY - 140, 28, 17, BLUSH)
ellipse(GX + 92, GY - 140, 28, 17, BLUSH)
# smile: filled half-disc (open happy mouth)
MX, MY = GX, GY - 118
for y in range(MY, MY + 62):
    for x in range(MX - 34, MX + 34):
        if (x - MX) ** 2 + (y - MY) ** 2 <= 34 ** 2 and (x - MX) ** 2 + (y - MY) ** 2 >= 11 ** 2:
            px(x, y, INK)
        elif (x - MX) ** 2 + (y - MY) ** 2 < 26 ** 2:
            px(x, y, (189, 77, 92))   # tongue range near bottom
circle(MX, MY + 34, 13, (189, 77, 92))
# glowing wick mark
ellipse(GX, GY - 92, 16, 22, GLOW)
circle(GX, GY - 96, 9, WHITE)

# ---------------- lantern ----------------
LX, LY = 900, 660
# glow around lantern
for y in range(LY - 280, LY + 40):
    for x in range(LX - 200, LX + 200):
        d = math.hypot((x - LX) / 1.6, (y - (LY - 120)) / 2.6) if False else math.hypot(x - LX, y - (LY - 130))
        if d < 190:
            t = 1 - d / 190
            if t > 0:
                mix = tuple(int(GLOW[i] * t * 0.5 + buf[y][x][i] * (1 - t * 0.5)) for i in range(3))
                buf[y][x][0], buf[y][x][1], buf[y][x][2] = mix
# handle
rrect(LX - 34, LY - 300, LX + 34, LY - 258, 14, LAVD)
# body
rrect(LX - 68, LY - 262, LX + 68, LY - 84, 18, (174, 191, 201), border=(143, 161, 171), bw=4)
rrect(LX - 50, LY - 244, LX + 50, LY - 104, 12, (127, 163, 184))
# base
rrect(LX - 78, LY - 92, LX + 78, LY - 52, 12, (174, 191, 201))
# flame: clean teardrop over the wick post
FY = LY - 160
for y in range(FY - 60, FY + 42):
    for x in range(LX - 40, LX + 40):
        t = (y - (FY - 60)) / 102.0
        halfw = max(0.0, math.sin(t * math.pi) * 30 * (1 - t * 0.45) if t < 0.72 else 0)
        if abs(x - LX) < halfw:
            d = math.hypot((x - LX) / 1.4, (y - FY) / 2.2)
            col = WHITE if d < 9 else (YELLOW if d < 19 else GLOW)
            px(x, y, col)

# ---------------- sparkles ----------------
random.seed(3)
for _ in range(20):
    sx = random.randint(40, W - 40); sy = random.randint(60, 540)
    s = random.choice([3, 4])
    for d in range(-s, s + 1):
        px(sx + d, sy, GLOW); px(sx, sy + d, GLOW)

# ---------------- wordmark ----------------
GLYPH = {}
GLYPH_DATA = {
 'W': ["10001","10001","10001","10101","10101","11011","10001"],
 'H': ["10001","10001","10001","11111","10001","10001","10001"],
 'I': ["11111","00100","00100","00100","00100","00100","11111"],
 'M': ["10001","11011","10101","10101","10001","10001","10001"],
 'S': ["01111","10000","10000","01110","00001","00001","11110"],
 'Y': ["10001","01010","00100","00100","00100","00100","00100"],
 'C': ["01110","10001","10000","10000","10000","10001","01110"],
 'K': ["10001","10010","10100","11000","10100","10010","10001"],
 ' ': ["00000","00000","00000","00000","00000","00000","00000"],
}
PS = 9
def draw_text(text, ox, oy, color, shadow=None):
    x = ox
    for ch in text:
        g = GLYPH_DATA[ch]
        for r, row in enumerate(g):
            for c2, v in enumerate(row):
                if v == '1':
                    bx, by = x + c2 * PS, oy + r * PS
                    if shadow:
                        for s in range(5):
                            for t in range(5):
                                px(bx + s, by + t, shadow)
                    for s in range(PS - 2):
                        for t in range(PS - 2):
                            px(bx + s, by + t, color)
                            px(bx + s + 1, by + t, color)
        x += 6 * PS

# banner
rrect(240, 120, 1040, 280, 34, WHITE, border=None)
# title text centered
TEXT = "WHIMSY WICK"
tw = len(TEXT) * 6 * PS
draw_text(TEXT, (W - tw) // 2, 158, INK, shadow=(233, 166, 58))

# ---------------- write PNG ----------------
raw = b''
for y in range(H):
    raw += b'\x00' + b''.join(bytes(buf[y][x]) for x in range(W))
def chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(raw, 9))
png += chunk(b'IEND', b'')
open('cover.png', 'wb').write(png)
print('cover.png written:', len(png), 'bytes')
