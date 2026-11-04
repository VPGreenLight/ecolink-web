"""Cắt nền + resize avatar AI.

Chạy một lần rồi xong: xuất file nhỏ, web không phải tải 1,36 MB cho một avatar.
Chạy lại khi đổi ảnh gốc:

    python tools/cut-avatar.py
"""
from PIL import Image, ImageChops, ImageDraw
import os

SRC = "public/assets/AI/ecolink-ai-normal.webp"
OUT = "public/assets/AI/ecolink-ai-avatar.webp"
SIZE = 320          # avatar 48px trong khung chat, 56px ở nút nổi -> 320px dư ở DPR 3
TOL = 34            # sai số màu cho phép, nền lệch nhẹ về kem vẫn bị xoá

src = Image.open(SRC).convert("RGB")
w, h = src.size
bg = src.getpixel((0, 0))
print("goc:", w, "x", h, "nen:", bg)

# Flood fill từ 4 góc chứ không xoá "mọi pixel gần trắng": màu trắng bên trong
# robot (lòng mắt, highlight trên vỏ) cũng là trắng, xoá theo ngưỡng sẽ đục
# thủng con robot. Flood fill chỉ ăn nền nối liền với mép ảnh.
#
# Fill trên BẢN SAO RGB, không fill trên mask: `floodfill` so màu với pixel
# gốc của chính ảnh truyền vào, truyền mask (đều là 255) thì toàn ảnh "nằm
# trong ngưỡng" và bị xoá sạch.
MARK = (255, 0, 255)   # ảnh gốc không có magenta nên không đụng độ gì
work = src.copy()
for xy in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    if work.getpixel(xy) == bg:
        ImageDraw.floodfill(work, xy, MARK, thresh=TOL)

# Nền đã đánh dấu thành alpha 0; phần còn lại giữ nguyên 255. Dò điểm ảnh
# bằng toán ảnh thay vì vòng `getpixel` — 1254² lần gọi trong Python chậm hẳn.
r, g, b = work.split()
marked = ImageChops.multiply(
    ImageChops.multiply(r.point(lambda v: 255 if v == MARK[0] else 0),
                        g.point(lambda v: 255 if v == MARK[1] else 0)),
    b.point(lambda v: 255 if v == MARK[2] else 0),
)
alpha = ImageChops.invert(marked)

bbox = alpha.getbbox()
print("bbox:", bbox)
if bbox is None:
    raise SystemExit("khong cat duoc nen - tang TOL")

out = src.convert("RGBA")
out.putalpha(alpha)
out = out.crop(bbox)
print("cat:", out.size)

# Đệm cho vuông thay vì ép SIZE×SIZE: crop ra 1136×1148, ép thẳng sẽ bóp nhẹ
# chiều ngang và con robot nhìn lệch. Đệm nền trong suốt giữ tỷ lệ gốc.
side = max(out.size)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
square.paste(out, ((side - out.width) // 2, (side - out.height) // 2))
out = square.resize((SIZE, SIZE), Image.LANCZOS)

out.save(OUT, "WEBP", quality=88, method=6)
print(
    "xong:", OUT, os.path.getsize(OUT) // 1024, "KB (truoc:",
    os.path.getsize(SRC) // 1024, "KB)",
)