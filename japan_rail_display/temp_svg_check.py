import re
from pathlib import Path
from xml.etree import ElementTree as ET

p = Path('japan_map_clean.svg')
text = p.read_text(encoding='utf-8')
root = ET.fromstring(text)
print('viewBox:', root.attrib.get('viewBox'))
coords = []
for elem in root.iter():
    tag = elem.tag.split('}')[-1]
    if tag == 'path' and 'd' in elem.attrib:
        nums = re.findall(r'[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?', elem.attrib['d'])
        coords.extend([(float(nums[i]), float(nums[i+1])) for i in range(0, len(nums)-1, 2)])
    elif tag in ('polyline', 'polygon') and 'points' in elem.attrib:
        pts = re.findall(r'[-+]?[0-9]*\.?[0-9]+', elem.attrib['points'])
        coords.extend([(float(pts[i]), float(pts[i+1])) for i in range(0, len(pts)-1, 2)])
if coords:
    xs = [x for x,y in coords]
    ys = [y for x,y in coords]
    print('x min/max:', min(xs), max(xs), 'range', max(xs)-min(xs))
    print('y min/max:', min(ys), max(ys), 'range', max(ys)-min(ys))
MAP_BOUNDS = {'N':47.56, 'S':22.95, 'W':121.96, 'E':151.58}
SVG_VIEWBOX = {'width':581.981, 'height':579.907}
lon, lat = 139.766103, 35.681391
x = ((lon - MAP_BOUNDS['W']) / (MAP_BOUNDS['E'] - MAP_BOUNDS['W'])) * SVG_VIEWBOX['width']
y = ((MAP_BOUNDS['N'] - lat) / (MAP_BOUNDS['N'] - MAP_BOUNDS['S'])) * SVG_VIEWBOX['height']
print('Tokyo computed:', x, y)
