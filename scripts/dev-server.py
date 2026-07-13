#!/usr/bin/env python3
"""Local static server with SPA fallback for History API routes."""

from __future__ import annotations

import argparse
import http.server
import os
import socketserver
from functools import partial

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

STATIC_EXTENSIONS = {
    ".css",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".map",
    ".mp4",
    ".png",
    ".svg",
    ".txt",
    ".webm",
    ".webp",
    ".woff",
    ".woff2",
}


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory or ROOT, **kwargs)

    def end_headers(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        _, ext = os.path.splitext(path)
        if ext.lower() in {".json", ".js", ".css", ".html"}:
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        fs_path = self.translate_path(path)

        if os.path.isdir(fs_path):
            index_path = os.path.join(fs_path, "index.html")
            if not os.path.isfile(index_path):
                return self._serve_index()
            return super().do_GET()

        if not os.path.isfile(fs_path) and self._should_fallback(path):
            return self._serve_index()

        return super().do_GET()

    def _should_fallback(self, path: str) -> bool:
        _, ext = os.path.splitext(path)
        return ext.lower() not in STATIC_EXTENSIONS

    def _serve_index(self):
        self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format: str, *args):
        if args and str(args[-1]) == "200":
            return
        super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser(description="Serve the Icross site with SPA routing.")
    parser.add_argument("port", nargs="?", type=int, default=8765)
    args = parser.parse_args()

    handler = partial(SPARequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", args.port), handler) as httpd:
        print(f"Serving {ROOT}")
        print(f"Open http://localhost:{args.port}/")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()
