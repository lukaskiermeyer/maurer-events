"""Build a synthetic camera frame from the already-sent test PDF; never print its QR."""
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image

document = pymupdf.open('test-results/scanner-issued-ticket.pdf')
page = document[0]
pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
ticket = Image.frombytes('RGB', [pixmap.width, pixmap.height], pixmap.samples)
ticket.thumbnail((1000, 660))
canvas = Image.new('RGB', (1280, 720), '#dddddd')
canvas.paste(ticket, ((1280 - ticket.width) // 2, (720 - ticket.height) // 2))
rgb = np.asarray(canvas, dtype=np.float32)
y = np.clip(16 + (65.481 * rgb[:, :, 0] + 128.553 * rgb[:, :, 1] + 24.966 * rgb[:, :, 2]) / 255, 0, 255).astype(np.uint8)
u = np.clip(128 + (-37.797 * rgb[:, :, 0] - 74.203 * rgb[:, :, 1] + 112 * rgb[:, :, 2]) / 255, 0, 255)
v = np.clip(128 + (112 * rgb[:, :, 0] - 93.786 * rgb[:, :, 1] - 18.214 * rgb[:, :, 2]) / 255, 0, 255)
u = u.reshape(360, 2, 640, 2).mean(axis=(1, 3)).astype(np.uint8)
v = v.reshape(360, 2, 640, 2).mean(axis=(1, 3)).astype(np.uint8)
frame = y.tobytes() + u.tobytes() + v.tobytes()
Path('test-results/scanner-camera.y4m').write_bytes(
    b'YUV4MPEG2 W1280 H720 F10:1 Ip A1:1 C420jpeg\n'
    + b''.join(b'FRAME\n' + frame for _ in range(20)))
print('Prepared full issued-ticket synthetic camera fixture; QR value kept private.')
