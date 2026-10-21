"""Render the code-native 6×6 designs as a contact sheet for visual review."""
import json
from pathlib import Path
import re
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
page = (ROOT / 'yogo.html').read_text()
source = (ROOT / 'patterns.js').read_text()
colors = {key: json.loads(value) for key, value in re.findall(r'([A-Za-z]):(\[[0-9, ]+\])', page.split('const PAL={', 1)[1].split('};', 1)[0])}
colors['.'] = [0, 0, 0]
colors.update(json.loads(re.search(r'const palette = (\{.*?\});', source, re.S).group(1)))
all_designs = {key: json.loads(rows) for key, rows in re.findall(r'^      (\w+): (\[[^\n]+\])', source, re.M)}
names = dict(re.findall(r'(\w+):"([^"]+)"', source.split('const names = {', 1)[1]))
font_path = next(p for p in [Path('/System/Library/Fonts/PingFang.ttc'), Path('/System/Library/Fonts/Supplemental/Songti.ttc'), ROOT/'fonts/ChakraPetch-SemiBold.ttf'] if p.exists())
font = lambda size: ImageFont.truetype(str(font_path), size)
canvas = Image.new('RGB', (1320, 1308), '#0a0e18')
draw = ImageDraw.Draw(canvas)
draw.text((44, 28), 'YogoDot  /  未来信号 × 金渐层猫咪', font=font(34), fill='#f2f4fa')
draw.text((46, 83), '20 个新图案 · 原生 6 × 6 点阵 · 图库共 100 个', font=font(20), fill='#9ba9c0')
sections = [('未来信号', list(all_designs)[:12], 141, '#49dbe3'), ('金渐层猫咪', list(all_designs)[12:20], 741, '#f2c879')]
for title, keys, start_y, accent in sections:
    draw.text((46, start_y), title, font=font(26), fill=accent)
    for index, key in enumerate(keys):
        col, row = index % 6, index // 6
        x, y = 44 + col*208, start_y + 50 + row*245
        draw.rounded_rectangle((x, y, x+194, y+228), radius=15, fill='#141c2a', outline='#263349')
        rows = all_designs[key]
        for r, line in enumerate(rows):
            for c, char in enumerate(line):
                rgb = tuple(colors[char])
                left, top = x+21+c*26, y+16+r*26
                draw.rounded_rectangle((left, top, left+21, top+21), radius=4, fill=rgb if any(rgb) else '#090d15')
        label=names[key].replace('金渐层 · ', '')
        bounds=draw.textbbox((0,0), label, font=font(18))
        draw.text((x+(194-(bounds[2]-bounds[0]))/2, y+184), label, font=font(18), fill='#dfe8f4')
# Extra space after the future cards is kept for an explanatory caption.
draw.text((46, 697), '青蓝光路 / 紫色等离子 / 全息与赛博几何', font=font(18), fill='#8095b3')
output=ROOT/'docs/patterns-1.0.1.png'
canvas.save(output)
print(output)
