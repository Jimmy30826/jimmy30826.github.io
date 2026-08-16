#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SEIC - 서버승강기정보센터 API 주기적 동기화 스크립트
주기: 6시간 단위 (Cron 또는 GitHub Actions 연동)
기능:
  1. https://mcsapi.kn4u.net/evapi 에서 최신 승강기 목록 조회
  2. 기존 elevators_meta.json 내용을 보존하면서, 새롭게 추가된 승강기 고유번호만 템플릿으로 추가
  3. evdata_cache.json에 최신 원본 데이터 및 동기화 타임스탬프 캐싱
"""

import os
import sys
import json
import urllib.request
from datetime import datetime

API_URL = "https://mcsapi.kn4u.net/evapi"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
META_PATH = os.path.join(SCRIPT_DIR, "elevators_meta.json")
CACHE_PATH = os.path.join(SCRIPT_DIR, "evdata_cache.json")


def fetch_api_data():
    """API 엔드포인트에서 최신 JSON 데이터를 가져옵니다."""
    req = urllib.request.Request(
        API_URL,
        headers={"User-Agent": "SEIC-SyncBot/1.0 (+https://jimmy30826.github.io/SEIC/)"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_json_file(file_path):
    """JSON 파일을 불러옵니다. 파일이 없으면 빈 딕셔너리를 반환합니다."""
    if not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[경고] {file_path} 로드 실패: {e}", file=sys.stderr)
        return {}


def save_json_file(file_path, data):
    """JSON 데이터를 4칸 들여쓰기로 저장합니다."""
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


def sync_elevators():
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now_str}] SEIC 승강기 API 6시간 주기 동기화 시작...")

    # 1. API 데이터 조회
    try:
        api_data = fetch_api_data()
        print(f"  -> API 데이터 수신 성공 (URL: {API_URL})")
    except Exception as e:
        print(f"  -> [오류] API 호출 실패: {e}", file=sys.stderr)
        return False

    # 2. 고유번호 목록 추출
    api_serials = api_data.get("serial", [])
    if not api_serials:
        api_serials = [k for k in api_data.keys() if k != "serial"]

    print(f"  -> API 등록 승강기 수: {len(api_serials)}대")

    # 3. 기존 메타데이터 로드
    existing_meta = load_json_file(META_PATH)
    initial_meta_count = len(existing_meta)
    new_added_count = 0

    # 4. 신규 승강기만 추가 (기존 수기 작성 내용은 절대 덮어쓰지 않음)
    for serial in api_serials:
        if serial not in existing_meta:
            ev_info = api_data.get(serial, {})
            ev_id = ev_info.get("id", "알수없음")
            is_test = str(serial).endswith("-99")

            default_name = f"서버 승강기 {ev_id}호기 (신규)"
            default_type = "시험운행 / 테스트용" if is_test else "승객용 / 일반"

            existing_meta[serial] = {
                "name": default_name,
                "building": "미지정 (수기입력 필요)",
                "manager": "미지정 (수기입력 필요)",
                "type": default_type
            }
            new_added_count += 1
            print(f"  [신규 발견] {serial} (ID: {ev_id}) -> 메타데이터 템플릿 추가 완료")

    # 5. 메타데이터 파일 저장 (신규 승강기가 추가된 경우에만 갱신)
    if new_added_count > 0:
        save_json_file(META_PATH, existing_meta)
        print(f"  -> {META_PATH} 갱신 완료 (신규 {new_added_count}건 추가, 총 {len(existing_meta)}건)")
    else:
        print(f"  -> 메타데이터 변경 없음 (기존 {initial_meta_count}건 유지)")

    # 6. 캐시 파일 갱신
    cache_payload = {
        "last_synced": now_str,
        "sync_interval_hours": 6,
        "total_count": len(api_serials),
        "data": api_data
    }
    save_json_file(CACHE_PATH, cache_payload)
    print(f"  -> {CACHE_PATH} 캐시 저장 완료")
    print(f"[{now_str}] 동기화 작업 성공적으로 완료되었습니다.\n")
    return True


if __name__ == "__main__":
    sync_elevators()
