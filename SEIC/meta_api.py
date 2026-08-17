#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEIC - 관리자 메타데이터 영구 저장용 로컬 API

- /api/meta GET: 현재 메타데이터 JSON 반환
- /api/meta POST: 전달된 metadata를 elevators_meta.json 에 영구 저장
- 정적 파일 서빙도 함께 지원하여, 브라우저에서 index.html 열기처럼 사용 가능
"""

import json
import os
from datetime import datetime
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
META_PATH = os.path.join(SCRIPT_DIR, "elevators_meta.json")
PORT = 8000


def load_json_file(file_path):
    if not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_json_file(file_path, data):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


class SEICRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/meta":
            self.handle_meta_get()
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/meta":
            self.handle_meta_post()
            return
        self.send_error(404, "Not Found")

    def handle_meta_get(self):
        payload = load_json_file(META_PATH)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def handle_meta_post(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            payload = {}

        if not isinstance(payload, dict) or not isinstance(payload.get("metadata"), dict):
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": "metadata object required"}, ensure_ascii=False).encode("utf-8"))
            return

        existing = load_json_file(META_PATH)
        merged = {**existing, **payload["metadata"]}
        save_json_file(META_PATH, merged)

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps({
            "ok": True,
            "updated": len(payload["metadata"]),
            "total": len(merged),
            "saved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }, ensure_ascii=False).encode("utf-8"))

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")


if __name__ == "__main__":
    os.chdir(SCRIPT_DIR)
    print(f"SEIC meta API 서버 실행 중: http://localhost:{PORT}")
    print(f"메타데이터 파일 경로: {META_PATH}")
    ThreadingHTTPServer(("0.0.0.0", PORT), SEICRequestHandler).serve_forever()
