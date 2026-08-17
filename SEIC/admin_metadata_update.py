#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GitHub Actions에서 관리자 메타데이터를 안전하게 반영하는 도우미 스크립트.

- workflow_dispatch 입력값 metadata_json 문자열을 파싱
- SEIC/elevators_meta.json 병합 저장
- 기존 JSON 구조를 보존하면서 관리자 수정 내용만 반영
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
META_PATH = ROOT / "SEIC" / "elevators_meta.json"


def load_json(path: Path, default=None):
    if default is None:
        default = {}
    if not path.exists():
        return default
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path: Path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


def main():
    raw = os.environ.get("METADATA_JSON", "")
    if not raw.strip():
        raise SystemExit("METADATA_JSON is empty")

    try:
        incoming = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid metadata_json: {exc}")

    if not isinstance(incoming, dict):
        raise SystemExit("metadata_json must be a JSON object")

    current = load_json(META_PATH, {})
    if not isinstance(current, dict):
        current = {}

    merged = dict(current)
    for serial, value in incoming.items():
        if not isinstance(value, dict):
            continue
        merged[serial] = {**merged.get(serial, {}), **value}

    save_json(META_PATH, merged)
    print(f"Updated metadata entries: {len(incoming)} -> total {len(merged)}")


if __name__ == "__main__":
    main()
