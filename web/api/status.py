# The testnet monitor's word per service (status.testnet.miden.io serves HTML without CORS, so the game asks here).
import json
import re
import urllib.request
from http.server import BaseHTTPRequestHandler

MONITOR = "https://status.testnet.miden.io/fragments/status"
CARD = re.compile(r'class="service-name">([^<]+)</div>\s*<div class="service-status[^"]*?\b(unhealthy|healthy)\b')


def read(html):
    # "Remote Prover (1)" -> "remote prover"
    return {re.sub(r"\s*\(.*\)", "", name).strip().lower(): state for name, state in CARD.findall(html)}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            with urllib.request.urlopen(MONITOR, timeout=8) as r:
                out, code = read(r.read().decode()), 200
        except Exception as e:  # the monitor itself is down: the game says UNKNOWN
            out, code = {}, 502
        body = json.dumps(out).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "public, max-age=0, s-maxage=30")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":  # python3 api/status.py: the parser against the live monitor
    html = urllib.request.urlopen(MONITOR, timeout=8).read().decode()
    got = read(html)
    assert {"rpc", "remote prover", "faucet", "local transactions"} <= set(got), got
    assert set(got.values()) <= {"healthy", "unhealthy"}, got
    print(got)
