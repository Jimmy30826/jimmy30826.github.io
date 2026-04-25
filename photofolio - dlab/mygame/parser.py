import csv
import json

# 1. 회사 정보 로드
companies = {}
with open('ekidata/company20251015.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        companies[row['company_cd']] = row['company_name']

# 2. 노선 정보 로드
lines = {}
with open('ekidata/line20260323free.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        lines[row['line_cd']] = {
            'name': row['line_name'],
            'company_cd': row['company_cd'],
            'color': row['line_color_c']
        }

def get_region(pref_cd):
    p = int(pref_cd)
    if p == 1: return "北海道"
    elif 2 <= p <= 7: return "東北"
    elif 8 <= p <= 14: return "関東"
    elif 15 <= p <= 20: return "甲信越"
    elif 21 <= p <= 24: return "東海"
    elif 25 <= p <= 30: return "関西"
    elif 31 <= p <= 35: return "山陽・山陰"
    elif 36 <= p <= 39: return "四国"
    elif 40 <= p <= 47: return "九州"
    return "全国"

def map_company(company_name):
    c = company_name
    # [일본어 명칭 통일 작업]
    if "JR北海道" in c: return "JR北海道"
    if "JR東日本" in c: return "JR東日本"
    if "JR東海" in c: return "JR東海"
    if "JR西日本" in c: return "JR西日本"
    if "JR四国" in c: return "JR四国"
    if "JR九州" in c: return "JR九州"
    if "東武" in c: return "東武"
    if "西武" in c: return "西武"
    if "京成" in c: return "京成"
    if "京王" in c: return "京王"
    if "小田急" in c: return "小田急"
    if "東急" in c: return "東急"
    if "京急" in c: return "京急"
    if "相模" in c or "相鉄" in c: return "相鉄"
    if "東京地下鉄" in c or "東京メトロ" in c: return "東京メトロ"
    if "名古屋鉄道" in c: return "名鉄"
    if "近畿日本" in c: return "近鉄"
    if "南海" in c: return "南海"
    if "京阪" in c: return "京阪"
    if "阪急" in c: return "阪急"
    if "阪神" in c: return "阪신" or "阪神"
    if "西日本鉄道" in c: return "西鉄"
    return company_name

# 3. 역 데이터 파싱
stations = []
with open('ekidata/station20260206free.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        if row['e_status'] == '2': continue
        line_cd = row['line_cd']
        if line_cd not in lines: continue
        
        line_info = lines[line_cd]
        comp_name = companies.get(line_info['company_cd'], '')
        
        stations.append({
            'gid': row['station_g_cd'],
            'sid': row['station_cd'],
            'kanji': row['station_name'],
            'kana': row['station_name_k'],
            'region': get_region(row['pref_cd']),
            'company': map_company(comp_name),
            'line_cd': line_cd,
            'line_name': line_info['name'],
            'color': line_info['color'] if line_info['color'] else '#555555',
            'lat': float(row['lat']),
            'lon': float(row['lon'])
        })

# 4. 역 통합 (line_cd 기반 정밀 정보 저장)
unique_stations = {}
for st in stations:
    gid = st['gid']
    if gid not in unique_stations:
        unique_stations[gid] = {
            'id': gid,
            'kanji': st['kanji'],
            'kana': st['kana'],
            'region': st['region'],
            'lat': st['lat'],
            'lon': st['lon'],
            'company': [st['company']],
            # [16차 핵심] line_cd를 키로 사용 (중복 이름 방지)
            'line_info': {st['line_cd']: {'name': st['line_name'], 'sid': st['sid']}},
            'color': st['color']
        }
    else:
        if st['company'] not in unique_stations[gid]['company']:
            unique_stations[gid]['company'].append(st['company'])
        unique_stations[gid]['line_info'][st['line_cd']] = {'name': st['line_name'], 'sid': st['sid']}

final_stations = list(unique_stations.values())

# 5. JS 파일로 저장
js_content = f"const stationsData = {json.dumps(final_stations, ensure_ascii=False, indent=4)};"
with open('stations.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Generated {len(final_stations)} stations with Unique ID and Unified Japanese naming.")
