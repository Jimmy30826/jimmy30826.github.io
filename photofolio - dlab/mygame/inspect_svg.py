import xml.etree.ElementTree as ET
try:
    tree = ET.parse('Japan_location_map.svg')
    root = tree.getroot()
    print('ViewBox:', root.attrib.get('viewBox'))
    print('Width:', root.attrib.get('width'))
    print('Height:', root.attrib.get('height'))
    # child matching "g"
    for child in root:
        tag = child.tag.split('}')[-1]
        print(f'Tag: {tag}, id: {child.attrib.get("id", "")}')
        if tag == "g":
            for subchild in child:
                stag = subchild.tag.split('}')[-1]
                print(f'  SubTag: {stag}, id: {subchild.attrib.get("id", "")}')
                
except Exception as e:
    print('Error:', e)
