"""Bake the walking character strips. The office floor is drawn from its roster at runtime."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

OUT = Path(__file__).resolve().parents[1] / 'public' / 'office'
OUT.mkdir(parents=True, exist_ok=True)

def draw_bot(color, hair, glasses, frame):
    image = Image.new('RGBA', (32, 40))
    pen = ImageDraw.Draw(image)
    a, b = 15, 35
    pen.ellipse((a-8,b-2,a+9,b+3), fill='#8d927b70')
    step = [0, 2, 0, -2][frame]
    pen.rectangle((a-5,b-6,a-1,b+step), fill='#4e5976')
    pen.rectangle((a+2,b-6,a+6,b-step), fill='#4e5976')
    pen.rectangle((a-6,b+step,a-1,b+step+2), fill='#39475b')
    pen.rectangle((a+2,b-step,a+8,b-step+2), fill='#39475b')
    bob = 1 if frame % 2 else 0
    b -= bob
    pen.rectangle((a-7,b-19,a+6,b-6), fill=color)
    pen.line((a-5,b-17,a-5,b-7), fill='#f5ecc5')
    pen.rectangle((a-9,b-16,a-7,b-9), fill=color)
    pen.rectangle((a+7,b-16,a+9,b-9), fill=color)
    pen.rectangle((a-9,b-9,a-7,b-6), fill='#efb68d')
    pen.rectangle((a+7,b-9,a+9,b-6), fill='#efb68d')
    pen.rectangle((a-5,b-31,a+5,b-20), fill=hair)
    pen.rectangle((a-4,b-27,a+5,b-21), fill='#f5c59e')
    pen.rectangle((a-4,b-31,a+4,b-28), fill=hair)
    pen.point((a-1,b-25), fill='#35445e')
    pen.point((a+4,b-25), fill='#35445e')
    if glasses:
        pen.rectangle((a-3,b-26,a,b-24), outline='#4b4761')
        pen.rectangle((a+2,b-26,a+5,b-24), outline='#4b4761')
    pen.point((a+2,b-22), fill='#cf8f7d')
    return ImageEnhance.Color(image).enhance(1.18)

bots = [
    ('atlas', '#9d83d5', '#75504b', False),
    ('mira', '#58bdb5', '#ad6c46', True),
    ('reed', '#ed8b76', '#5d4850', False),
    ('fern', '#8aaf5e', '#a4594b', True),
    ('kit', '#719fd5', '#4c4b68', False),
    ('designer', '#d69bb9', '#6c4c65', False),
    ('analyst', '#d3ad57', '#5a5147', True),
    ('generalist', '#82a7a0', '#74604f', False),
]
for name, color, hair, glasses in bots:
    strip = Image.new('RGBA', (128, 40))
    for frame in range(4):
        strip.paste(draw_bot(color, hair, glasses, frame), (frame * 32, 0))
    strip.save(OUT / f'{name}.png')

print(f'Wrote eight walking sprite strips to {OUT}')
