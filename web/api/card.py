# The link preview of a record, 1200 x 630 (Gaylord's layout, 2026-10-18): the track's stage art with a TV pass, the logo,
# a boomer waving on one side asking "CAN YOU BEAT <score> PTS?" in a speech balloon on the other, Powered by Miden in the
# corner. Boomer and side come from the record id, so a record keeps its card. Query: t (track id), s (score), r (record id).
import os, sys
from http.server import BaseHTTPRequestHandler
from io import BytesIO
from urllib.parse import parse_qs, urlparse
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps

sys.path.insert(0, os.getcwd())
from og.tracks import score as parse_score, track

OG = os.path.join(os.getcwd(), "og")
INK, PINK, BLACK, WHITE = (8, 12, 36, 255), (226, 60, 120, 255), (0, 0, 0, 255), (255, 255, 255, 255)
FONT = lambda size: ImageFont.truetype(os.path.join(OG, "PUB-Painted-Pixel.ttf"), size)
# the pixel font has no "?" and no ",": both drawn on its grid (a cap is 7 cells tall)
QM = [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."]
COMMA = [".", ".", ".", ".", ".", ".", "#", "#"]
SHEETS = {"a": "passengers.webp", "b": "passengers-b.webp", "c": "passengers-c.webp"}  # 48 characters, 16 a sheet, by atlasIndex


def cell_of(d, f):
    b = d.textbbox((0, 0), "C", font=f)
    return (b[3] - b[1]) / 7, b[1]


def pix(d, x, y, f, rows, fill):
    c, top = cell_of(d, f)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == "#":
                d.rectangle([x + i * c, y + top + j * c, x + (i + 1) * c - 0.5, y + top + (j + 1) * c - 0.5], fill=fill)


def figure(n):
    """Character n (0..47) waving, cut out of its sheet."""
    sheet = Image.open(os.path.join(OG, SHEETS["abc"[n // 16]])).convert("RGBA")
    i, cw, ch = n % 16, sheet.width // 4, sheet.height // 4
    cell = sheet.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
    return cell.crop(cell.getbbox())


def background(stage):
    """The stage art five times up, cropped to the card, faded at the bottom."""
    big = Image.open(os.path.join(OG, f"{stage}.png")).convert("RGBA").resize((1280, 960), Image.LANCZOS)
    card = big.crop((40, 150, 1240, 780))
    scrim = Image.new("RGBA", card.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(scrim)
    for y in range(330, 630):
        d.line([(0, y), (1200, y)], fill=(8, 6, 24, int(210 * ((y - 330) / 300) ** 1.3)))
    card.alpha_composite(scrim)
    return card


def tv(card):
    """The TV pass over the finished card: a soft bloom, a scanline every third row, a vignette toward the edges."""
    bloom = card.filter(ImageFilter.GaussianBlur(6))
    card = Image.blend(card, ImageChops.lighter(card, bloom), 0.35)
    scan = Image.new("L", card.size, 255)
    d = ImageDraw.Draw(scan)
    for y in range(0, card.height, 3):
        d.line([(0, y), (card.width, y)], fill=200)
    card = Image.composite(card, Image.new("RGBA", card.size, (0, 0, 0, 255)), scan)
    v = Image.new("L", (300, 158), 0)
    ImageDraw.Draw(v).ellipse([-40, -30, 340, 188], fill=255)
    v = v.resize(card.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(70))
    return Image.composite(card, Image.new("RGBA", card.size, (4, 4, 14, 255)), v.point(lambda p: 120 + p * 135 // 255))


def draw(stage, score, boomer, side):
    """The card as RGB. `score` None asks "CAN YOU BEAT MY SCORE?"."""
    c = background(stage)
    logo = Image.open(os.path.join(OG, "logo.png")).convert("RGBA")
    logo = logo.resize((442, round(logo.height * 442 / logo.width)), Image.LANCZOS)
    c.alpha_composite(logo, ((1200 - 442) // 2, 42))
    fig = figure(boomer)
    fig = fig.resize((round(fig.width * 358 / fig.height), 358), Image.LANCZOS)
    if side == "right":
        fig = ImageOps.mirror(fig)  # faces the balloon
    fx = 176 if side == "left" else 1200 - 176 - fig.width
    c.alpha_composite(fig, (fx, 600 - 358))
    d = ImageDraw.Draw(c)
    s1, s2, s3, pad = 42, 76, 38, 42
    f1, f2, f3 = FONT(s1), FONT(s2), FONT(s3)
    l1 = "CAN YOU BEAT"
    parts, l3 = (f"{score:,}".split(","), "PTS") if score is not None else (["MY SCORE"], "")
    c2 = cell_of(d, f2)[0]
    w1 = d.textlength(l1, f1)
    w2 = sum(d.textlength(t, f2) for t in parts) + (len(parts) - 1) * 2.4 * c2
    w2 += 24 + d.textlength(l3, f3) + 2 * cell_of(d, f3)[0] if l3 else 0.6 * c2 + 5 * c2
    W = int(max(w1, w2)) + 2 * pad
    H = int(s1 * 0.85 + s2 * 1.35 + 2 * pad * 0.8)
    X = 566 if side == "left" else 1200 - 566 - W
    Y = 211
    # the tail: from the balloon's edge facing the boomer, 55 % of the way to the head
    head = (fx + (0.7 if side == "left" else 0.3) * fig.width, 600 - 358 + 36)
    bx = X + 8 if side == "left" else X + W - 8
    by = Y + 92
    tip = (bx + 0.55 * (head[0] - bx), by + 0.55 * (head[1] - by))
    d.polygon([tip, (bx, by - 30), (bx, by + 30)], fill=BLACK)
    d.rounded_rectangle([X, Y, X + W, Y + H], radius=26, fill=BLACK)
    d.rounded_rectangle([X + 6, Y + 6, X + W - 6, Y + H - 6], radius=20, fill=WHITE)
    k = 1 if side == "left" else -1
    d.polygon([(tip[0] + 12 * k, tip[1] + 2), (bx + 4 * k, by - 19), (bx + 4 * k, by + 19)], fill=WHITE)
    y1 = Y + pad * 0.8
    d.text((X + (W - w1) / 2, y1), l1, font=f1, fill=INK)
    x = X + (W - w2) / 2
    y2 = y1 + s1 * 1.35
    for i, t in enumerate(parts):
        if i:
            pix(d, x + 0.7 * c2, y2, f2, COMMA, PINK)
            x += 2.4 * c2
        d.text((x, y2), t, font=f2, fill=PINK)
        x += d.textlength(t, f2)
    if l3:
        x += 24
        y3 = y2 + (s2 - s3) * 0.95
        d.text((x, y3), l3, font=f3, fill=INK)
        pix(d, x + d.textlength(l3, f3) + 0.6 * cell_of(d, f3)[0], y3, f3, QM, INK)
    else:
        pix(d, x + 0.6 * c2, y2, f2, QM, PINK)
    badge = Image.open(os.path.join(OG, "powered-by-miden.png")).convert("RGBA")
    badge = badge.resize((226, round(badge.height * 226 / badge.width)), Image.LANCZOS)
    badge.putalpha(badge.getchannel("A").point(lambda v: round(v * 0.70)))
    c.alpha_composite(badge, (1200 - 25 - 226 if side == "left" else 25, 630 - 25 - badge.height))
    return tv(c).convert("RGB")


def card(t, s, r):
    """The JPEG bytes for a link's query values."""
    _, _, stage = track(t)
    h = sum(ord(ch) for ch in (r or ""))
    out = BytesIO()
    draw(stage, parse_score(s), h % 48, "left" if (h // 48) % 2 == 0 else "right").save(out, "JPEG", quality=88)
    return out.getvalue()


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        body = card(q.get("t", [None])[0], q.get("s", [None])[0], q.get("r", [""])[0])
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Cache-Control", "public, max-age=86400, s-maxage=31536000, immutable")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
