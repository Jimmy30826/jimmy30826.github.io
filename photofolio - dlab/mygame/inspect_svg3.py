import xml.etree.ElementTree as ET

try:
    tree = ET.parse('Japan_location_map.svg')
    root = tree.getroot()
    
    # Strip namespaces for easier parsing
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]

    # Look for paths and their fills
    fills = set()
    japan_fill = None
    for path in root.findall('.//path'):
        f = path.attrib.get('fill', path.get('style', ''))
        ills = path.get('style', '')
        # print specific path snippet
        if len(path.attrib.get('d', '')) > 20000:
             print("HUGE path!", path.attrib.get('id', ''), f, ills[:30])

except Exception as e:
    print('Error:', e)
