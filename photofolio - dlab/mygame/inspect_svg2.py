import xml.etree.ElementTree as ET

try:
    tree = ET.parse('Japan_location_map.svg')
    root = tree.getroot()
    ns = {'svg': 'http://www.w3.org/2000/svg'}
    
    # Strip namespaces for easier parsing
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]

    for g in root.findall('.//g'):
        gid = g.attrib.get('id', '')
        print(f"Group: {gid}")
        if gid == "Staaten":
            for child in g:
                cid = child.attrib.get('id', '')
                d = child.attrib.get('d', '')
                print(f"  Path: {cid}, length: {len(d)}")

except Exception as e:
    print('Error:', e)
