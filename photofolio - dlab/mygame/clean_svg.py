import xml.etree.ElementTree as ET

try:
    # Register namespaces to preserve them
    ET.register_namespace('', "http://www.w3.org/2000/svg")
    ET.register_namespace('xlink', "http://www.w3.org/1999/xlink")
    
    tree = ET.parse('Japan_location_map.svg')
    root = tree.getroot()
    
    # We want to remove g id="Ozean", g id="Staaten", g id="Staatsgrenzen"
    namespaces = {'svg': 'http://www.w3.org/2000/svg'}
    
    # Elements to remove
    to_remove = ["Ozean", "Staaten", "Staatsgrenzen"]
    
    for g in root.findall('.//{http://www.w3.org/2000/svg}g'):
        gid = g.attrib.get('id', '')
        if gid in to_remove:
            root.remove(g)
            print(f"Removed {gid}")
            
    # Also find top level groups just in case
    for child in list(root):
        if child.attrib.get('id', '') in to_remove:
            root.remove(child)
            print(f"Removed {child.attrib.get('id')}")

    tree.write('japan_map_clean.svg', xml_declaration=True, encoding='utf-8')
    print("Successfully saved japan_map_clean.svg")

except Exception as e:
    print('Error:', e)
