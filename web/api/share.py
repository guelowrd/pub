# A record link (/r?record=…&t=…&s=…, rewritten here by vercel.json): the game's page with the preview tags set to that record's
# card, so X, Telegram and the rest show the boomer's question instead of the generic card. Everything else in the page is untouched.
# The link has its own path because Vercel serves the static page for / before any rewrite, whatever the query.
import os, re, sys, urllib.request
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlencode, urlparse

sys.path.insert(0, os.getcwd())
from og.tracks import score as parse_score, track


def rewrite(html, origin, record, t, s):
    tid, title, _ = track(t)
    score = parse_score(s)
    url = f"{origin}/r?{urlencode({'record': record, 't': tid, 's': score if score is not None else ''})}"
    image = f"{origin}/api/card?{urlencode({'t': tid, 's': score if score is not None else '', 'r': record})}"
    heading = f"Can you beat {score:,} pts on {title}?" if score is not None else f"Can you beat my score on {title}?"
    alt = f"A boomer waving on {title}, asking: {heading}"
    tags = {"og:url": url, "og:image": image, "twitter:image": image, "og:title": heading, "twitter:title": heading, "og:image:alt": alt, "twitter:image:alt": alt}
    for key, value in tags.items():
        html = re.sub(rf'(<meta (?:property|name)="{re.escape(key)}" content=")[^"]*(")', lambda m: m.group(1) + value.replace("&", "&amp;").replace('"', "&quot;") + m.group(2), html)
    return html


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        host = self.headers.get("x-forwarded-host") or self.headers.get("host")
        origin = f"https://{host}"
        record, t, s = q.get("record", [""])[0], q.get("t", [None])[0], q.get("s", [None])[0]
        try:
            with urllib.request.urlopen(f"{origin}/", timeout=5) as r:  # the built page, served static
                html = r.read().decode("utf-8")
        except Exception:
            self.send_response(302)  # the page without its preview rather than nothing
            self.send_header("Location", f"/?{urlencode({'record': record})}")
            self.end_headers()
            return
        body = rewrite(html, origin, record, t, s).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=0, s-maxage=86400")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
