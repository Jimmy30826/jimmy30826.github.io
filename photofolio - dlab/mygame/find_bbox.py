import xml.etree.ElementTree as ET
import re

def get_bbox(svg_file):
    tree = ET.parse(svg_file)
    root = tree.getroot()
    
    # We find all path 'd' attributes
    all_points = []
    
    # Namespace handling
    ns = '{http://www.w3.org/2000/svg}'
    
    for path in root.iter(f'{ns}path'):
        d = path.get('d', '')
        # Simple extraction of numbers from the path data
        # This isn't perfect for all SVG commands but good for a bounding box check
        coords = re.findall(r'[-+]?\d*\.\d+|\d+', d)
        for i in range(0, len(coords)-1, 2):
            try:
                x = float(coords[i])
                y = float(coords[i+1])
                # Filter out very small values or obvious non-coords if any
                all_points.append((x, y))
            except:
                continue

    for poly in root.iter(f'{ns}polygon'):
        points = poly.get('points', '')
        coords = re.findall(r'[-+]?\d*\.\d+|\d+', points)
        for i in range(0, len(coords)-1, 2):
            all_points.append((float(coords[i]), float(coords[i+1])))

    if not all_points:
        return None
        
    min_x = min(p[0] for p in all_points)
    max_x = max(p[0] for p in all_points)
    min_y = min(p[1] for p in all_points)
    max_y = max(p[1] for p in all_points)
    
    return min_x, max_x, min_y, max_y

bbox = get_bbox('japan_map_clean.svg')
print(f"Bounding Box: {bbox}")
