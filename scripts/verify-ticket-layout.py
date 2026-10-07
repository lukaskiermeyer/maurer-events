from pathlib import Path
import json
import pymupdf

fixtures = json.loads(Path('test-results/ticket-layout-fixtures.json').read_text(encoding='utf-8'))
for fixture in fixtures:
    source = Path(f"test-results/ticket-layout-{fixture['name']}.pdf")
    document = pymupdf.open(source)
    assert len(document) == 1
    page = document[0]
    page.get_pixmap(matrix=pymupdf.Matrix(2, 2)).save(source.with_suffix('.png'))
    qr = pymupdf.Rect(374, 172, 562, 360)
    spans = [span for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for span in line['spans']]
    for span in spans:
        box = pymupdf.Rect(span['bbox'])
        assert page.rect.contains(box), f"{fixture['name']}: text clipped: {span['text']}"
        assert not box.intersects(qr), f"{fixture['name']}: text overlaps QR: {span['text']}"
    text = ' '.join(page.get_text().split())
    for field in ['eventName', 'guestName', 'tableName']:
        assert ' '.join(fixture[field].split()) in text, f"{fixture['name']}: missing {field}"
    print(f"{fixture['name']}: full text retained, page bounds and QR area clear, page size {tuple(page.rect)}")
