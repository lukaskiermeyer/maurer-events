"""Extract the existing Wirt SVG as PDF vector paths. Run after changing the SVG."""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

root = ET.parse('public/maennchen.svg').getroot()
style = next(node.text for node in root.iter() if node.tag.endswith('style'))
colors = dict(re.findall(r'\.(st\d+)\s*\{\s*fill:\s*(#[0-9a-fA-F]+);', style))
paths = []
for node in root.iter():
    if node.tag.endswith('path'):
        paths.append({'path': node.attrib['d'], 'color': colors[node.attrib['class']]})
    elif node.tag.endswith('polygon'):
        points = node.attrib['points'].split()
        pairs = [' '.join(points[index:index + 2]) for index in range(0, len(points), 2)]
        paths.append({'path': 'M ' + ' L '.join(pairs) + ' Z', 'color': colors[node.attrib['class']]})
Path('src/lib/ticket-logo.json').write_text(json.dumps({'source': 'public/maennchen.svg', 'viewBox': root.attrib['viewBox'], 'paths': paths}, ensure_ascii=False), encoding='utf-8')
print(f'Prepared {len(paths)} vector paths from the existing Wirt SVG.')
