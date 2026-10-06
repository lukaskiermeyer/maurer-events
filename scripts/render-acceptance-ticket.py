from pathlib import Path
import pymupdf

source = Path('test-results/staging-ticket.pdf')
document = pymupdf.open(source)
assert len(document) == 1
page = document[0]
page.get_pixmap(matrix=pymupdf.Matrix(2, 2)).save('test-results/staging-ticket.png')
print(page.get_text())
print('PDF page:', tuple(page.rect), 'images:', len(page.get_images()))
