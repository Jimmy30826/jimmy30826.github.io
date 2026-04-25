import json

with open('stations.js', 'r', encoding='utf-8') as f:
    content = f.read()
    json_str = content.replace('const stationsData = ', '').rstrip(';')
    data = json.loads(json_str)

key_stations = ['札幌', '東京', '大阪', '博多']
found = {}
for st in data:
    if st['kanji'] in key_stations:
        found[st['kanji']] = (st['x'], st['y'])

for name in key_stations:
    if name in found:
        print(f"{name}: {found[name]}")
    else:
        print(f"{name}: NOT FOUND")
